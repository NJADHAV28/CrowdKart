// AI layer via the router.bynara.id OpenAI-compatible gateway (Gemini models).
// The API key is read from AI_API_KEY in .env and is never hardcoded.
// Privacy: only anonymous matching metadata is ever sent; never names, addresses or cart items.
import { config, aiEnabled } from './config.js';

export async function chat(messages, { maxTokens = 300, temperature = 0.4 } = {}) {
  if (!aiEnabled()) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.apiKey}` },
      body: JSON.stringify({ model: config.ai.model, messages, max_tokens: maxTokens, temperature }),
      signal: ctl.signal,
    });
    if (!res.ok) {
      console.warn('[ai] router error', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const j = await res.json();
    return j.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn('[ai] request failed:', e.message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Explain a match + delivery decision using only anonymous metadata. */
export async function explainGroup(meta) {
  const out = await chat([
    {
      role: 'system',
      content:
        'You write short, plain status notes for CrowdKart, a group-ordering app. In 1-2 friendly sentences (max 40 words) tell the customer why their order was grouped with neighbours and how it will be delivered. No jargon, no scores, no technical terms, no names or products. Use the rupee symbol for money.',
    },
    { role: 'user', content: JSON.stringify(meta) },
  ]);
  return { text: out || fallbackExplanation(meta), source: out ? `ai:${config.ai.model}` : 'rules' };
}

function fallbackExplanation(m) {
  const who = m.participants > 1 ? `${m.participants} neighbours near you ordered within a few minutes of each other.` : 'You started this order.';
  const save = m.deliverySaved > 0 ? ` Together you save about ₹${m.deliverySaved} on delivery.` : '';
  return `${who} ${m.plan.reason}${save}`;
}
