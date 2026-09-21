module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.SUPABASE_DATABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
  Object.entries(cors).forEach(([key, value]) => res.setHeader(key, value));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase environment variables are missing.' });
  }
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const base = supabaseUrl.replace(/\/$/, '');
    if (payload.action === 'signIn') {
      const authResponse = await fetch(`${base}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: payload.email, password: payload.password }),
      });
      const authText = await authResponse.text();
      let authData;
      try { authData = authText ? JSON.parse(authText) : {}; } catch { authData = { error: authText }; }
      return res.status(authResponse.status).json(authData);
    }
    const { path, method = 'GET', body, params } = payload;
    if (!path || !/^[a-zA-Z0-9_]+$/.test(path)) {
      return res.status(400).json({ error: 'Invalid or missing path.' });
    }
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    const response = await fetch(`${base}/rest/v1/${path}${query}`, {
      method,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=merge-duplicates',
      },
      ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : []; } catch { data = { raw: text }; }
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
