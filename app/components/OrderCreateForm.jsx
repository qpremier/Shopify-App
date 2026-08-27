import { useAppBridge } from "@shopify/app-bridge-react";
import { useId, useState } from "react";
import { useRevalidator } from "react-router";

function formatErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return ["Unable to create order."];
  }

  return errors.map((error) => {
    const field = Array.isArray(error.field) ? error.field.join(".") : "";
    return field ? `${field}: ${error.message}` : error.message;
  });
}

/**
 * Creates a Shopify order through the authenticated /api/orders route.
 * @param {{ products?: Array<Record<string, any>> }} props
 */
export function OrderCreateForm({ products = [] }) {
  const shopify = useAppBridge();
  const revalidator = useRevalidator();
  const formId = useId();
  const variantFieldId = `${formId}-variantId`;
  const quantityFieldId = `${formId}-quantity`;
  const customerFieldId = `${formId}-customerId`;
  const emailFieldId = `${formId}-email`;
  const testFieldId = `${formId}-test`;
  const variantOptions = products.flatMap((product) =>
    (product.variants?.nodes || []).map((variant) => ({
      id: variant.id,
      label: `${product.title} - ${variant.id.split("/").pop()}`,
    })),
  );
  const [customerId, setCustomerId] = useState("");
  const [variantId, setVariantId] = useState(variantOptions[0]?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [email, setEmail] = useState("");
  const [isTestOrder, setIsTestOrder] = useState(true);
  const [status, setStatus] = useState({ tone: null, messages: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ tone: null, messages: [] });

    const payload = {
      lineItems: [
        {
          variantId: variantId.trim(),
          quantity: Number(quantity),
        },
      ],
      test: isTestOrder,
    };

    if (customerId.trim()) {
      payload.customerId = customerId.trim();
    }

    if (email.trim()) {
      payload.email = email.trim();
    }

    try {
      const token = await shopify.idToken();
      const response = await fetch("/api/orders", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus({ tone: "critical", messages: formatErrors(result.errors) });
        return;
      }

      setStatus({
        tone: "success",
        messages: [`Created order ${result.order.name}.`],
      });
      setVariantId(variantOptions[0]?.id || "");
      setQuantity("1");
      revalidator.revalidate();
    } catch (error) {
      setStatus({
        tone: "critical",
        messages: [
          error instanceof Error ? error.message : "Unable to create order.",
        ],
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <form onSubmit={handleSubmit}>
        <s-stack direction="block" gap="base">
          <s-heading>Create order</s-heading>

          {status.tone ? (
            <s-banner tone={status.tone}>
              <s-stack direction="block" gap="small">
                {status.messages.map((message) => (
                  <s-paragraph key={message}>{message}</s-paragraph>
                ))}
              </s-stack>
            </s-banner>
          ) : null}

          {variantOptions.length > 0 ? (
            <s-stack direction="block" gap="small">
              <label htmlFor={variantFieldId}>Product variant</label>
              <select
                id={variantFieldId}
                name="variantId"
                required
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "0.6rem",
                }}
              >
                {variantOptions.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </s-stack>
          ) : (
            <s-stack direction="block" gap="small">
              <label htmlFor={variantFieldId}>Product variant GID</label>
              <input
                id={variantFieldId}
                name="variantId"
                required
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
                placeholder="gid://shopify/ProductVariant/456"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "0.6rem",
                }}
              />
            </s-stack>
          )}

          <s-stack direction="block" gap="small">
            <label htmlFor={quantityFieldId}>Quantity</label>
            <input
              id={quantityFieldId}
              min="1"
              name="quantity"
              required
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "0.6rem",
              }}
            />
          </s-stack>

          <s-stack direction="block" gap="small">
            <label htmlFor={customerFieldId}>Customer GID</label>
            <input
              id={customerFieldId}
              name="customerId"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              placeholder="gid://shopify/Customer/123"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "0.6rem",
              }}
            />
          </s-stack>

          <s-stack direction="block" gap="small">
            <label htmlFor={emailFieldId}>Email</label>
            <input
              id={emailFieldId}
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="customer@example.com"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "0.6rem",
              }}
            />
          </s-stack>

          <s-stack direction="inline" gap="small">
            <input
              id={testFieldId}
              checked={isTestOrder}
              name="test"
              type="checkbox"
              onChange={(event) => setIsTestOrder(event.target.checked)}
            />
            <label htmlFor={testFieldId}>Create as test order</label>
          </s-stack>

          <s-button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create order"}
          </s-button>
        </s-stack>
      </form>
    </s-box>
  );
}
