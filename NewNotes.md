# Shopify Product Pagination

> Goal: show products 10 at a time using **Next** and **Previous** buttons.

---

## 1. What Changed?

Previously, the app always fetched only the first 10 products:

```graphql
products(first: 10)
```

That meant the user could never move beyond the first page.

Now, the app uses Shopify GraphQL cursor pagination:

```graphql
products(first: 10, after: $after)
products(last: 10, before: $before)
```

This lets us load:

| Action | Shopify Query Style | Meaning |
| --- | --- | --- |
| First page | `first: 10` | Get the first 10 products |
| Next page | `first: 10, after: endCursor` | Get 10 products after the current page |
| Previous page | `last: 10, before: startCursor` | Get 10 products before the current page |

---

## 2. Important Concept: Cursor Pagination

Shopify does **not** use normal page numbers like this:

```text
page=1
page=2
page=3
```

Instead, Shopify gives us cursors.

A cursor is like a bookmark for a product's position in the list.

```text
/app?after=cursor
/app?before=cursor
```

> We do not create cursors.  
> We do not decode cursors.  
> We just receive them from Shopify and send them back when asking for another page.

---

## 3. Shopify `pageInfo`

Shopify tells us everything we need through `pageInfo`:

```graphql
pageInfo {
  hasNextPage
  hasPreviousPage
  startCursor
  endCursor
}
```

| Field | Meaning | Used For |
| --- | --- | --- |
| `hasNextPage` | There are more products after this page | Enable/disable Next |
| `hasPreviousPage` | There are products before this page | Enable/disable Previous |
| `startCursor` | Cursor of the first product on this page | Previous button |
| `endCursor` | Cursor of the last product on this page | Next button |

### Do We Need Total Product Count?

No.

We do **not** calculate total products to know if Next or Previous exists.

Shopify already tells us:

```js
pageInfo.hasNextPage
pageInfo.hasPreviousPage
```

This is better because:

- It avoids extra API calls.
- It follows Shopify's GraphQL design.
- It works even if products are added or removed.
- It keeps the code simpler.

---

## 4. File: `app/services/products.server.js`

This file talks to the Shopify Admin API.

### Before

The query only accepted `first`:

```graphql
query GetProducts($first: Int!) {
  products(first: $first) {
    nodes {
      id
      title
      handle
      status
      createdAt
    }
  }
}
```

It returned only:

```js
products
```

### Now

The query accepts forward and backward pagination variables:

```graphql
query GetProducts($first: Int, $after: String, $last: Int, $before: String) {
  products(first: $first, after: $after, last: $last, before: $before) {
    nodes {
      id
      title
      handle
      status
      createdAt
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
```

The function now receives:

```js
{ first, after, last, before }
```

and returns:

```js
{
  products: nodes,
  pageInfo,
}
```

### Why This Is Better

The product service now gives the page everything it needs:

- `products` for rendering the product cards.
- `pageInfo` for rendering pagination buttons.

The service owns Shopify GraphQL details, so the UI does not need to know how the API query works.

---

## 5. File: `app/routes/app._index.jsx`

This file controls the `/app` products page.

The most important part is the loader:

```js
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const paginationOptions = before
    ? { last: PRODUCTS_PAGE_SIZE, before }
    : { first: PRODUCTS_PAGE_SIZE, after };

  return await getProducts(admin, paginationOptions);
};
```

### What Is a Loader?

In React Router, a loader runs on the server before the page renders.

For this page, the loader:

1. Authenticates with Shopify.
2. Reads URL query params.
3. Decides whether the user wants the first, next, or previous page.
4. Fetches products from Shopify.
5. Sends the result to the React component.

---

## 6. Loader Step By Step

### Step 1: Authenticate

```js
const { admin } = await authenticate.admin(request);
```

This checks that the merchant is authenticated and gives us the Shopify Admin API client.

### Step 2: Read the URL

```js
const url = new URL(request.url);
```

This lets us inspect the current page URL.

Examples:

```text
/app
/app?after=abc123
/app?before=xyz789
```

### Step 3: Read Pagination Params

```js
const after = url.searchParams.get("after");
const before = url.searchParams.get("before");
```

`after` means the user clicked Next.

`before` means the user clicked Previous.

### Step 4: Decide Which Shopify Query To Use

```js
const paginationOptions = before
  ? { last: PRODUCTS_PAGE_SIZE, before }
  : { first: PRODUCTS_PAGE_SIZE, after };
```

If `before` exists:

```js
{ last: 10, before }
```

That means:

```text
Get the 10 products before this cursor.
```

If `before` does not exist:

```js
{ first: 10, after }
```

That means either:

| URL | Loader Sends | Meaning |
| --- | --- | --- |
| `/app` | `{ first: 10, after: null }` | First page |
| `/app?after=abc123` | `{ first: 10, after: "abc123" }` | Next page |
| `/app?before=xyz789` | `{ last: 10, before: "xyz789" }` | Previous page |

