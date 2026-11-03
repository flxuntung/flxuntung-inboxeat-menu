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

// The two owners of Inboxeat as toy-brick minifigures. They appear in every scene.
const PERICO = "PERICO, the male owner and chef: a classic yellow toy-brick minifigure with short, messy curly dark-brown hair sticking out at the sides, a black-and-cream trucker cap with a small square orange-and-white patch on the front (abstract emblem, no lettering), black rectangular glasses, a big warm open-mouthed smile with friendly smile lines, a black double-breasted chef jacket with white piping and two rows of white buttons, a black apron tied at the waist, black legs";
const MARIA = "MARIA, the female owner and chef: a classic yellow toy-brick minifigure with black hair pulled back into a low braided bun with a red ribbon bow on the side, warm brown eyes with lashes, a red-lipped smile, a small beauty mark on her cheek, pearl stud earrings and a pearl necklace, a black double-breasted chef jacket with white piping and white buttons, black trousers and bright yellow sneakers";
const MARIA_CASUAL = "MARIA, the female owner, in her party outfit: a classic yellow toy-brick minifigure with long wavy dark-brown hair, yellow sunglasses, a confident smile with red lips, a black-and-white striped tank top, black shorts with white stripes and bright yellow sneakers";

// Toy-brick dioramas per theme, always starring Perico and Maria.
// Each call picks a random scene, camera, light and extra detail, so repeated generations stay on topic but look different.
const THEME_TOY = {
  lactosa: {
    bg: "soft almond cream (#efe7da)",
    scenes: [
      "a brick-built dairy cow with tiny sunglasses lounging in a deck chair, taking the day off, while Perico hands her a glass of oat milk and Maria laughs beside them",
      "Perico behind a tiny café counter frothing oat milk, Maria serving a cup to a curious cow peeking in through the window",
      "a cow relaxing in a small inflatable pool with a cocktail umbrella, Perico and Maria carrying a big carton of almond milk past her",
      "Perico and Maria on a tiny meadow waving goodbye to an old milk churn being carried away on a little cart by a happy cow",
      "Maria pouring a creamy plant-based sauce from a jug into a pan held by Perico, a cow giving a thumbs up from behind a fence",
      "a cow reading a newspaper on a park bench, Perico and Maria next to her whisking oat cream in a big bowl",
    ],
  },
  marisco: {
    bg: "pale sea blue (#dce8ee)",
    scenes: [
      "Perico and Maria in a small wooden boat, Perico proudly holding up a giant prawn while Maria holds a crab, a fish on deck",
      "Perico in a vintage brass diving helmet on the sea floor handing mussels to Maria, who collects them in a basket from a tiny boat above",
      "Perico and Maria on a tiny wooden pier hauling up a net full of prawns, mussels and a surprised octopus",
      "Perico grilling prawns on a little beach barbecue while Maria relaxes under a striped parasol holding a lemon",
      "Perico and Maria at the foot of a small red-and-white lighthouse, Maria holding up a lobster, waves of transparent blue bricks",
      "Perico and Maria in a little rowing boat pulling a giant crab out of the water together, splashes of transparent blue bricks",
    ],
  },
  gluten: {
    bg: "warm sand (#f3e2c0)",
    scenes: [
      "Perico in a straw hat over his cap carrying a sack of rice through a small Valencian rice field, Maria waving from a tiny barraca cottage",
      "Perico driving a tiny tractor through golden rice paddies with Maria sitting on the back, a heron standing in the water",
      "Perico stirring a giant paella pan over a small wood fire while Maria adds saffron, rice and rabbit pieces in the pan",
      "Perico punting a small flat-bottomed boat through a flooded rice field at sunset, Maria sitting in front holding a basket of rice",
      "Perico and Maria next to a small windmill filling sacks with rice and corn, a little donkey waiting with a cart",
      "Maria harvesting golden rice with a sickle while Perico stacks the rice bundles, a small scarecrow watching",
    ],
  },
  vegetariano: {
    bg: "soft sage green (#e2e6cf)",
    scenes: [
      "Perico with a watering can and Maria with a basket tending a small vegetable garden with tomatoes, artichokes, peppers and lettuces",
      "Maria behind a tiny striped market stall piled with colourful vegetables, Perico choosing an aubergine with a big grin",
      "Perico pushing a wheelbarrow full of giant pumpkins and carrots past a small greenhouse, Maria riding on top of the pumpkins",
      "Perico and Maria harvesting herbs from a raised wooden bed, basil, rosemary and mint growing around them",
      "Maria on a ladder picking oranges from a small orange tree, Perico below catching them in a basket next to a pile of leeks",
      "Perico and Maria sitting on a giant brick-built tomato having a picnic with a tiny basket of vegetables",
    ],
  },
  freaky: {
    bg: "warm peach (#f5d6c8)",
    party: true,
    scenes: [
      "Maria dancing on a tiny stage under a mirror ball while Perico carries a tray of finger food, confetti in the air",
      "Maria as DJ with headphones behind tiny turntables, Perico on roller skates serving mini skewers",
      "Perico in sunglasses juggling small tapas and mini burgers, Maria cheering with a glass, colourful balloons floating around",
      "Perico driving a tiny party bus with Maria waving out of the window holding a tray of canapés, streamers flying",
      "Perico as a magician pulling a tray of finger food out of a top hat, Maria clapping in surprise",
      "Perico and Maria in party hats at a tiny round table loaded with mini tacos and croquettes, a cake with sparklers in the middle",
    ],
  },
  cocido: {
    bg: "dusty rose (#ecd3cf)",
    scenes: [
      "Perico stirring a big clay pot of hearty stew with a long wooden spoon while Maria tastes from a ladle, chickpeas, a carrot and a sausage beside the pot",
      "Maria tasting the stew from a wooden spoon next to a cast-iron stove, Perico giving a thumbs up, steam rising",
      "Perico and Maria carrying a huge steaming pot between them on wooden poles, chickpeas rolling on the ground",
      "Perico and Maria sitting at a small wooden table sharing bowls of stew, a big pot in the middle",
      "Perico and Maria in a cosy winter kitchen with a fireplace, a pot simmering, strings of chorizo hanging from the ceiling",
      "Maria carrying a basket of chickpeas, cabbage, carrots and chorizo towards Perico, who stands at a little stall with a big pot",
    ],
  },
  none: {
    bg: "warm off-white",
    scenes: [
      "Perico and Maria side by side presenting a small covered serving dish, both smiling",
      "Perico carrying a tray with a bell-shaped dish cover while Maria lifts the lid",
      "Perico tasting from a spoon next to a little stove with two pots while Maria holds up a kitchen torch",
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
  return `Charming toy photography of a small diorama built from plastic building bricks, centred in a wide landscape frame: ${scene}. Extra touch: ${detail}.

The two main characters must be clearly recognisable and appear exactly once each, with these exact features (match the character reference images when given):
- ${PERICO}.
- ${t.party ? MARIA_CASUAL : MARIA}.
Keep them as genuine toy-brick minifigures (blocky torso, cylindrical head, C-shaped hands, printed face details), not realistic people. Any other figures or animals are small side characters.

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

module.exports = {
  characterRefs: (theme) => (THEME_TOY[theme] && THEME_TOY[theme].party) ? ["ref-perico.jpg", "ref-maria-casual.jpg"] : ["ref-perico.jpg", "ref-maria.jpg"], env, modelPath, json, checkPassword, readBody, freepik, ASPECT, buildPrompt, translate };
