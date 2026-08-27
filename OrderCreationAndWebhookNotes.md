# Order Creation, Order Fetching, and `orders/create` Webhook Notes

## 1. What This App Does With Orders

This app has three related order flows:

1. It fetches recent Shopify orders from the Shopify Admin GraphQL API.
2. It creates Shopify orders from the embedded app UI by calling Shopify Admin GraphQL.
3. It receives Shopify's `orders/create` webhook and uses it to keep a local order preview cache fresh.

Shopify remains the source of truth for real order data. The local database only stores a lightweight preview cache for display and webhook idempotency.

High-level shape:

```text
Fetch orders:
App loader -> Shopify Admin GraphQL -> CachedOrder -> UI

Create order:
Order form -> POST /api/orders -> Shopify Admin GraphQL orderCreate -> CachedOrder -> UI refresh

Webhook:
Shopify order created -> POST /webhooks/orders/create -> WebhookReceipt + CachedOrder
```

The webhook does not create another order. It only receives Shopify's notification that an order was created.

## 2. Required Shopify Access

Order access requires these scopes in the Shopify app config:

```toml
read_orders
write_orders
```

The main config currently includes them in `shopify.app.toml`:

```toml
scopes = "read_products,read_orders,write_orders,read_customers,read_inventory,read_locations"
```

Important: Shopify orders contain protected customer data. For a real app/store, the app may also need Shopify protected customer data approval. If the app is not approved, Shopify can return an error like:

```text
not approved to access the Order object
```

The app catches that message and shows a clearer explanation in the UI/API response.

## 3. Main Files

### `app/services/orders.server.js`

This is the main order service.

It contains:

```js
getOrders(admin, options)
syncRecentOrdersFromShopify(admin, shop, options)
getCachedOrders(shop, options)
upsertCachedOrder(shop, orderPreview)
pruneCachedOrders(shop, options)
createOrder(admin, input)
buildOrderCreateInput(input)
```

This file owns both the Shopify Admin GraphQL order calls and the local cached-order conversion logic.

### `app/services/admin-graphql.server.js`

This is the shared Admin GraphQL wrapper.

It calls:

```js
admin.graphql(query, { variables })
```

Then it parses the JSON response. If Shopify returns top-level GraphQL errors in `json.errors`, it throws `AdminGraphqlError`.

### `app/routes/app._index.jsx`

This is the embedded app home page loader and UI composition.

The loader authenticates the merchant/admin request, loads products, orders, customers, inventory, and locations, then renders the resource sections.

For orders, it calls:

```js
loadOrders(admin, session.shop, { first: RESOURCE_PREVIEW_SIZE })
```

The page renders:

```jsx
<OrderCreateForm products={products} />
<OrdersList orders={orders} />
```

### `app/components/OrderCreateForm.jsx`

This is the client-side form for creating an order.

It lets the user choose or enter:

1. Product variant GID.
2. Quantity.
3. Optional customer GID.
4. Optional email.
5. Whether the order should be a test order.

It sends a `POST` request to:

```http
/api/orders
```

### `app/routes/api.orders.jsx`

This is the authenticated API route for creating orders.

Route:

```http
POST /api/orders
```

It authenticates the admin request, validates/parses JSON, calls `createOrder()`, writes the returned order preview to `CachedOrder`, then returns the Shopify-created order.

### `app/components/resources/OrdersList.jsx`

This renders recent order previews.

It starts with orders passed from the app loader, then polls:

```http
GET /api/orders/recent?first=5
```

every 15 seconds while the document is visible.

### `app/routes/api.orders.recent.jsx`

This route returns recent cached orders only.

Route:

```http
GET /api/orders/recent?first=5
```

It does not call Shopify. It authenticates the admin request, reads from `CachedOrder`, and returns JSON.

### `app/routes/webhooks.orders.create.jsx`

This is the webhook route for Shopify's `orders/create` topic.

Route:

```http
POST /webhooks/orders/create
```

It verifies the webhook using Shopify's webhook authentication, checks that the shop is known, records the webhook receipt, updates the local cached order preview, and safely ignores duplicate webhook deliveries.

### `app/services/webhooks.server.js`

This contains shared webhook helpers:

```js
extractOrderWebhookPayload(payload)
shopHasSession(shop)
recordOrderCreateWebhook(options)
```

`recordOrderCreateWebhook()` writes to both `WebhookReceipt` and `CachedOrder` in a database transaction.

### `prisma/schema.prisma`

The current order-related database models are:

