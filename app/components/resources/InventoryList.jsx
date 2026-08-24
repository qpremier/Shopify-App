// Purpose of this file is to render Shopify inventory item previews.

function getQuantity(quantities, name) {
  return quantities?.find((quantity) => quantity.name === name)?.quantity ?? 0;
}

/**
 * Displays inventory items and their quantities across locations.
 * @param {{ inventoryItems: Array<Record<string, any>> }} props
 */
export function InventoryList({ inventoryItems }) {
  return (
    <s-stack direction="block" gap="base">
      {inventoryItems.map((item) => (
        <s-box key={item.id} padding="base" borderWidth="base" borderRadius="base">
          <s-stack direction="block" gap="small">
            <s-heading>
              {item.variant?.product?.title || "Inventory item"}
            </s-heading>
            <s-paragraph>
              Variant: {item.variant?.title || "N/A"} | SKU: {item.sku || "N/A"}
            </s-paragraph>
            <s-paragraph>Tracked: {item.tracked ? "Yes" : "No"}</s-paragraph>
            <s-stack direction="block" gap="small">
              {item.inventoryLevels.nodes.map((level) => (
                <s-box key={level.id} padding="small" borderWidth="base">
                  <s-paragraph>
                    {level.location.name}: Available{" "}
                    {getQuantity(level.quantities, "available")}, On hand{" "}
                    {getQuantity(level.quantities, "on_hand")}, Committed{" "}
                    {getQuantity(level.quantities, "committed")}
                  </s-paragraph>
                </s-box>
              ))}
            </s-stack>
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}
