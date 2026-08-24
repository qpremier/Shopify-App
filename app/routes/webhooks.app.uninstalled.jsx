// Webhook endpoint that cleans up local data when a shop removes the app.
import { authenticate } from "../shopify.server";
import { deleteShopSessions } from "../services/webhooks.server";

// Verifies the webhook and deletes all stored sessions for that shop.
export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await deleteShopSessions(shop);
  }

  return new Response();
};
