// Purpose of this file is to render Shopify location previews.

/**
 * Displays shop locations with status and address information.
 * @param {{ locations: Array<Record<string, any>> }} props
 */
export function LocationsList({ locations }) {
  return (
    <s-stack direction="block" gap="base">
      {locations.map((location) => (
        <s-box
          key={location.id}
          padding="base"
          borderWidth="base"
          borderRadius="base"
        >
          <s-stack direction="block" gap="small">
            <s-heading>{location.name}</s-heading>
            <s-paragraph>Status: {location.isActive ? "Active" : "Inactive"}</s-paragraph>
            <s-paragraph>
              Address: {location.address?.formatted?.join(", ") || "N/A"}
            </s-paragraph>
          </s-stack>
        </s-box>
      ))}
    </s-stack>
  );
}
