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
  try {
    const raw = await readRawBody(req);
    const signature = req.headers["x-hub-signature-256"];
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (typeof signature !== "string" ||
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(403).send("Invalid signature");
    }
    // Do not persist messages until secure ingestion is implemented.
    return res.status(200).send("EVENT_RECEIVED");
  } catch {
    return res.status(400).send("Invalid payload");
  }
}
