// Parent layout for all embedded app routes that require Shopify auth.
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { env } from "../config/env.server";
import { authenticate } from "../shopify.server";

// Protects every child route and passes the Shopify API key to the client app shell.
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return { apiKey: env.shopifyApiKey };
};

// Renders the embedded Shopify app shell and nested route content.
export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
// Forwards Shopify-specific errors through React Router's boundary system.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// Preserves headers Shopify needs on responses from this route tree.
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
