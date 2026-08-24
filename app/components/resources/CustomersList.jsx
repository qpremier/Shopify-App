// Purpose of this file is to render Shopify customer previews.

function formatMoney(money) {
  if (!money) return "N/A";

  return `${money.amount} ${money.currencyCode}`;
}

/**
 * Displays customers with contact and purchase summary details.
 * @param {{ customers: Array<Record<string, any>> }} props
 */
export function CustomersList({ customers }) {
  return (
    <s-stack direction="block" gap="base">
      {customers.map((customer) => (
        <s-box
          key={customer.id}
          padding="base"
          borderWidth="base"
          borderRadius="base"
        >
          <s-stack direction="block" gap="small">
            <s-heading>{customer.displayName || "Unnamed customer"}</s-heading>
            <s-paragraph>Email: {customer.email || "N/A"}</s-paragraph>
            <s-paragraph>Phone: {customer.phone || "N/A"}</s-paragraph>
            <s-paragraph>
              Orders: {customer.numberOfOrders ?? 0} | Spent:{" "}
              {formatMoney(customer.amountSpent)}
            </s-paragraph>
            <s-paragraph>
              Created: {new Date(customer.createdAt).toLocaleString()}
            </s-paragraph>
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}
