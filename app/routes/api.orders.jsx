// Authenticated API endpoint for creating Shopify orders.
import { authenticate } from "../shopify.server";
import { AdminGraphqlError } from "../services/admin-graphql.server";
import {
  createOrder,
  OrderValidationError,
  ShopifyOrderCreateError,
  upsertCachedOrder,
} from "../services/orders.server";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw new OrderValidationError([
      { field: ["body"], message: "Request body must be valid JSON." },
    ]);
  }
}

function formatCreateOrderErrors(errors) {
  if (
    errors.some((error) =>
      error.message?.includes("not approved to access the Order object"),
    )
  ) {
    return [
      {
        message:
          "This app is not approved to create or read Shopify orders yet. Approve protected customer data access for this app, then reinstall or re-authorize it with the read_orders/write_orders scopes.",
      },
    ];
  }

  return errors;
}

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  try {
    const body = await parseJsonBody(request);
    const order = await createOrder(admin, body);
    await upsertCachedOrder(session.shop, order);

    return json(
      {
        order,
        shop: session.shop,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return json({ errors: error.errors }, { status: 400 });
    }

    if (error instanceof ShopifyOrderCreateError) {
      console.error("Shopify orderCreate user errors", {
        shop: session.shop,
        errors: error.errors,
      });
      return json({ errors: error.errors }, { status: 422 });
    }

    if (error instanceof AdminGraphqlError) {
      console.error("Shopify Admin GraphQL error while creating order", {
        shop: session.shop,
        errors: error.errors,
      });
      return json({ errors: formatCreateOrderErrors(error.errors) }, { status: 502 });
    }

    const message =
      error instanceof Error ? error.message : "Unable to create Shopify order.";

    console.error("Unable to create Shopify order", {
      shop: session.shop,
      message,
    });

    return json(
      { errors: [{ message }] },
      { status: 502 },
    );
  }
};
