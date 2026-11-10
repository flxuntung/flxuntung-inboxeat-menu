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
    if (!dishes.length && body.theme !== "cerrado") return L.json(res, 400, { error: "Añade al menos un plato." });

    const missing = dishes.filter((d) => !d.en && d.es);
    if (missing.length) {
      const tr = await L.translate(missing.map((d) => d.es));
      missing.forEach((d, i) => { d.en = tr[i] || ""; });
    }
    const theme = /^[a-z]{2,20}$/.test(String(body.theme || "")) ? body.theme : "none";
    const prompts = L.buildPrompt(dishes.map((d) => d.en || d.es), theme);
    // Character references: the two owners as minifigures, served from this app.
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const refs = host && L.env("CHARACTER_REFERENCE", "on") !== "off"
      ? L.characterRefs(theme).map((f) => ({
          image: `https://${host}/${f}`, mime_type: "image/jpeg",
          text: f.includes("perico") ? "Character reference for PERICO: keep his face, glasses, cap and black chef outfit. Facial hair: only a faint three-day stubble, never a goatee, moustache or full beard. Keep his dark-brown hair clearly visible under the cap, just a bit shorter than in this reference: ear-length, falling around his ears. He is never bald or shaved."
               : "Character reference for MARIA: keep her face, braided bun with red ribbon, beauty mark, pearls, black chef outfit and yellow sneakers exactly as shown." }))
      : null;
    // Two pictures of the same scene: 16:9 for the story, 4:5 for the post. Each is shown whole, never cropped.
    const start = async (prompt, aspect) => {
      const payload = { prompt, aspect_ratio: aspect, resolution: L.env("IMAGE_RESOLUTION", "1K").toUpperCase() };
      let data;
      try {
        data = await L.freepik(`/text-to-image/${L.modelPath()}`, { method: "POST", body: JSON.stringify(refs ? { ...payload, reference_images: refs } : payload) });
      } catch (e) {
        if (!refs || (e.status && e.status !== 400 && e.status !== 422)) throw e;
        data = await L.freepik(`/text-to-image/${L.modelPath()}`, { method: "POST", body: JSON.stringify(payload) });
      }
      const task = (data && data.data) || data || {};
      return { id: task.task_id || task.id, task, data };
    };
    const [w, t] = await Promise.all([start(prompts.wide, "16:9"), start(prompts.tall, "4:5")]);
    const task = w.task, taskId = w.id, data = w.data, prompt = prompts.wide;
    if (!taskId || !t.id) return L.json(res, 502, { error: "Freepik no devolvió un identificador de tarea.", detail: data });
    const generated = Array.isArray(task.generated) ? task.generated : [];
    L.json(res, 200, {
      taskId,
      taskIdPost: t.id,
      status: String(task.status || "CREATED").toUpperCase(),
      images: generated,
      dishes,
      prompt,
    });
  } catch (e) {
    L.json(res, e.status === 401 || e.status === 403 ? 502 : 500, { error: e.message || String(e) });
  }
};