### Step 5: Fetch Products

```js
return await getProducts(admin, paginationOptions);
```

This calls the service function and returns the data to the page.

The React component receives it here:

```js
const { products, pageInfo } = useLoaderData();
```

Then it renders:

```jsx
<ProductList products={products} />
<ProductPagination pageInfo={pageInfo} />
```

---

## 7. File: `app/components/ProductPagination.jsx`

This file renders the pagination buttons.

It receives:

```js
pageInfo
```

from the route.

### Previous Button

```js
const previousUrl =
  pageInfo.hasPreviousPage && pageInfo.startCursor
    ? `/app?before=${encodeURIComponent(pageInfo.startCursor)}`
    : undefined;
```

The Previous button uses `startCursor`.

Why?

Because `startCursor` points to the first product on the current page.

To go to the previous page, we ask Shopify:

```graphql
products(last: 10, before: startCursor)
```

### Next Button

```js
const nextUrl =
  pageInfo.hasNextPage && pageInfo.endCursor
    ? `/app?after=${encodeURIComponent(pageInfo.endCursor)}`
    : undefined;
```

The Next button uses `endCursor`.

Why?

Because `endCursor` points to the last product on the current page.

To go to the next page, we ask Shopify:

```graphql
products(first: 10, after: endCursor)
```

### Enabled And Disabled Buttons

If the page exists, we render a button with a link:

```jsx
<s-button href={nextUrl}>Next</s-button>
```

If the page does not exist, we render a disabled button:

```jsx
<s-button disabled>Next</s-button>
```

So Shopify controls whether buttons are enabled:

```js
pageInfo.hasNextPage
pageInfo.hasPreviousPage
```

---

## 8. Full Example Flow

### First Page

User visits:

```text
/app
```

Loader sends:

```js
{ first: 10, after: null }
```

Shopify returns:

```js
{
  products: [first 10 products],
  pageInfo: {
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: "...",
    endCursor: "..."
  }
}
```

Result:

- Previous is disabled.
- Next is enabled.

### Next Page

User clicks Next:

```text
/app?after=endCursor
```

Loader sends:

```js
{ first: 10, after: "endCursor" }
```

Shopify returns the next 10 products.

Result:

- Previous is enabled.
- Next may be enabled or disabled depending on Shopify's `hasNextPage`.

### Previous Page

User clicks Previous:

```text
/app?before=startCursor
```

Loader sends:

```js
{ last: 10, before: "startCursor" }
```

Shopify returns the previous 10 products.

Result:

- Previous may be enabled or disabled depending on Shopify's `hasPreviousPage`.
- Next is usually enabled unless this is the last page.

---

## 9. Why This Folder Structure Is Good

Each file has one job:

| File | Responsibility |
| --- | --- |
| `products.server.js` | Talk to Shopify Admin GraphQL |
| `app._index.jsx` | Authenticate, read URL params, load data |
| `ProductPagination.jsx` | Render Previous and Next buttons |
| `ProductList.jsx` | Render a list of products |
| `ProductCard.jsx` | Render one product |

This is good software engineering because:

- API logic is not mixed into UI components.
- URL logic stays in the route.
- Components stay reusable and easy to read.
- Future changes are easier.

For example, if later we add search, we can extend the route URL params without rewriting product cards.

---

## 10. Final Mental Model

Think of pagination like this:

```text
App:
Give me 10 products.

Shopify:
Here they are. There is a next page. Use this endCursor.

App:
Give me 10 products after this endCursor.

Shopify:
Here they are. There is a previous page and maybe another next page.

App:
Give me 10 products before this startCursor.

Shopify:
Here is the previous page.
```

The app does not count all products.

The app trusts Shopify's `pageInfo`.

That is the correct way to do Shopify GraphQL pagination.

---

# Fetching Products, Orders, Customers, Inventory, And Locations

> Goal: load multiple Shopify Admin API resources from the embedded app home page.

## 1. Is This Different From Products?

Mostly no.

The basic idea is the same as products:

```text
Route loader authenticates merchant
-> loader gets Shopify Admin API client
-> loader calls service function
-> service function runs GraphQL query
-> React component displays returned data
```

Products already worked like this:

```js
const { admin } = await authenticate.admin(request);
return await getProducts(admin, paginationOptions);
```

The new resources use the same pattern:

```js
getOrders(admin)
getCustomers(admin)
getInventoryItems(admin)
getLocations(admin)
```

So the big concept is not new. We simply repeated the same clean pattern for more Shopify resources.

## 2. What Is New?

The new part is organization and error handling.

Before, `products.server.js` called `admin.graphql()` directly.

Now there is one shared helper:

```text
app/services/admin-graphql.server.js
```

That file has:

```js
runAdminGraphql(admin, query, variables)
```

Its job is:

