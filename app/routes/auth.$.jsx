// Catch-all auth callback route used by the Shopify auth package.
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

// Hands the callback request to Shopify so it can finish OAuth/session setup.
// Shopify automatically verifies the request and redirects to the app's home page after successful auth. We need to send request to the Shopify auth package to complete the OAuth flow and set up the session. If the request is invalid, Shopify will return an error response.
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

// Preserves headers Shopify needs while processing auth redirects.
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
