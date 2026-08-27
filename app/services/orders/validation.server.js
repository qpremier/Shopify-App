const CUSTOMER_GID_PATTERN = /^gid:\/\/shopify\/Customer\/\d+$/;
const PRODUCT_VARIANT_GID_PATTERN = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const ALLOWED_ORDER_FIELDS = [
  "billingAddress",
  "buyerAcceptsMarketing",
  "currency",
  "customAttributes",
  "email",
  "financialStatus",
  "fulfillmentStatus",
  "note",
  "phone",
  "poNumber",
  "presentmentCurrency",
  "processedAt",
  "referringSite",
  "shippingAddress",
  "shippingLines",
  "sourceIdentifier",
  "sourceName",
  "sourceUrl",
  "tags",
  "taxesIncluded",
  "test",
];

export class OrderValidationError extends Error {
  constructor(errors) {
    super("Invalid order input.");
    this.name = "OrderValidationError";
    this.errors = errors;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateShopifyGid(value, pattern) {
  return typeof value === "string" && pattern.test(value);
}

export function buildOrderCreateInput(input) {
  const errors = [];

  if (!isPlainObject(input)) {
    throw new OrderValidationError([
      { field: ["body"], message: "Request body must be a JSON object." },
    ]);
  }

  const { customerId, lineItems, options, ...orderFields } = input;

  if (
    customerId !== undefined &&
    !validateShopifyGid(customerId, CUSTOMER_GID_PATTERN)
  ) {
    errors.push({
      field: ["customerId"],
      message: "customerId must be a Shopify Customer GID.",
    });
  }

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    errors.push({
      field: ["lineItems"],
      message: "At least one line item is required.",
    });
  } else if (lineItems.length > 50) {
    errors.push({
      field: ["lineItems"],
      message: "A maximum of 50 line items can be created at once.",
    });
  } else {
    lineItems.forEach((lineItem, index) => {
      if (!isPlainObject(lineItem)) {
        errors.push({
          field: ["lineItems", index],
          message: "Line item must be an object.",
        });
        return;
      }

      if (!validateShopifyGid(lineItem.variantId, PRODUCT_VARIANT_GID_PATTERN)) {
        errors.push({
          field: ["lineItems", index, "variantId"],
          message: "variantId must be a Shopify ProductVariant GID.",
        });
      }

      if (!Number.isSafeInteger(lineItem.quantity) || lineItem.quantity < 1) {
        errors.push({
          field: ["lineItems", index, "quantity"],
          message: "quantity must be a positive integer.",
        });
      }
    });
  }

  Object.keys(orderFields).forEach((field) => {
    if (!ALLOWED_ORDER_FIELDS.includes(field)) {
      errors.push({
        field: [field],
        message: "Field is not supported for order creation.",
      });
    }
  });

  if (options !== undefined && !isPlainObject(options)) {
    errors.push({
      field: ["options"],
      message: "options must be an object when provided.",
    });
  }

  if (errors.length > 0) {
    throw new OrderValidationError(errors);
  }

  const order = {
    lineItems: lineItems.map((lineItem) => ({
      variantId: lineItem.variantId,
      quantity: lineItem.quantity,
    })),
  };

  if (customerId) {
    order.customer = {
      toAssociate: {
        id: customerId,
      },
    };
  }

  ALLOWED_ORDER_FIELDS.forEach((field) => {
    if (orderFields[field] !== undefined) {
      order[field] = orderFields[field];
    }
  });

  return {
    order,
    options: options || undefined,
  };
}
