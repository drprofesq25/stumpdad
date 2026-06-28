// StumpDad — Express server
// Serves the built React app and proxies trivia generation to Google Gemini.
// The API key lives ONLY on the server (env), never in the browser bundle.

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Minimal .env loader (no dependency) ---
(() => {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !(m[1] in process.env)) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (e) {
    console.warn('[stumpdad] .env load skipped:', e.message);
  }
})();

const PORT = process.env.PORT || 8088;

// --- Provider selection -------------------------------------------------
// Use Claude if an Anthropic key is present, else Gemini. Force with PROVIDER.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const PROVIDER =
  (process.env.PROVIDER || (ANTHROPIC_KEY ? 'anthropic' : GEMINI_KEY ? 'gemini' : 'none')).toLowerCase();
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MODEL = PROVIDER === 'anthropic' ? ANTHROPIC_MODEL : GEMINI_MODEL;
const HAS_KEY = PROVIDER === 'anthropic' ? Boolean(ANTHROPIC_KEY) : PROVIDER === 'gemini' ? Boolean(GEMINI_KEY) : false;

const app = express();
app.use(express.json({ limit: '256kb' }));

// --- Health check ---
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, provider: PROVIDER, model: MODEL, hasKey: HAS_KEY, time: new Date().toISOString() });
});

// --- Difficulty guidance for the model ---
const DIFFICULTY = {
  Kids: 'Aimed at children roughly ages 6-10. Simple wording, short answers, common knowledge, encouraging. Absolutely nothing scary or adult.',
  Medium: 'A fun pub-quiz level. Most adults could get many right.',
  Hard: 'Genuinely challenging. Rewards real enthusiasts of the topic.',
  Expert: 'Deep-cut, niche, tournament-level difficulty for true experts.',
};

function buildPrompt({ difficulty, kidSafe, slots, avoid = [] }) {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.Medium;
  const seed = Math.floor(Math.random() * 1e6);
  const facets =
    'Across the whole set, deliberately vary the angle from question to question: history, geography, notable people, landmarks, sports, economy, food, nature, and surprising little-known facts. Strongly favor lesser-known specifics over the single most obvious fact. For a narrow topic (a small town, a niche hobby, a specific person), dig for genuine deep cuts — dates, names, numbers, firsts, odd details — rather than the one thing everyone already knows.';
  const avoidBlock =
    Array.isArray(avoid) && avoid.length
      ? `\nALREADY ASKED — do NOT repeat, reuse, or lightly reword any of these. Make genuinely different questions:\n${avoid
          .slice(-60)
          .map((q) => `- ${String(q).slice(0, 140)}`)
          .join('\n')}\n`
      : '';
  const safety = kidSafe
    ? 'CRITICAL: Every question and answer MUST be 100% family-friendly and safe for young children. No violence, gore, sexual content, drugs, profanity, slurs, gambling, or disturbing themes. If a requested topic could go dark, keep it light and age-appropriate.'
    : 'Keep content tasteful and free of explicit, hateful, or graphic material.';

  const slotLines = slots
    .map((s, i) => {
      const topics = Array.isArray(s.topics) && s.topics.length ? s.topics.join(', ') : 'general knowledge';
      return `${i + 1}. Topic pool: ${topics}`;
    })
    .join('\n');

  return `You are a trivia question writer for a family game show called StumpDad.
Generate EXACTLY ${slots.length} trivia questions, one for each numbered slot below, in the same order.

Difficulty: ${difficulty}. ${diff}
${safety}

For each slot, pick ONE of the listed topics and write a question from it. Vary which topic you choose so a slot's questions feel fresh. Never repeat a question or answer within the set.

${facets}
Variety seed: ${seed} — use it to explore fresh angles you might not usually pick.
${avoidBlock}
Slots:
${slotLines}

Return ONLY a raw JSON array of ${slots.length} objects, in slot order, each shaped exactly:
{"category": string (the specific topic used, short), "question": string, "answer": string (concise, the canonical correct answer), "context": string (one short interesting fact that explains or expands the answer)}
No markdown, no commentary, no trailing text — just the JSON array.`;
}

function parseJsonLoose(text) {
  if (!text) throw new Error('Empty response from model');
  let cleaned = text.replace(/```json|```/g, '').trim();
  // If the model wrapped or prefixed the array, grab the outermost [...] span.
  const first = cleaned.indexOf('[');
  const last = cleaned.lastIndexOf(']');
  if (first !== -1 && last !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
  return JSON.parse(cleaned);
}

async function callGeminiOnce(prompt) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 1.0 },
      }),
    }
  );
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Gemini ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  return parseJsonLoose(data?.candidates?.[0]?.content?.parts?.[0]?.text);
}

async function callAnthropicOnce(prompt) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      temperature: 1.0,
      system:
        'You are a trivia question writer. Output ONLY a raw JSON array — no markdown, no prose, no code fences. Begin your reply with "[".',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Anthropic ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = await resp.json();
  const text = Array.isArray(data?.content) ? data.content.map((c) => c.text || '').join('') : '';
  return parseJsonLoose(text);
}

async function callModel(prompt, attempt = 0) {
  const delays = [800, 1600, 3200];
  try {
    if (PROVIDER === 'anthropic') return await callAnthropicOnce(prompt);
    return await callGeminiOnce(prompt);
  } catch (err) {
    if (attempt < delays.length) {
      await new Promise((r) => setTimeout(r, delays[attempt]));
      return callModel(prompt, attempt + 1);
    }
    throw err;
  }
}

// --- Trivia generation ---
app.post('/api/trivia', async (req, res) => {
  try {
    if (!HAS_KEY) {
      return res
        .status(500)
        .json({ error: 'Server has no AI key. Set ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY in .env.' });
    }
    const { difficulty = 'Medium', kidSafe = true, slots, avoid = [] } = req.body || {};
    if (!Array.isArray(slots) || slots.length === 0 || slots.length > 60) {
      return res.status(400).json({ error: 'Invalid slots payload.' });
    }

    const prompt = buildPrompt({ difficulty, kidSafe, slots, avoid });
    let questions = await callModel(prompt);

    if (!Array.isArray(questions)) {
      return res.status(502).json({ error: 'Model returned an unexpected shape.' });
    }

    // Align to slots: attach assignedTo/meta from the requesting slot by index.
    const out = slots.map((s, i) => {
      const q = questions[i] || {};
      return {
        category: String(q.category || (s.topics && s.topics[0]) || 'Trivia').slice(0, 60),
        question: String(q.question || 'Question unavailable — tap Skip.'),
        answer: String(q.answer || '—'),
        context: String(q.context || ''),
        assignedTo: s.target ?? null,
        slotIdx: s.idx ?? i,
      };
    });

    res.json({ questions: out });
  } catch (err) {
    console.error('[stumpdad] /api/trivia error:', err.message);
    res.status(502).json({ error: 'The question writer is overloaded. Try again in a moment.' });
  }
});

// --- Static frontend (built by `npm run build`) ---
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));

// SPA fallback (Express 4 — avoid "*" path-to-regexp issues by using a regex).
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexFile = path.join(distDir, 'index.html');
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
  res
    .status(503)
    .send('StumpDad is not built yet. Run "npm run build" then restart the server.');
});

app.listen(PORT, () => {
  console.log(
    `[stumpdad] listening on http://0.0.0.0:${PORT} (provider: ${PROVIDER}, model: ${MODEL}, key: ${HAS_KEY ? 'set' : 'MISSING'})`
  );
});
