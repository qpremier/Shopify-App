// Purpose of this file is to render a consistent section for Shopify resource previews.

/**
 * Renders loading results, empty states, and permission/API errors consistently.
 * @param {{
 *   title: string,
 *   description: string,
 *   items: unknown[],
 *   error?: string | null,
 *   children: React.ReactNode,
 * }} props
 */
export function ResourceSection({ title, description, items, error, children }) {
  return (
    <s-section heading={title}>
      <s-stack direction="block" gap="base">
        <s-paragraph>{description}</s-paragraph>
        {error ? (
          <s-banner tone="critical">
            <s-paragraph>{error}</s-paragraph>
          </s-banner>
        ) : items.length === 0 ? (
          <s-paragraph>No {title.toLowerCase()} found yet.</s-paragraph>
        ) : (
          children
        )}
      </s-stack>
    </s-section>
  );
}
