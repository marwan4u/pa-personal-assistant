export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const token = process.env.META_PA_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "META_PA_ACCESS_TOKEN is not configured" });
  const graph = "https://graph.facebook.com/v24.0";
  const get = async (path) => {
    const r = await fetch(`${graph}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    return { status: r.status, data };
  };
  try {
    const WABA = "1532582802237962";
    const PHONE = "1341635912365222";
    const [identity, waba, phones, phone] = await Promise.all([
      get("/me?fields=id,name"),
      get(`/${WABA}?fields=id,name,currency,timezone_id,message_template_namespace`),
      get(`/${WABA}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`),
      get(`/${PHONE}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`)
    ]);
    return res.status(200).json({
      ok: identity.status === 200 && waba.status === 200 && phone.status === 200,
      tokenPresent: true,
      identity,
      testWaba: waba,
      testWabaPhoneNumbers: phones,
      testPhone: phone
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Meta diagnostic failed", detail: String(error?.message || error) });
  }
}