```prisma
model WebhookReceipt {
  id         String   @id
  shop       String
  topic      String
  apiVersion String?
  receivedAt DateTime @default(now())

  @@index([shop, topic])
}

model CachedOrder {
  id                  String   @id @default(cuid())
  shop                String
  shopifyOrderId      String
  name                String?
  createdAt           DateTime?
  financialStatus     String?
  fulfillmentStatus   String?
  totalPrice          String?
  currencyCode        String?
  customerDisplayName String?
  customerEmail       String?
  cachedAt            DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([shop, createdAt])
  @@unique([shop, shopifyOrderId])
}
```

`WebhookReceipt` is for webhook idempotency. `CachedOrder` is for recent order display.

## 4. Recent Order Fetching Flow

The app home loader starts in `app/routes/app._index.jsx`.

It authenticates the admin request:

```js
const { admin, session } = await authenticate.admin(request);
```

Then it calls:

```js
loadOrders(admin, session.shop, { first: RESOURCE_PREVIEW_SIZE })
```

`loadOrders()` first reads the local cache:

```js
const cachedOrders = await getCachedOrders(shop, options);
```

Then it tries to fetch fresh order previews from Shopify:

```js
items: await syncRecentOrdersFromShopify(admin, shop, options)
```

If Shopify succeeds, `syncRecentOrdersFromShopify()`:

1. Calls `getOrders(admin, { first })`.
2. Upserts every returned order preview into `CachedOrder`.
3. Prunes old cached orders.
4. Returns the newest cached orders.

If Shopify fails, `loadOrders()` falls back to the cache:

```js
items: cachedOrders
```

If cached orders exist, the UI can still show recent known orders even when a Shopify call fails.

## 5. Shopify Order Fetch Query

The Admin GraphQL query is:

```graphql
query GetOrders($first: Int!) {
  orders(first: $first, sortKey: CREATED_AT, reverse: true) {
    nodes {
      id
      name
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      customer {
        displayName
        email
      }
    }
  }
}
```

This intentionally fetches preview fields only, not complete order details.

## 6. Order Preview Cache

The app stores order preview rows in `CachedOrder`.

Stored preview fields:

```text
shop
shopifyOrderId
name
createdAt
financialStatus
fulfillmentStatus
totalPrice
currencyCode
customerDisplayName
customerEmail
cachedAt
updatedAt
```

Cache behavior:

1. Orders are unique by `shop + shopifyOrderId`.
2. New data updates existing cache rows through Prisma `upsert`.
3. Cache reads are sorted by `createdAt desc`, then `cachedAt desc`.
4. The cache is pruned to keep the newest 50 orders by default.
5. The cache is populated by both active Shopify fetches and `orders/create` webhooks.

This cache is not a complete order database. It is only a display snapshot.

## 7. Client-Side Order Refresh

`OrdersList` receives initial order previews from the loader.

Then it polls:

```js
fetch("/api/orders/recent?first=5")
```

every 15 seconds:

```js
const ORDER_REFRESH_INTERVAL_MS = 15000;
```

That endpoint reads local cache only. This means frequent UI refreshes do not repeatedly hit the Shopify Admin API.

The component also refreshes when the browser tab becomes visible again.

## 8. Order Creation Request Cycle

The order creation endpoint is:

```http
POST /api/orders
```

Example request body:

```json
{
  "customerId": "gid://shopify/Customer/123",
  "lineItems": [
    {
      "variantId": "gid://shopify/ProductVariant/456",
      "quantity": 2
    }
  ],
  "email": "customer@example.com",
  "test": true
}
```

The form sends this request from `OrderCreateForm.jsx`.

After a successful response, the form:

1. Shows a success banner.
2. Resets the variant and quantity.
3. Calls `revalidator.revalidate()` so the page loader refreshes.

## 9. Order Creation Route Flow

The route starts with:

```js
const { admin, session } = await authenticate.admin(request);
```

That means:

1. The request must come from an authenticated Shopify admin session.
2. The app uses Shopify's stored session/access token.
3. The app does not hard-code access tokens.

Then the route parses JSON:

```js
const body = await parseJsonBody(request);
```

Invalid JSON returns:

```http
400 Bad Request
```

Then it creates the order:

```js
const order = await createOrder(admin, body);
```

Then it caches the returned order preview:

```js
await upsertCachedOrder(session.shop, order);
```

On success, the API returns:

```http
201 Created
```

with:

```json
{
  "order": "...Shopify-created order...",
  "shop": "example.myshopify.com"
}
```

## 10. Order Creation Validation

