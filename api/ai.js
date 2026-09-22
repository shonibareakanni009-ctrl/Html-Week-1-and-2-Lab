const MODEL = 'gemini-3.8-flash';

function responseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const blocks = Array.isArray(payload?.output) ? payload.output : [];
  return blocks
    .filter(block => block?.type === 'text' || typeof block?.text === 'string')
    .map(block => block.text || block.content || '')
    .join('\n')
    .trim();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI coach is not configured yet.' });

  try {
    const { message, challenge, code, history = [] } = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'A message is required.' });

    const safeHistory = Array.isArray(history)
      ? history.slice(-8).map(item => ({ role: item.role === 'model' ? 'model' : 'user', content: String(item.content || '').slice(0, 1200) }))
      : [];
    const context = [
      `Current challenge: ${String(challenge?.title || 'HTML practice').slice(0, 300)}`,
      `Challenge brief: ${String(challenge?.desc || '').slice(0, 1200)}`,
      `Student code:\n${String(code || '(empty)').slice(0, 5000)}`,
      `Student question: ${message.slice(0, 1600)}`,
      safeHistory.length ? `Recent conversation:\n${safeHistory.map(item => `${item.role}: ${item.content}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const prompt = `You are HTMLab Coach, a friendly beginner HTML teacher. Guide the student through the current challenge without doing the whole assignment for them. Ask a short guiding question when that will help. Explain one concept at a time, use tiny examples, point out mistakes in their code, and celebrate progress. Never claim to have run code you cannot run. Keep replies under 180 words and use plain text with small code snippets.\n\n${context}`;
    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model: MODEL,
        system_instruction: 'You are a patient, Socratic HTML learning coach for school students.',
        input: prompt,
        generation_config: { thinking_level: 'low', temperature: 0.4, max_output_tokens: 350 },
      }),
    });
    const payload = await upstream.json().catch(() => ({}));
    const reply = responseText(payload);
    if (!upstream.ok || !reply) return res.status(502).json({ error: 'The AI coach did not return a response.' });
    return res.status(200).json({ reply, model: MODEL });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'AI coach request failed.' });
  }
};
