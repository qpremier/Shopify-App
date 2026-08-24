// @ts-check

/**
 * Renders cursor pagination controls for a Shopify connection.
 * @param {{
 *   pageInfo: {
 *     hasNextPage: boolean,
 *     hasPreviousPage: boolean,
 *     startCursor?: string | null,
 *     endCursor?: string | null,
 *   }
 * }} props
 */
export function ProductPagination({ pageInfo }) {
  const previousUrl =
    pageInfo.hasPreviousPage && pageInfo.startCursor
      ? `/app?before=${encodeURIComponent(pageInfo.startCursor)}`
      : undefined;
  const nextUrl =
    pageInfo.hasNextPage && pageInfo.endCursor
      ? `/app?after=${encodeURIComponent(pageInfo.endCursor)}`
      : undefined;

  return (
    <s-stack direction="inline" gap="base" justifyContent="end">
      {previousUrl ? (
        <s-button href={previousUrl}>Previous</s-button>
      ) : (
        <s-button disabled>Previous</s-button>
      )}
      {nextUrl ? (
        <s-button href={nextUrl}>Next</s-button>
      ) : (
        <s-button disabled>Next</s-button>
      )}
    </s-stack>
  );
}
