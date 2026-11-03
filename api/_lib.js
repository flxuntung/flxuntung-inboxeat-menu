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

// Abstract artwork per theme. Colours match the card palette (Mediterráneo), so image and card read as one piece.
// The menu only inspires colour and texture: nothing recognisable as a plated dish, so no expectations about the food.
const THEME_ART = {
  lactosa: {
    palette: "almond cream (#efe7da), oat beige, soft dusty blue (#3d5a80) and a touch of warm white",
    motif: "light, airy and calm: soft overlapping rounded forms like smooth drifting clouds, one or two fine dusty-blue ink lines flowing through the space",
  },
  marisco: {
    palette: "pale sea blue (#dce8ee), deep petrol blue (#2f5d7c), sand and a small accent of lemon yellow",
    motif: "the rhythm of the Mediterranean: layered horizontal wave bands, an abstract spiral echoing a shell, a scatter of tiny salt-like dots",
  },
  gluten: {
    palette: "warm sand (#f3e2c0), saffron yellow, ochre and burnt sienna (#9a6224)",
    motif: "sun and fields near Valencia: a large warm circle, rhythmic vertical brush strokes like rows in a field, clusters of small grain-like dots",
  },
  vegetariano: {
    palette: "soft sage (#e2e6cf), olive green (#5f6b33), fresh leaf green and a little cream",
    motif: "a garden in cut paper: bold organic leaf shapes in the spirit of Matisse cut-outs, layered and overlapping, a few thin stems drawn in ink",
  },
  freaky: {
    palette: "peach (#f5d6c8), coral, terracotta (#bf5236) and a small accent of deep plum",
    motif: "playful and energetic: bold confetti-like geometric and organic shapes in lively rotation, a single loose squiggle line, a sense of party and surprise",
  },
  cocido: {
    palette: "dusty rose (#ecd3cf), deep wine red (#7c2f2b), smoked paprika, chickpea gold and a warm earthy brown",
    motif: "slow-cooked winter warmth: a large deep round form like a pot seen from above, gentle concentric rings, clusters of round golden chickpea-like dots, soft rising curls like steam",
  },
  none: {
    palette: "warm off-white, light oak, soft grey and a single muted terracotta accent",
    motif: "calm balanced abstract forms with a few fine ink lines",
  },
};

function buildPrompt(en, theme) {
  const d = en.map((s) => String(s || "").trim()).filter(Boolean);
  if (!d.length) return "";
  const art = THEME_ART[theme] || THEME_ART.none;
  const inspiration = d.join(", ");
  return `Minimalist abstract artwork, wide landscape composition. A purely visual painting with no text of any kind: no words, no letters, no numbers, no labels, no signage.

Theme and mood: ${art.motif}.
Colour palette, used with restraint and harmony: ${art.palette}. The lightest tone of the palette is the ground colour of the whole image, so the artwork blends seamlessly into a card of the same colour.

Today's menu (${inspiration}) is only a quiet source of inspiration for colour, rhythm and texture. Do not depict any food, plates, bowls, cutlery, glasses, tables, hands or people. Nothing should look like a real dish or a food photograph; the image must not suggest what the food will look like.

Style: contemporary fine art print, minimalist and elegant, in the spirit of Matisse cut-outs, Joan Miró's simplicity and modern Mediterranean poster art. Few large, confident shapes with clear edges, layered gouache and cut-paper textures, a handful of delicate ink lines, subtle grain of matte watercolour paper. Balanced, airy composition that fills the whole frame edge to edge with the ground colour, generous negative space, no border, no frame, no vignette.`;
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
