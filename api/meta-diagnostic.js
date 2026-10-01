export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.META_PA_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "META_PA_ACCESS_TOKEN is not configured" });

  const graph = "https://graph.facebook.com/v24.0";
  const get = async (path) => {
    const r = await fetch(`${graph}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await r.json();
    return { status: r.status, data };
  };

  try {
    const me = await get("/me?fields=id,name");
    const businesses = await get("/me/businesses?fields=id,name");

    const result = {
      ok: me.status >= 200 && me.status < 300,
      tokenPresent: true,
      identity: me,
      businesses,
      ownedWabas: [],
      clientWabas: []
    };

    const businessList = Array.isArray(businesses.data?.data) ? businesses.data.data : [];
    for (const business of businessList) {
      const owned = await get(`/${business.id}/owned_whatsapp_business_accounts?fields=id,name,currency,timezone_id,message_template_namespace`);
      const client = await get(`/${business.id}/client_whatsapp_business_accounts?fields=id,name,currency,timezone_id,message_template_namespace`);
      result.ownedWabas.push({ business, response: owned });
      result.clientWabas.push({ business, response: client });
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Meta diagnostic failed", detail: String(error?.message || error) });
  }
}
