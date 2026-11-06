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
const PERICO = "PERICO, the male owner and chef: a classic yellow toy-brick minifigure with a fresh short haircut: very short, neatly trimmed dark-brown hair, cut close at the sides and back, no curls and nothing sticking out from under the cap, a black-and-cream trucker cap with a small square orange-and-white patch on the front (abstract emblem, no lettering), black rectangular glasses, a big warm open-mouthed smile with friendly smile lines, a black double-breasted chef jacket with white piping and two rows of white buttons, a black apron tied at the waist, black legs";
const MARIA = "MARIA, the female owner and chef: a classic yellow toy-brick minifigure with glossy black hair swept back into a low braided bun, a bright red ribbon bow on the right side of the bun, warm brown eyes with fine lashes, softly arched dark eyebrows, a warm natural smile with soft brown lips (no bright lipstick), light smile lines, a small beauty mark on her lower left cheek near the chin, small pearl stud earrings and a pearl necklace, a black double-breasted chef jacket with white piping and two rows of white buttons, black trousers and bright yellow sneakers with white soles and white laces";
const MARIA_CASUAL = MARIA + ", today with yellow sunglasses pushed up on her head for the party";

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
      "Perico grilling seafood from today's menu on a little beach barbecue while Maria relaxes under a striped parasol",
      "Perico and Maria at the foot of a small red-and-white lighthouse, Maria holding up a lobster, waves of transparent blue bricks",
      "Perico and Maria in a little rowing boat pulling a giant crab out of the water together, splashes of transparent blue bricks",
    ],
  },
  gluten: {
    bg: "warm sand (#f3e2c0)",
    scenes: [
      "Perico in a straw hat over his cap carrying a sack of rice through a small Valencian rice field, Maria waving from a tiny barraca cottage",
      "Perico driving a tiny tractor through golden rice paddies with Maria sitting on the back",
      "Perico stirring a giant paella pan over a small wood fire while Maria adds saffron, rice and rabbit pieces in the pan",
      "Perico punting a small flat-bottomed boat through a flooded rice field at sunset, Maria sitting in front holding a basket of rice",
      "Perico and Maria next to a small windmill filling sacks with rice and corn, a little wooden cart waiting",
      "Maria harvesting golden rice with a sickle while Perico stacks the rice bundles, a small scarecrow watching",
    ],
  },
  vegetariano: {
    bg: "soft sage green (#e2e6cf)",
    scenes: [
      "Perico with a watering can and Maria with a basket tending a small vegetable garden where today's menu ingredients are growing",
      "Maria behind a tiny striped market stall piled with today's menu ingredients, Perico choosing one with a big grin",
      "Perico pushing a wheelbarrow full of oversized ingredients from today's menu past a small greenhouse, Maria riding on top",
      "Perico and Maria harvesting from a raised wooden bed full of the vegetables and herbs of today's menu",
      "Maria and Perico at a little wooden kitchen table outdoors, chopping and preparing the vegetables of today's menu, a small pot simmering beside them",
      "Perico and Maria sitting on the giant brick-built main vegetable of today's menu, having a picnic",
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
      "Maria carrying a basket with the ingredients of today's menu towards Perico, who stands at a little stall with a big pot",
    ],
  },
  cerrado: {
    bg: "dark charcoal grey (#3a3b3d)",
    scifi: true,
    scenes: [
      "Perico and Maria as retro sci-fi space explorers closing the round hatch of their small spaceship, a little robot sidekick holding a tiny closed sign without letters",
      "Perico and Maria in space pilot suits relaxing on a small moon with a tiny campfire, their spaceship parked behind them, stars in the dark",
      "Perico and Maria floating in a small space station window, waving goodbye, a little round robot switching off the lights",
      "Perico and Maria in space suits sitting on a crate next to their parked spaceship, drinking from tiny cups, the ship's engines off",
      "Perico and Maria as space explorers on a dusty grey planet, planting a small flag without symbols next to their landed ship, a robot napping nearby",
      "Perico and Maria in space pilot suits asleep in two reclining pilot chairs inside a tiny cockpit, stars outside the window",
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
  // Valencian details: architecture and craft only, never food (no oranges), so the food stays the menu's
  valencia: [
    "a strip of blue-and-white Valencian ceramic tiles along the edge of the base",
    "a small palm tree in a terracotta pot",
    "a little terracotta jug and a woven esparto basket",
    "a small wrought-iron balcony railing with red geraniums",
    "a classic Valencian wicker chair",
    "green wooden window shutters on a small ochre wall",
    "a small modernist arched window with coloured glass",
    "an old-fashioned iron street lamp",
    "a little traditional wooden Albufera boat",
    "a hand-painted blue ceramic plate leaning against a wall",
  ],
  landmark: [
    "a miniature of the Torres de Serranos medieval city gate",
    "a miniature of the Miguelete bell tower of the cathedral",
    "a miniature of the domes and modernist arches of the Mercado Central",
    "a miniature of the white curved architecture of the City of Arts and Sciences",
    "a miniature Albufera barraca cottage with its steep thatched roof and reeds",
    "a miniature stretch of the Turia gardens with palm trees and an old stone bridge",
    "a miniature of the modernist Estación del Norte facade",
    "a miniature of the Lonja de la Seda gothic facade",
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
  if (!d.length && theme !== "cerrado") return "";
  const t = THEME_TOY[theme] || THEME_TOY.none;
  const scene = pick(t.scenes), camera = pick(VARIANCE.camera), light = pick(VARIANCE.light), base = pick(VARIANCE.base);
  const landmark = pick(VARIANCE.landmark);
  const v1 = pick(VARIANCE.valencia);
  let v2 = pick(VARIANCE.valencia); while (v2 === v1) v2 = pick(VARIANCE.valencia);
  return `Charming toy photography of a small diorama built from plastic building bricks, centred in a wide landscape frame: ${scene}. The scene clearly takes place in Valencia, Spain: at the back of the diorama stands ${landmark}, built from bricks, smaller than the figures' main action and slightly out of focus. Add two small Valencian details on the base: ${v1}, and ${v2}. Valencia is shown only through this architecture and these details, never through fruit or food. Warm Mediterranean feeling, natural and charming, no flags, no coats of arms, no patriotic symbols.${d.length && theme !== "cerrado" ? `\n\nTODAY'S MENU, very important: ${d.map((x) => `"${x}"`).join(", ")}. The food in this image comes from this menu. Pick the two or three most recognisable ingredients of these dishes (the first course "${d[0]}" first) and show them clearly as brick-built props that Perico and Maria hold, carry, cook or that sit prominently on the base, big enough to recognise at a glance. If the scene mentions food or "today\'s menu ingredients", use exactly these ingredients. Do not add any other fruit or food that is not part of today\'s menu: no oranges, lemons or other citrus unless the menu contains them.` : ""}

CAST, very important: there are exactly TWO minifigures in the whole image, Perico once and Maria once. Never show Perico twice, never show Maria twice, no clones, no reflections of them, no third person, no extra minifigures, no crowd, no waiters, customers or bystanders. No pets or incidental animals either (no dogs, cats, birds or seagulls); only animals that are part of the scene itself, such as seafood, are allowed.

The two characters must be clearly recognisable, with these exact features (match the character reference images when given):
- ${PERICO}.
- ${t.party ? MARIA_CASUAL : MARIA}.
${t.scifi ? "In this scene both wear original retro sci-fi space-explorer outfits (simple space suits in grey, white and dark blue, small helmets or headsets), while keeping their faces, Perico's glasses and very short hair and Maria's hairstyle recognisable. Generic original sci-fi design only: no lightsabers, no robes, no helmets, ships, droids or costumes from any existing film franchise.\n" : ""}Keep them as genuine toy-brick minifigures (blocky torso, cylindrical head, C-shaped hands, printed face details), not realistic people. Before finishing, count the minifigures: there must be exactly two, one Perico and one Maria.

Composition: the diorama sits in the centre ${base}, ${camera}, with calm empty space around it. Seamless, plain studio background in ${t.bg}, the same colour from edge to edge, no horizon line, no props outside the diorama.

Look: high-end macro product photography${t.scifi ? ", moody low-key lighting in dark greys with a few small cool blue light accents" : ""}, glossy plastic with realistic reflections, ${light}, soft shadow under the base, shallow depth of field, crisp focus on the main figure, clean and minimal, playful but stylish. Make this scene feel fresh and different, with its own composition and storytelling.

Exactly two minifigures in total. No text, letters, numbers, logos or brand names anywhere, no printed labels on the bricks, no packaging.`;
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
  characterRefs: () => ["ref-perico.jpg", "ref-maria.jpg"], env, modelPath, json, checkPassword, readBody, freepik, ASPECT, buildPrompt, translate };
