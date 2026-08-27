// Webhook endpoint that records Shopify orders/create notifications.
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  recordOrderCreateWebhook,
  shopHasSession,
} from "../services/webhooks.server";

function isUniqueConstraintError(error) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export const action = async ({ request }) => {
  const { apiVersion, payload, session, shop, topic, webhookId } =
    await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const knownShop = session || (await shopHasSession(shop));
  if (!knownShop) {
    console.warn("Skipping orders/create webhook for unknown shop", { shop });
    return new Response();
  }

  try {
    await recordOrderCreateWebhook({
      webhookId,
      shop,
      topic,
      apiVersion,
      payload,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      console.log("Duplicate orders/create webhook ignored", { shop, webhookId });
      return new Response();
    }

    console.error("Unable to process orders/create webhook", {
      shop,
      webhookId,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return new Response("Unable to process webhook", { status: 500 });
  }

  return new Response();
};
