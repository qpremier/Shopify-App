export const GET_ORDERS_QUERY = `#graphql
  query GetOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          displayName
          email
        }
      }
    }
  }
`;

export const CREATE_ORDER_MUTATION = `#graphql
  mutation CreateOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      userErrors {
        field
        message
      }
      order {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          id
          displayName
          email
        }
        lineItems(first: 50) {
          nodes {
            id
            title
            quantity
            variant {
              id
            }
          }
        }
      }
    }
  }
`;
