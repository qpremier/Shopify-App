// Purpose of this file is to render Shopify order previews.
import { useEffect, useState } from "react";

const ORDER_REFRESH_INTERVAL_MS = 15000;

function formatMoney(money) {
  if (!money?.amount || !money?.currencyCode) return "N/A";

  return `${money.amount} ${money.currencyCode}`;
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return "N/A";

  return new Date(createdAt).toLocaleString();
}

/**
 * Displays recent orders with customer, payment, fulfillment, and total fields.
 * @param {{ orders: Array<Record<string, any>> }} props
 */
export function OrdersList({ orders = [] }) {
  const [visibleOrders, setVisibleOrders] = useState(orders);

  useEffect(() => {
    setVisibleOrders(orders);
  }, [orders]);

  useEffect(() => {
    let cancelled = false;

    async function refreshOrders() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch("/api/orders/recent?first=5");

        if (!response.ok) {
          return;
        }

        const result = await response.json();

        if (!cancelled && Array.isArray(result.orders)) {
          setVisibleOrders(result.orders);
        }
      } catch {
        // Keep showing the current cache snapshot if polling fails.
      }
    }

    const intervalId = window.setInterval(
      refreshOrders,
      ORDER_REFRESH_INTERVAL_MS,
    );

    document.addEventListener("visibilitychange", refreshOrders);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshOrders);
    };
  }, []);

  return (
    <s-stack direction="block" gap="base">
      {visibleOrders.map((order) => (
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
              Created: {formatCreatedAt(order.createdAt)}
            </s-paragraph>
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}
