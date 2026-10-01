import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken) return res.status(503).send("Webhook not configured");
    const mode = req.query["hub.mode"];
    const supplied = req.query["hub.verify_token"];
    if (mode === "subscribe" && supplied === verifyToken) {
      return res.status(200).send(req.query["hub.challenge"] || "");
    }
    return res.status(403).send("Verification failed");
  }

  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return res.status(503).send("Webhook signature validation not configured");
  // Vercel may parse JSON request bodies; reserialize only if rawBody is unavailable.
  // Signature validation requires the exact raw bytes. Reject if unavailable.
  const raw = req.rawBody;
  if (!raw) return res.status(503).send("Raw body unavailable for signature validation");
  const supplied = req.headers["x-hub-signature-256"];
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(raw).digest("hex");
  if (typeof supplied !== "string" || supplied.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).send("Invalid signature");
  }
  // No message storage or AI processing until explicit ingestion rules are configured.
  return res.status(200).send("EVENT_RECEIVED");
}
