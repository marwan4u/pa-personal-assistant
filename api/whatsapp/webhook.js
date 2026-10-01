import crypto from "node:crypto";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Payload too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken) return res.status(503).send("Webhook not configured");
    if (req.query["hub.mode"] === "subscribe" &&
        req.query["hub.verify_token"] === verifyToken &&
        typeof req.query["hub.challenge"] === "string") {
      return res.status(200).send(req.query["hub.challenge"]);
    }
    return res.status(403).send("Verification failed");
  }
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const secret = process.env.META_APP_SECRET;
  if (!secret) return res.status(503).send("Webhook signature validation not configured");
  let body;
  try {
    const raw = await readRawBody(req);
    const signature = req.headers["x-hub-signature-256"];
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (typeof signature !== "string" ||
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(403).send("Invalid signature");
    }
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid payload");
  }

  // Acknowledge immediately. Test mode only: no persistence or AI processing.
  res.status(200).send("EVENT_RECEIVED");
  const token = process.env.META_PA_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const allowedRecipient = "97470366703";
  if (!token || !phoneId) {
    console.error("WhatsApp test reply configuration missing");
    return;
  }
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== "messages" ||
          String(change?.value?.metadata?.phone_number_id) !== phoneId) continue;
      for (const message of change?.value?.messages ?? []) {
        if (message?.type !== "text" || message?.from !== allowedRecipient) continue;
        try {
          const response = await fetch(
            `https://graph.facebook.com/v26.0/${encodeURIComponent(phoneId)}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: allowedRecipient,
                type: "text",
                text: { body: "PA test successful. Your WhatsApp message reached the assistant. AI replies are not enabled yet." }
              })
            }
          );
          if (!response.ok) console.error("WhatsApp test reply failed", response.status);
          else console.info("WhatsApp test reply sent", message.id);
        } catch (error) {
          console.error("WhatsApp test reply network error", error?.message);
        }
      }
    }
  }
}