`buildOrderCreateInput(input)` validates request input before calling Shopify.

Rules:

1. Body must be a JSON object.
2. `lineItems` must be an array.
3. `lineItems` must contain at least one item.
4. A maximum of 50 line items can be submitted.
5. Each line item must be an object.
6. Each `variantId` must be a Shopify ProductVariant GID.
7. Each `quantity` must be a positive safe integer.
8. Optional `customerId` must be a Shopify Customer GID.
9. `options`, when provided, must be an object.
10. Top-level order fields must be in the local allowlist.

Valid variant ID format:

```text
gid://shopify/ProductVariant/456
```

Valid customer ID format:

```text
gid://shopify/Customer/123
```

Invalid examples:

```text
456
ProductVariant/456
gid://shopify/Product/456
```

Unsupported top-level fields are rejected. Extra properties inside line item objects are ignored because the service only copies `variantId` and `quantity`.

## 11. Supported Order Create Fields

The service allowlist currently permits these top-level fields:

```js
billingAddress
buyerAcceptsMarketing
currency
customAttributes
email
financialStatus
fulfillmentStatus
note
phone
poNumber
presentmentCurrency
processedAt
referringSite
shippingAddress
shippingLines
sourceIdentifier
sourceName
sourceUrl
tags
taxesIncluded
test
```

`customerId` is handled specially and converted into Shopify's customer association input.

`options` is passed separately as `OrderCreateOptionsInput`.

## 12. GraphQL Input Shape For Creation

The app converts this app-level input:

```json
{
  "customerId": "gid://shopify/Customer/123",
  "lineItems": [
    {
      "variantId": "gid://shopify/ProductVariant/456",
      "quantity": 2
    }
  ],
  "test": true
}
```

into Shopify's `OrderCreateOrderInput` shape:

```js
{
  order: {
    lineItems: [
      {
        variantId: "gid://shopify/ProductVariant/456",
        quantity: 2,
      },
    ],
    customer: {
      toAssociate: {
        id: "gid://shopify/Customer/123",
      },
    },
    test: true,
  },
}
```

If `options` is provided, the variables become:

```js
{
  order: { ... },
  options: { ... },
}
```

## 13. Shopify Order Create Mutation

The service sends this mutation:

```graphql
mutation CreateOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
  orderCreate(order: $order, options: $options) {
    userErrors {
      field
      message
    }
    order {
      id
      name
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      totalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      customer {
        id
        displayName
        email
      }
      lineItems(first: 50) {
        nodes {
          id
          title
          quantity
          variant {
            id
          }
        }
      }
    }
  }
}
```

This mutation is sent with:

```js
runAdminGraphql(admin, CREATE_ORDER_MUTATION, variables)
```

## 14. Order Creation Error Handling

There are three main error categories.

Invalid request input:

```http
400 Bad Request
```

This comes from `OrderValidationError`.

Shopify mutation user errors:

```http
422 Unprocessable Entity
```

This comes from `data.orderCreate.userErrors`.

Shopify Admin GraphQL/top-level errors:

```http
502 Bad Gateway
```

This comes from `AdminGraphqlError`, including access/scope/protected-data failures.

The route also validates that Shopify returned a valid order GID after creation. If Shopify does not return a valid created order ID, the route treats it as a server-side failure.

## 15. Webhook Registration

The `orders/create` webhook subscription is declared in `shopify.app.toml`:

```toml
[[webhooks.subscriptions]]
uri = "/webhooks/orders/create"
topics = [ "orders/create" ]
```

This means Shopify sends order-created events to:

```text
{app_url}/webhooks/orders/create
```

Important config note: `shopify.app.test-app.toml` currently has the order scopes, but it does not declare the `orders/create` webhook subscription. If that config is used for Shopify config sync/deploy, the webhook subscription should be added there too.

## 16. Webhook Request Cycle

Full flow:

```text
Order created in Shopify
        |
        v
Shopify sends orders/create webhook
        |
        v
/webhooks/orders/create receives request
        |
        v
authenticate.webhook(request) verifies webhook authenticity
        |
        v
App checks whether shop is known
        |
        v
App creates WebhookReceipt and upserts CachedOrder in a transaction
        |
        v
App returns 200 OK to Shopify
```

The webhook route starts with:

```js
const { apiVersion, payload, session, shop, topic, webhookId } =
  await authenticate.webhook(request);
```

This gives the app trusted webhook metadata and the parsed payload.

## 17. Where Webhook Verification Happens

Webhook verification is delegated to Shopify's app package:

```js
authenticate.webhook(request)
```

