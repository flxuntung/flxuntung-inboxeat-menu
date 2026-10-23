// Shared helpers for the serverless functions.

const FREEPIK_BASE = process.env.MAGNIFIC_API_BASE || "https://api.magnific.com/v1/ai";

function env(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

// Magnific (formerly Freepik) model path under /v1/ai/text-to-image/.
// Nano Banana Pro = "nano-banana-pro".
function modelPath() {
  return env("FREEPIK_MODEL", "nano-banana-pro");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function checkPassword(req, res) {
  const expected = env("APP_PASSWORD", "");
  if (!expected) {
    json(res, 500, { error: "APP_PASSWORD no está configurada en el servidor." });
    return false;
  }
  const given = req.headers["x-app-password"] || "";
  if (given !== expected) {
    json(res, 401, { error: "Contraseña incorrecta." });
    return false;
  }
  return true;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function freepik(path, init = {}) {
  const key = env("FREEPIK_API_KEY", "") || env("MAGNIFIC_API_KEY", "");
  if (!key) throw new Error("FREEPIK_API_KEY no está configurada en el servidor.");
  const r = await fetch(FREEPIK_BASE + path, {
    ...init,
    headers: {
      "x-magnific-api-key": key,
      "x-freepik-api-key": key,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  if (!r.ok) {
    const msg = (data && (data.message || data.error || data.title)) || text || r.statusText;
    const err = new Error(`Magnific ${r.status}: ${String(msg).slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  return data;
}

// Nano Banana Pro aspect ratios.
const ASPECT = { "3:2": "3:2", "1:1": "1:1", "4:5": "4:5", "9:16": "9:16", "16:9": "16:9", "4:3": "4:3" };

const WORDS = ["", "single-dish", "two-course", "three-course", "four-course", "five-course", "six-course"];

function buildPrompt(en) {
  const d = en.map((s) => String(s || "").trim()).filter(Boolean);
  if (!d.length) return "";
  const list = d.length > 1 ? d.slice(0, -1).join("; ") + "; and " + d[d.length - 1] : d[0];
  const kind = WORDS[d.length] || d.length + "-course";
  const n = d.length;
  const numbered = d.map((x, k) => `${k + 1}. ${x}`).join("; ");
  return `Overhead editorial food illustration for the daily menu of a chef-run Spanish bistro in Valencia, the kind of place with a Bib Gourmand: honest, seasonal market cooking executed with finesse. ${n} courses, each shown exactly once on its own plate or bowl: ${numbered}.

The plating is what a talented chef would send out today: elegant and precise but warm and natural, never fussy. Real ingredients you can identify, cooked properly: a proper sear, a glossy emulsion spooned beside rather than over, fresh herbs and flowers placed with intention, a few drops of good olive oil, contrasting textures, generous yet composed portions with negative space on the plate. Colours come from the food itself: deep caramelisation, bright greens, ripe fruit, rich sauces. Every dish looks mouth-watering.

Tableware: handmade stoneware in warm natural tones (cream, sand, speckled grey, one deep terracotta), varied shapes and sizes, on a light linen tablecloth. Only a few quiet props: a linen napkin, a small glass of water, a bit of bread, a sprig of herbs. Arrange the plates in a calm, balanced layout that fills the frame, all plates fully visible.

Style: refined hand-painted illustration in gouache and watercolour with fine pencil and ink detailing, like a high-end cookbook or a New Yorker food feature. Soft natural daylight from the side, delicate shadows, subtle paper texture. Clearly painted, not photographic. No text, no lettering, no hands, no people.`;
}

// "Vegetable Soup" -> "Vegetable soup"; words capitalized in the Spanish source (Sacher, Spätzle) keep their capital.
function sentenceCase(t, src) {
  const keep = new Set(String(src || "").split(/\s+/).filter((w) => /^[A-ZÀ-Ý]/.test(w)).map((w) => w.toLowerCase().replace(/[^\p{L}]/gu, "")));
  return t.split(" ").map((w, i) => {
    const bare = w.toLowerCase().replace(/[^\p{L}]/gu, "");
    if (i === 0 || keep.has(bare)) return w.charAt(0).toUpperCase() + w.slice(1);
    return /^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w;
  }).join(" ");
}
// Translate Spanish dish names to short English menu lines.
// Uses the Anthropic API when ANTHROPIC_API_KEY is set, otherwise MyMemory (free, literal).
async function translate(esList) {
  const items = esList.map((s) => String(s || "").trim());
  if (!items.length) return [];
  const akey = env("ANTHROPIC_API_KEY", "");
  if (akey) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": akey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env("ANTHROPIC_MODEL", "claude-haiku-5-5"),
          max_tokens: 400,
          messages: [{
            role: "user",
            content:
              `Translate these Spanish dish names from a daily lunch menu in Valencia into short, natural English lines as printed on a bilingual menu card. Keep proper dish names (Involtini, Panna cotta, Quesabirria, Spätzle) and use "&" for "con"/"y" where natural. Examples: "Crema de hinojo con azafrán" -> "Fennel & saffron"; "Lasaña de espinaca y pesto" -> "Spinach & pesto lasagna"; "Postre de mango" -> "Mango dessert". Reply with ONLY a JSON array of strings, same order and length as the input.\nInput: ${JSON.stringify(items)}`,
          }],
        }),
      });
      const data = await r.json();
      const text = (data.content || []).map((c) => c.text || "").join("");
      const m = text.match(/\[[\s\S]*\]/);
      const arr = m ? JSON.parse(m[0]) : null;
      if (Array.isArray(arr) && arr.length === items.length) return arr.map(String);
    } catch (e) { /* fall through */ }
  }
  // Fallback: MyMemory, one request per line.
  const out = [];
  for (const s of items) {
    if (!s) { out.push(""); continue; }
    try {
      const u = "https://api.mymemory.translated.net/get?langpair=es|en&q=" + encodeURIComponent(s);
      const r = await fetch(u);
      const d = await r.json();
      let t = (d.responseData && d.responseData.translatedText) || "";
      if (!t || /MYMEMORY WARNING|QUERY LENGTH/i.test(t)) t = "";
      out.push(sentenceCase(t.replace(/\s+with\s+/gi, " & ").replace(/\s+and\s+/gi, " & "), s));
    } catch (e) { out.push(""); }
  }
  return out;
}

module.exports = { env, modelPath, json, checkPassword, readBody, freepik, ASPECT, buildPrompt, translate };
