// Authenticated API endpoint that returns recent cached orders without calling Shopify.
import { authenticate } from "../shopify.server";
import { getCachedOrders } from "../services/orders.server";

const DEFAULT_PREVIEW_SIZE = 5;
const MAX_PREVIEW_SIZE = 50;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

function parseFirstParam(request) {
  const url = new URL(request.url);
  const first = Number(url.searchParams.get("first") || DEFAULT_PREVIEW_SIZE);

  if (!Number.isSafeInteger(first) || first < 1) {
    return DEFAULT_PREVIEW_SIZE;
  }

  return Math.min(first, MAX_PREVIEW_SIZE);
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const orders = await getCachedOrders(session.shop, {
    first: parseFirstParam(request),
  });

  return json({ orders });
};
