// PA Authorization Gateway - pure policy helpers.
// Storage/execution must remain server-side. Approval is exact-scope, expiring and one-time.

export const APPROVAL_STATUS = Object.freeze({
  PENDING: "pending", APPROVED: "approved", REJECTED: "rejected",
  EXPIRED: "expired", CONSUMED: "consumed", CANCELLED: "cancelled"
});

export function approvalCanBeGranted(request, approverUserId, now = new Date()) {
  if (!request || request.status !== APPROVAL_STATUS.PENDING) return false;
  if (!approverUserId || request.approver_user_id !== approverUserId) return false;
  const expiry = new Date(request.expires_at);
  return Number.isFinite(expiry.getTime()) && expiry > now;
}

export function approvalCanExecute(request, expected, now = new Date()) {
  if (!request || request.status !== APPROVAL_STATUS.APPROVED) return false;
  if (request.consumed_at) return false;
  if (new Date(request.expires_at) <= now) return false;
  if (request.action_type !== expected.actionType) return false;
  // Scope is bound to canonical JSON supplied by trusted server code, never WhatsApp text.
  return stableJson(request.scope ?? {}) === stableJson(expected.scope ?? {});
}

export function requiresHumanProviderAuth(actionType) {
  return new Set([
    "google_oauth_consent", "meta_login_challenge", "captcha",
    "bank_otp", "3ds", "biometric_confirmation"
  ]).has(actionType);
}

export function defaultApprovalTtlMinutes(riskLevel) {
  if (riskLevel === "high") return 10;
  if (riskLevel === "sensitive") return 30;
  return 60;
}

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(k => JSON.stringify(k)+":"+stableJson(value[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}
