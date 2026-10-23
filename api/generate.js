const L = require("./_lib");

// POST /api/generate  { dishes: [{es, en}], aspect: "3:2" }
// Translates missing English lines, builds the prompt and starts a Freepik task.
module.exports = async (req, res) => {
  if (req.method !== "POST") return L.json(res, 405, { error: "Method not allowed" });
  if (!L.checkPassword(req, res)) return;
  try {
    const body = await L.readBody(req);
    const dishes = (Array.isArray(body.dishes) ? body.dishes : [])
      .map((d) => ({ es: String(d.es || "").trim().slice(0, 120), en: String(d.en || "").trim().slice(0, 120) }))
      .filter((d) => d.es || d.en)
      .slice(0, 6);
    if (!dishes.length) return L.json(res, 400, { error: "Añade al menos un plato." });

    const missing = dishes.filter((d) => !d.en && d.es);
    if (missing.length) {
      const tr = await L.translate(missing.map((d) => d.es));
      missing.forEach((d, i) => { d.en = tr[i] || ""; });
    }
    const prompt = L.buildPrompt(dishes.map((d) => d.en || d.es));
    const aspect = L.ASPECT[body.aspect] || L.ASPECT["3:2"];

    const payload = {
      prompt,
      aspect_ratio: aspect,
      resolution: L.env("IMAGE_RESOLUTION", "1K").toUpperCase(),
    };
    // Style reference: the illustration the restaurant chose, served from this app.
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const styleRef = L.env("STYLE_REFERENCE", "off") === "on" && host
      ? [{ image: `https://${host}/style-ref.jpg`, mime_type: "image/jpeg",
           text: "Style reference only: copy the drawing technique, paper background, color palette, black tableware and composition style. Do not copy these dishes." }]
      : null;
    let data;
    try {
      data = await L.freepik(`/text-to-image/${L.modelPath()}`, {
        method: "POST",
        body: JSON.stringify(styleRef ? { ...payload, reference_images: styleRef } : payload),
      });
    } catch (e) {
      if (!styleRef || (e.status && e.status !== 400 && e.status !== 422)) throw e;
      data = await L.freepik(`/text-to-image/${L.modelPath()}`, { method: "POST", body: JSON.stringify(payload) });
    }
    const task = (data && data.data) || data || {};
    const taskId = task.task_id || task.id;
    if (!taskId) return L.json(res, 502, { error: "Freepik no devolvió un identificador de tarea.", detail: data });
    const generated = Array.isArray(task.generated) ? task.generated : [];
    L.json(res, 200, {
      taskId,
      status: String(task.status || "CREATED").toUpperCase(),
      images: generated,
      dishes,
      prompt,
    });
  } catch (e) {
    L.json(res, e.status === 401 || e.status === 403 ? 502 : 500, { error: e.message || String(e) });
  }
};
