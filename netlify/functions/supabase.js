
exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Supabase env vars missing. Connect Supabase in Netlify Integrations or set SUPABASE_DATABASE_URL and SUPABASE_ANON_KEY manually." }),
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    if (payload.action === "signIn") {
      const authRes = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: payload.email, password: payload.password }),
      });
      const authText = await authRes.text();
      let authData; try { authData = authText ? JSON.parse(authText) : {}; } catch { authData = { error: authText }; }
      return { statusCode: authRes.status, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(authData) };
    }
    const { path, method, body, params } = payload;
    if (!path) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing: path" }) };

    const base = SUPABASE_URL.replace(/\/$/, "");
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    const url = `${base}/rest/v1/${path}${qs}`;

    const opts = {
      method: method || "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=merge-duplicates",
      },
    };
    if (body && method !== "GET") opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();
    let data; try { data = text ? JSON.parse(text) : []; } catch { data = { raw: text }; }

    return { statusCode: res.status, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
  }
};
