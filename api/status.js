const L = require("./_lib");

// GET /api/status?id=TASK_ID
module.exports = async (req, res) => {
  if (!L.checkPassword(req, res)) return;
  try {
    const url = new URL(req.url, "http://x");
    const id = (url.searchParams.get("id") || "").trim();
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return L.json(res, 400, { error: "Identificador inválido." });
    const data = await L.freepik(`/text-to-image/${L.modelPath()}/${id}`, { method: "GET" });
    const task = (data && data.data) || data || {};
    const generated = Array.isArray(task.generated) ? task.generated : [];
    L.json(res, 200, {
      taskId: id,
      status: String(task.status || (generated.length ? "COMPLETED" : "IN_PROGRESS")).toUpperCase(),
      images: generated,
    });
  } catch (e) {
    L.json(res, 500, { error: e.message || String(e) });
  }
};
