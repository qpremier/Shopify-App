// Small database helpers used by webhook route handlers.
import db from "../db.server";

// Deletes every stored session for a shop after the app is uninstalled.
export async function deleteShopSessions(shop) {
  return db.session.deleteMany({ where: { shop } });
}

// Keeps the stored session scopes in sync when Shopify reports a scope change.
export async function updateSessionScopes(sessionId, scopes) {
  return db.session.update({
    where: {
      id: sessionId,
    },
    data: {
      scope: scopes.toString(),
    },
  });
}
