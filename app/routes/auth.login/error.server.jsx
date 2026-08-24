// Converts Shopify login error codes into user-friendly field messages.
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

// Maps Shopify auth validation errors to the login form UI.
export function loginErrorMessage(loginErrors) {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }

  return {};
}