This step reads Shopify webhook headers and verifies the request before app code processes the payload.

The app does not manually verify HMAC in this route.

If verification fails, processing stops.

## 18. What Shopify Sends With The Webhook

Shopify sends webhook data in:

1. Headers.
2. Request body.

Common headers include:

```text
X-Shopify-Hmac-Sha256
X-Shopify-Shop-Domain
X-Shopify-Topic
X-Shopify-Webhook-Id
X-Shopify-API-Version
X-Shopify-Triggered-At
```

The request body contains the order payload.

The webhook ID is provided by Shopify as a header and exposed to this app as:

```js
webhookId
```

## 19. Webhook Payload Extraction

`extractOrderWebhookPayload(payload)` converts Shopify's webhook payload into the same preview-like shape used by cached orders.

It extracts:

```text
id
name
createdAt
displayFinancialStatus
displayFulfillmentStatus
totalPriceSet.shopMoney.amount
totalPriceSet.shopMoney.currencyCode
customer.displayName
customer.email
```

For the order ID, it prefers:

```js
payload.admin_graphql_api_id
```

and falls back to:

```js
String(payload.id || "")
```

For money, it prefers:

```js
payload.total_price_set.shop_money
```

and falls back to `payload.total_price` and `payload.currency`.

## 20. Webhook Database Writes

`recordOrderCreateWebhook()` writes two things in one Prisma transaction:

1. A `WebhookReceipt` row.
2. A `CachedOrder` upsert.

The receipt uses:

```js
id: webhookId
```

The cached order uses:

```js
shop_shopifyOrderId: {
  shop,
  shopifyOrderId: order.id,
}
```

After the transaction, the app prunes the order cache to keep the latest 50 cached orders.

## 21. Duplicate Webhook Handling

Shopify can retry webhook delivery.

For example, Shopify may retry if:

1. The app times out.
2. The app returns an error.
3. There is a network issue.
4. Shopify does not receive a proper response.

The app uses the Shopify webhook ID as the idempotency key:

```prisma
model WebhookReceipt {
  id String @id
}
```

If the same webhook arrives again, Prisma raises a unique constraint error. The route catches Prisma error code `P2002`, logs that the duplicate was ignored, and returns success to Shopify.

This prevents the same webhook delivery from being processed twice.

## 22. Unknown Shop Handling

The webhook route checks:

```js
const knownShop = session || (await shopHasSession(shop));
```

If the shop is unknown, the app logs a warning and returns success:

```js
console.warn("Skipping orders/create webhook for unknown shop", { shop });
return new Response();
```

This avoids storing webhook data for shops that are not installed or recognized.

## 23. How The Pieces Stay In Sync

The cache can be updated from three places:

1. Home page loader fetches recent orders from Shopify and upserts them.
2. Order creation route creates an order and immediately upserts the returned order.
3. `orders/create` webhook receives Shopify's notification and upserts the order.

The UI reads cache in two ways:

1. The page loader returns order previews on initial render/revalidation.
2. `OrdersList` polls `/api/orders/recent` every 15 seconds for cache-only refreshes.

This gives the app a responsive UI without treating the local database as the source of truth.

## 24. Important Security And Operational Points

1. Admin order fetching and creation use `authenticate.admin(request)`.
2. Webhook receiving uses `authenticate.webhook(request)`.
3. Access tokens and app secrets are not hard-coded.
4. Access tokens and app secrets are not logged.
5. Webhook authenticity is checked before payload processing.
6. Duplicate webhooks are ignored using `WebhookReceipt.id`.
7. Unknown shops are skipped.
8. The webhook route does not create orders.
9. The local cache stores only preview fields, not the full raw order payload.
10. The UI polling route reads cache only and does not call Shopify.
11. Order creation validates GID formats and quantities before calling Shopify.
12. Order access depends on scopes and protected customer data approval.

## 25. Current Approach Summary

The current approach is:

```text
Shopify Admin API = source of truth
SQLite CachedOrder = lightweight display cache
WebhookReceipt = idempotency record for webhook delivery
```

This is a solid approach for a dashboard-style app because it:

1. Keeps Shopify as the real order system.
2. Avoids storing unnecessary order payloads.
3. Makes the UI faster and more resilient.
4. Reduces repeated Shopify API calls during polling.
5. Handles webhook retries safely.

The main thing to watch is config consistency. The app has `orders/create` in `shopify.app.toml`, but not in `shopify.app.test-app.toml`. If the test config is the active Shopify config, add the webhook subscription there before relying on webhook delivery.
