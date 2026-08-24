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