1. Send the GraphQL request to Shopify.
2. Convert the response to JSON.
3. Check if Shopify returned GraphQL errors.
4. Return only `json.data` to the service.

This means every service file can stay small and focused.

## 3. Why Separate Service Files?

Each Shopify resource now has its own service file:

| File | Purpose |
| --- | --- |
| `app/services/products.server.js` | Fetch products |
| `app/services/orders.server.js` | Fetch recent orders |
| `app/services/customers.server.js` | Fetch customers |
| `app/services/inventory.server.js` | Fetch inventory items and quantities |
| `app/services/locations.server.js` | Fetch shop locations |
| `app/services/admin-graphql.server.js` | Shared GraphQL request helper |

This is better than putting all queries inside `app._index.jsx` because:

- The route stays readable.
- Each resource query is easy to find.
- UI code is separate from API code.
- Later, pagination/search/filtering can be added resource by resource.

## 4. How The Loader Works Now

The route file is:

```text
app/routes/app._index.jsx
```

The loader still starts the same way:

```js
const { admin } = await authenticate.admin(request);
```

That gives us the authenticated Shopify Admin API client.

Then the loader fetches all resources:

```js
const [productResult, orderResult, customerResult, inventoryResult, locationResult] =
  await Promise.all([
    loadResource(() => getProducts(admin, paginationOptions)),
    loadResource(() => getOrders(admin, { first: RESOURCE_PREVIEW_SIZE })),
    loadResource(() => getCustomers(admin, { first: RESOURCE_PREVIEW_SIZE })),
    loadResource(() => getInventoryItems(admin, { first: RESOURCE_PREVIEW_SIZE })),
    loadResource(() => getLocations(admin, { first: RESOURCE_PREVIEW_SIZE })),
  ]);
```

`Promise.all()` means the app asks Shopify for these resources in parallel.

That is faster than doing this:

```text
fetch products
then fetch orders
then fetch customers
then fetch inventory
then fetch locations
```

## 5. Why `loadResource()` Exists

The helper:

```js
async function loadResource(fetcher) {
  try {
    return { items: await fetcher(), error: null };
  } catch (error) {
    return {
      items: [],
      error:
        error instanceof Error
          ? error.message
          : "Unable to load this Shopify resource.",
    };
  }
}
```

This prevents one failed resource from breaking the whole page.

Example:

```text
Products load successfully.
Orders load successfully.
Customers fail because Shopify has not approved customer access.
Inventory loads successfully.
Locations load successfully.
```

Without `loadResource()`, one Shopify error could crash the whole page. With it, the page can show data that worked and a clear error for the resource that failed.

## 6. Why Shopify Shows The Customer Error

Shopify says:

```text
This app is not approved to access the Customer object.
```

This is not mainly a JavaScript problem.

The code asks Shopify for customer data:

```graphql
customers(first: $first) {
  nodes {
    id
    displayName
    email
    phone
    numberOfOrders
    amountSpent {
      amount
      currencyCode
    }
    createdAt
  }
}
```

But Shopify treats customer data as protected customer data.

Customer name, email, phone, and address fields are even more sensitive because they directly identify a person.

So `read_customers` scope alone is not always enough. The app also needs protected customer data access configured or approved in the Shopify Partner Dashboard.

## 7. How To Fix Customer Access

For development stores, Shopify says you can enable the customer data and fields in the Partner Dashboard without submitting the app for full review, as long as the app is installed only on development stores.

For public apps, you need to request protected customer data access and explain why the app needs that data.

Basic steps:

1. Open Shopify Partner Dashboard.
2. Select this app.
3. Go to API access requests.
4. Request Protected customer data access.
5. Select the customer fields the app needs, such as name, email, or phone.
6. Save the reason for using each field.
7. Reinstall or reauthorize the app if Shopify requires new approval.

Important: only request fields that the app really needs.

For example, if you only need order count and total spent, avoid asking for phone number.

## 8. Required Scopes

The app config now includes:

```toml
scopes = "read_products,read_orders,read_customers,read_inventory,read_locations"
```

These are in:

```text
shopify.app.toml
shopify.app.test-app.toml
```

After changing scopes, the merchant usually needs to approve the new scopes again.

If the app was already installed before the scope change, run the Shopify app dev flow and approve the updated permissions when Shopify asks.

## 9. Final Mental Model

Think of each resource as a separate pipeline:

```text
Products component
<- products data
<- getProducts()
<- Shopify products GraphQL query

Orders component
<- orders data
<- getOrders()
<- Shopify orders GraphQL query

Customers component
<- customers data or approval error
<- getCustomers()
<- Shopify customers GraphQL query
```

So yes, the fetching idea is the same as products.

The new lessons are:

- Use one service file per Shopify resource.
- Use a shared GraphQL helper to avoid repeated request code.
- Fetch independent resources in parallel with `Promise.all()`.
- Handle each resource error separately.
- Customer data has extra Shopify approval rules because it is protected customer data.
