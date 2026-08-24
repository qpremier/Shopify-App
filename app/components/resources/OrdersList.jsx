// Purpose of this file is to render Shopify order previews.

function formatMoney(money) {
  if (!money) return "N/A";

  return `${money.amount} ${money.currencyCode}`;
}

/**
 * Displays recent orders with customer, payment, fulfillment, and total fields.
 * @param {{ orders: Array<Record<string, any>> }} props
 */
export function OrdersList({ orders }) {
  return (
    <s-stack direction="block" gap="base">
      {orders.map((order) => (
        <s-box key={order.id} padding="base" borderWidth="base" borderRadius="base">
          <s-stack direction="block" gap="small">
            <s-heading>{order.name}</s-heading>
            <s-paragraph>
              Total: {formatMoney(order.totalPriceSet?.shopMoney)}
            </s-paragraph>
            <s-paragraph>
              Customer: {order.customer?.displayName || order.customer?.email || "Guest"}
            </s-paragraph>
            <s-paragraph>
              Financial: {order.displayFinancialStatus || "N/A"} | Fulfillment:{" "}
              {order.displayFulfillmentStatus || "N/A"}
            </s-paragraph>
            <s-paragraph>
              Created: {new Date(order.createdAt).toLocaleString()}
            </s-paragraph>
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}
