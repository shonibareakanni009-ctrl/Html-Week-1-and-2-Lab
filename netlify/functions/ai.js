const MODEL = 'gemini-3.8-flash';

function responseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const blocks = Array.isArray(payload?.output) ? payload.output : [];
  return blocks.filter(block => block?.type === 'text' || typeof block?.text === 'string')
    .map(block => block.text || block.content || '').join('\n').trim();
}

exports.handler = async event => {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'POST required' }) };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'AI coach is not configured yet.' }) };
  try {
    const { message, challenge, code, history = [] } = JSON.parse(event.body || '{}');
    if (!message || typeof message !== 'string') return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'A message is required.' }) };
    const safeHistory = Array.isArray(history) ? history.slice(-8).map(item => ({ role: item.role === 'model' ? 'model' : 'user', content: String(item.content || '').slice(0, 1200) })) : [];
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
      body: JSON.stringify({ model: MODEL, system_instruction: 'You are a patient, Socratic HTML learning coach for school students.', input: prompt, generation_config: { thinking_level: 'low', temperature: 0.4, max_output_tokens: 350 } }),
    });
    const payload = await upstream.json().catch(() => ({}));
    const reply = responseText(payload);
    if (!upstream.ok || !reply) return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'The AI coach did not return a response.' }) };
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ reply, model: MODEL }) };
  } catch (error) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message || 'AI coach request failed.' }) };
  }
};
