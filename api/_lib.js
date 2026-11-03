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

// Abstract fine art per theme, like the paintings that hang in a Michelin-starred dining room.
// Strictly non-figurative: mood, material and colour only, so nothing suggests what the food looks like.
const THEME_ART = {
  lactosa: {
    palette: "almond cream (#efe7da), warm ivory, pale stone and a single quiet stroke of dusty blue (#3d5a80)",
    mood: "stillness and lightness, like morning light on limestone",
    gesture: "soft veils of translucent colour layered over each other, one long, calm horizontal brush stroke in dusty blue",
  },
  marisco: {
    palette: "pale sea mist (#dce8ee), deep petrol blue (#2f5d7c), wet sand and a hairline of silver",
    mood: "the calm depth of the Mediterranean at dawn",
    gesture: "a broad horizon of layered blue washes that dissolve into each other, a few fine silver-grey lines drifting like currents",
  },
  gluten: {
    palette: "warm sand (#f3e2c0), saffron, raw sienna, burnt umber (#9a6224) and a touch of gold leaf",
    mood: "late summer heat over the fields of Valencia",
    gesture: "a large glowing field of saffron and sand fading into each other, one textured band of sienna, a small fleck of gold leaf",
  },
  vegetariano: {
    palette: "soft sage (#e2e6cf), olive (#5f6b33), moss green, pale celadon and warm linen",
    mood: "the quiet of a garden after rain",
    gesture: "overlapping translucent green glazes with soft edges, one confident dark olive brush mark, fine dry-brush texture",
  },
  freaky: {
    palette: "peach (#f5d6c8), coral, terracotta (#bf5236), deep plum and a flash of gold",
    mood: "joyful, surprising, celebratory, with an edge",
    gesture: "a few bold, energetic sweeping brush strokes crossing each other, splashes and drips used sparingly, one small accent of gold leaf",
  },
  cocido: {
    palette: "dusty rose (#ecd3cf), deep wine red (#7c2f2b), smoked paprika, ochre gold and warm umber",
    mood: "slow, deep warmth on a winter day, generosity and tradition",
    gesture: "deep layered glazes of wine red and paprika, rich and velvety, softening into dusty rose, a fine scatter of ochre gold pigment",
  },
  none: {
    palette: "warm off-white, raw linen, soft grey and a single muted terracotta accent",
    mood: "calm and quiet",
    gesture: "soft layered washes and one fine ink line",
  },
};

function buildPrompt(en, theme) {
  const d = en.map((s) => String(s || "").trim()).filter(Boolean);
  if (!d.length) return "";
  const art = THEME_ART[theme] || THEME_ART.none;
  return `A refined, purely abstract contemporary painting, the kind of original artwork that hangs in the dining room of a Michelin-starred restaurant. Wide landscape format.

Strictly non-figurative: no objects, no food, no pots, plates, bowls, cutlery, steam, fruit, vegetables, shells, leaves, sun, people or recognisable shapes of any kind. No text, letters, numbers, signatures or symbols.

Mood: ${art.mood}.
Gesture and composition: ${art.gesture}.
Colour palette: ${art.palette}. The lightest tone is the ground colour of the whole canvas.

Technique: museum-quality mixed media on heavy cotton paper: layered translucent oil and acrylic glazes, mineral pigments, subtle plaster or gesso texture, visible brush marks and dry-brush edges, delicate depth. Inspired by Mark Rothko's colour fields, Helen Frankenthaler's soak-stain washes, Antoni Tàpies' material textures and Japanese wabi-sabi restraint. Sophisticated, quiet, expensive-looking, with generous negative space and a single clear focal area.

The painting fills the whole frame edge to edge, no border, no frame, no wall, no gallery setting, shot flat and evenly lit like a fine art reproduction.`;
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
