// Central Shopify app configuration for auth, sessions, and API access.
// Purpose of this file is to provide a single source of truth for the Shopify app configuration that can be imported anywhere in the app.
import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { env } from "./config/env.server";
import prisma from "./db.server";

// Builds the Shopify app instance that the rest of the app imports.
const shopify = shopifyApp({
  apiKey: env.shopifyApiKey,
  apiSecretKey: env.shopifyApiSecret,
  apiVersion: ApiVersion.July26,
  scopes: env.shopifyScopes,
  appUrl: env.shopifyAppUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(env.shopCustomDomain ? { customShopDomains: [env.shopCustomDomain] } : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
