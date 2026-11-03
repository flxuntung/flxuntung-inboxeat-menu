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

// Toy-brick dioramas per theme. Each call picks a random scene, camera, light and extra detail,
// so repeated generations for the same theme stay on topic but look different.
const THEME_TOY = {
  lactosa: {
    bg: "soft almond cream (#efe7da)",
    scenes: [
      "a cheerful brick-built dairy cow wearing tiny sunglasses lounging in a deck chair, taking the day off, next to a chef figure holding a glass of oat milk",
      "a barista figure behind a tiny café counter frothing oat milk, a brick-built cow peeking in through the window with a curious smile",
      "a cow figure relaxing in a small inflatable pool with a cocktail umbrella, while a chef figure carries a carton of almond milk past",
      "a farmer figure and a cow on a tiny meadow waving goodbye to an old milk churn being carried away on a little cart",
      "a chef figure pouring a creamy plant-based sauce from a jug into a pan, a cow figure giving a thumbs up from behind a fence",
      "a cow figure reading a newspaper on a park bench under a small tree, a chef figure nearby whisking oat cream in a bowl",
    ],
  },
  marisco: {
    bg: "pale sea blue (#dce8ee)",
    scenes: [
      "a fisherman figure in a yellow raincoat standing in a small wooden boat, proudly holding up a big prawn, a crab and a fish on deck",
      "a diver figure in a vintage brass helmet on the sea floor, collecting mussels and clams into a basket, small fish swimming around",
      "a fisherman figure on a tiny wooden pier hauling up a net full of prawns, mussels and a surprised octopus",
      "a chef figure on a small beach grilling prawns on a little barbecue next to a striped parasol and a lifebuoy",
      "a lighthouse keeper figure at the foot of a small red and white lighthouse holding a lobster, waves made of transparent blue bricks",
      "two fisherman figures in a little rowing boat pulling a giant crab out of the water, splashes of transparent blue bricks",
    ],
  },
  gluten: {
    bg: "warm sand (#f3e2c0)",
    scenes: [
      "a farmer figure in a straw hat standing in a small Valencian rice field holding a sack of rice, a tiny barraca cottage behind",
      "a farmer figure driving a tiny tractor through golden rice paddies, a heron figure standing in the water",
      "a chef figure stirring a giant paella pan over a small wood fire, rice, saffron and rabbit pieces in the pan",
      "a farmer figure in a small flat-bottomed boat gliding through a flooded rice field at sunset, reeds around",
      "a miller figure next to a small windmill pouring rice and corn into sacks, a little donkey waiting with a cart",
      "a farmer figure harvesting golden rice with a sickle, a stack of rice bundles beside him and a small scarecrow",
    ],
  },
  vegetariano: {
    bg: "soft sage green (#e2e6cf)",
    scenes: [
      "a gardener figure with a watering can tending a small vegetable garden with tomatoes, artichokes, peppers and lettuces",
      "a market vendor figure behind a tiny striped market stall piled with colourful vegetables, a customer figure choosing an aubergine",
      "a gardener figure pushing a wheelbarrow full of giant pumpkins and carrots past a small greenhouse",
      "a chef figure harvesting herbs from a raised wooden bed, basil, rosemary and mint growing around",
      "a farmer figure on a ladder picking oranges from a small orange tree, baskets of fruit and leeks on the ground",
      "a gardener figure sitting on a giant brick-built tomato, having a picnic with a tiny basket of vegetables",
    ],
  },
  freaky: {
    bg: "warm peach (#f5d6c8)",
    scenes: [
      "a party figure in a disco wig dancing on a tiny stage under a mirror ball, carrying a tray of finger food, confetti in the air",
      "a DJ figure with headphones behind tiny turntables, a waiter figure on roller skates serving mini skewers",
      "a chef figure in sunglasses juggling small tapas and mini burgers, colourful balloons floating around",
      "a party bus with figures waving out of the windows, one holding a tray of tiny canapés, streamers flying",
      "a magician figure pulling a tray of finger food out of a top hat, a surprised waiter figure next to him",
      "figures in party hats around a tiny round table loaded with mini tacos and croquettes, a cake with sparklers in the middle",
    ],
  },
  cocido: {
    bg: "dusty rose (#ecd3cf)",
    scenes: [
      "a chef figure in a white hat stirring a big clay pot of hearty stew with a long wooden spoon, chickpeas, a carrot and a sausage beside the pot",
      "a grandmother figure in an apron tasting the stew from a wooden spoon next to a cast-iron stove, steam rising",
      "two chef figures carrying a huge steaming pot between them on wooden poles, chickpeas rolling on the ground",
      "a family of figures sitting around a small wooden table sharing bowls of stew, a big pot in the middle",
      "a chef figure in a cosy winter kitchen with a fireplace, a pot simmering, strings of chorizo hanging from the ceiling",
      "a market figure carrying a basket of chickpeas, cabbage, carrots and chorizo towards a little stall with a big pot",
    ],
  },
  none: {
    bg: "warm off-white",
    scenes: [
      "a smiling chef figure in a white hat presenting a small covered serving dish",
      "a waiter figure with a towel over the arm carrying a tray with a small bell-shaped dish cover",
      "a chef figure tasting from a spoon next to a little stove with two pots",
    ],
  },
};

const VARIANCE = {
  camera: [
    "seen from a low three-quarter angle",
    "seen slightly from above at a 45 degree angle",
    "seen straight from the front at eye level with the figures",
    "seen from a gentle high angle, almost top-down",
    "seen from a three-quarter angle from the left",
    "seen from a three-quarter angle from the right",
  ],
  light: [
    "soft warm morning light from the left",
    "bright clean midday studio light",
    "warm golden late-afternoon light from the right with long soft shadows",
    "soft overcast diffused light",
    "gentle rim light from behind with a soft fill from the front",
  ],
  detail: [
    "a tiny seagull or bird figure somewhere in the scene",
    "a small cat figure watching from the side",
    "a little potted plant on the base",
    "a tiny sign-free crate or barrel as an extra prop",
    "a small dog figure wagging its tail",
    "no extra detail, keep it very clean",
    "a few loose bricks lying casually on the base",
  ],
  base: [
    "on a small round base",
    "on a small square base",
    "on a slim oval base",
    "on an irregular natural-shaped base",
  ],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function buildPrompt(en, theme) {
  const d = en.map((s) => String(s || "").trim()).filter(Boolean);
  if (!d.length) return "";
  const t = THEME_TOY[theme] || THEME_TOY.none;
  const scene = pick(t.scenes), camera = pick(VARIANCE.camera), light = pick(VARIANCE.light), detail = pick(VARIANCE.detail), base = pick(VARIANCE.base);
  return `Charming toy photography of a small diorama built from plastic building bricks, centred in a wide landscape frame: ${scene}. Extra touch: ${detail}. The figures are classic toy-brick minifigures with simple painted faces and lively, characterful expressions and poses.

Composition: the diorama sits in the centre ${base}, ${camera}, with calm empty space around it. Seamless, plain studio background in ${t.bg}, the same colour from edge to edge, no horizon line, no props outside the diorama.

Look: high-end macro product photography, glossy plastic with realistic reflections, ${light}, soft shadow under the base, shallow depth of field, crisp focus on the main figure, clean and minimal, playful but stylish. Make this scene feel fresh and different, with its own composition and storytelling.

No text, letters, numbers, logos or brand names anywhere, no printed labels on the bricks, no packaging.`;
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
