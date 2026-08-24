// Webhook endpoint that syncs stored scopes after Shopify updates app access.
import { authenticate } from "../shopify.server";
import { updateSessionScopes } from "../services/webhooks.server";

// Verifies the webhook and updates the session record with the new scopes.
export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;

  if (session) {
    await updateSessionScopes(session.id, current);
  }

  return new Response();
};
