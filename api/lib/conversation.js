// Pure helpers. Storage must be accessed server-side after resolving a verified PA user.
// Never accept user_id or conversation_id from a WhatsApp message body.
export function safeHistory(rows, userId, conversationUserId, maxTurns = 12) {
  if (!userId || userId !== conversationUserId || !Array.isArray(rows)) return [];
  return rows
    .filter(row => row.status === "completed" &&
      (row.role === "user" || row.role === "assistant") &&
      typeof row.body === "string")
    .slice(-Math.min(Math.max(maxTurns, 0), 20))
    .map(row => ({ role: row.role, content: row.body.slice(0, 4000) }));
}

export function isValidInboundMessage(message, expectedPhoneId, actualPhoneId) {
  return Boolean(
    expectedPhoneId && String(expectedPhoneId) === String(actualPhoneId) &&
    message && message.type === "text" &&
    typeof message.id === "string" && message.id.startsWith("wamid.") &&
    typeof message.from === "string" && /^[1-9][0-9]{7,14}$/.test(message.from) &&
    typeof message.text?.body === "string"
  );
}
