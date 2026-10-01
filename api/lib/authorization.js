// Pure, fail-closed authorization helpers for future PA message processing.
// No database or network access is performed by this module.
export function normalizeWhatsAppId(value) {
  if (typeof value !== "string" || !/^[1-9][0-9]{7,14}$/.test(value)) return null;
  return value;
}

export function resolveAuthorizedSender(sender, verifiedIdentities) {
  const normalized = normalizeWhatsAppId(sender);
  if (!normalized || !Array.isArray(verifiedIdentities)) return null;
  const matches = verifiedIdentities.filter(identity =>
    identity.provider === "whatsapp" &&
    identity.provider_subject === normalized &&
    identity.verified_at &&
    identity.user_status === "active" &&
    identity.user_id
  );
  return matches.length === 1 ? matches[0].user_id : null;
}

export function mayReadDocument(userId, accessRows) {
  if (!userId || !Array.isArray(accessRows)) return false;
  return accessRows.some(row =>
    row.user_id === userId &&
    ["owner", "viewer", "editor"].includes(row.permission)
  );
}

export function mayUseConnectedAccount(userId, account) {
  return Boolean(userId && account &&
    account.user_id === userId && account.status === "active");
}
