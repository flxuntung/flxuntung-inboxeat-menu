const L = require("./_lib");

// GET /api/image?url=...  Proxies a generated image so the browser can draw it on a canvas.
const ALLOWED = /(^|\.)(cdnpk\.net|freepik\.com|magnific\.com|freepikcompany\.com|googleapis\.com|googleusercontent\.com|amazonaws\.com|cloudfront\.net|r2\.dev)$/i;

module.exports = async (req, res) => {
  if (!L.checkPassword(req, res)) return;
  try {
    const u = new URL(req.url, "http://x").searchParams.get("url") || "";
    let target;
    try { target = new URL(u); } catch (e) { return L.json(res, 400, { error: "URL inválida." }); }
    if (target.protocol !== "https:" || !ALLOWED.test(target.hostname)) {
      return L.json(res, 400, { error: "Origen no permitido." });
    }
    const r = await fetch(target.toString());
    if (!r.ok) return L.json(res, 502, { error: "No se pudo descargar la imagen (" + r.status + ")." });
    const buf = Buffer.from(await r.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", r.headers.get("content-type") || "image/png");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.end(buf);
  } catch (e) {
    L.json(res, 500, { error: e.message || String(e) });
  }
};
