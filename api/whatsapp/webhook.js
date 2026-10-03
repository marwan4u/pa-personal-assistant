const crypto = require("node:crypto");
const { resolveWhatsAppUser, claimInbound } = require("../lib/supabase-server");
const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function instructions(user) {
  const base = "You are PA, a private personal assistant. Continue the conversation naturally and use available authorized context. Keep answers practical and direct, but give detail when it helps. Do not act like a stateless test bot. Never invent access, stored facts, completed actions, or tool results. If information is missing, say what is missing and propose the easiest next step.";
  return user.role === "wife"
    ? base + " You are speaking with Louza. Be warm and dependable. Respect her privacy and autonomy."
    : base + " You are speaking with Marwan, the PA owner.";
}

async function sendText(phoneId, token, to, text) {
  return fetch(`https://graph.facebook.com/v26.0/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text.slice(0, 3500) } })
  });
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const v = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!v) return res.status(503).send("Webhook not configured");
    if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === v && typeof req.query["hub.challenge"] === "string")
      return res.status(200).send(req.query["hub.challenge"]);
    return res.status(403).send("Verification failed");
  }
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const secret = process.env.META_APP_SECRET;
  if (!secret) return res.status(503).send("Webhook signature validation not configured");
  let body;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers["x-hub-signature-256"];
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (typeof sig !== "string" || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
      return res.status(403).send("Invalid signature");
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid payload");
  }

  const token = process.env.META_PA_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return res.status(200).send("EVENT_RECEIVED");

  for (const entry of body?.entry ?? []) for (const change of entry?.changes ?? []) {
    if (change?.field !== "messages" || String(change?.value?.metadata?.phone_number_id) !== phoneId) continue;
    for (const message of change?.value?.messages ?? []) {
      if (message?.type !== "text") continue;
      let dbUser;
      try { dbUser = await resolveWhatsAppUser(message.from); }
      catch (e) { console.error("Identity lookup failed", e?.message); continue; }
      if (!dbUser) continue;

      let claimed;
      try { claimed = await claimInbound(message.id, dbUser.id); }
      catch (e) { console.error("Inbound claim failed", e?.message); continue; }
      if (!claimed) continue;

      const prompt = message.text?.body?.trim();
      if (!prompt) continue;
      const role = message.from === "97470366703" ? "owner" : "wife";
      let reply = "PA is temporarily unavailable.";
      try {
        const key = process.env.OPENAI_API_KEY;
        if (!key) throw new Error("OpenAI not configured");
        const ai = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            instructions: instructions({ name: dbUser.name, role }),
            input: prompt.slice(0, 4000),
            max_output_tokens: 500,
            store: false
          }),
          signal: AbortSignal.timeout(18000)
        });
        if (ai.ok) {
          const data = await ai.json();
          reply = (data.output ?? []).flatMap(x => x.content ?? []).filter(x => x.type === "output_text").map(x => x.text).join("\n").trim() || "I couldn't produce a reply. Try again.";
        } else console.error("PA AI request failed", ai.status);
        const sent = await sendText(phoneId, token, message.from, reply);
        if (!sent.ok) console.error("WhatsApp reply failed", sent.status);
        else console.info("WhatsApp reply sent", message.id);
      } catch (e) {
        console.error("PA reply error", e?.message);
      }
    }
  }
  return res.status(200).send("EVENT_RECEIVED");
}

module.exports = handler;
module.exports.config = config;
