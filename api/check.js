const L = require("./_lib");

// GET /api/check  Verifies the password and reports server configuration (no secrets).
module.exports = async (req, res) => {
  if (!L.checkPassword(req, res)) return;
  L.json(res, 200, {
    ok: true,
    model: L.modelPath(),
    resolution: L.env("IMAGE_RESOLUTION", "1K").toUpperCase(),
    freepikKey: !!L.env("FREEPIK_API_KEY", ""),
    translator: L.env("ANTHROPIC_API_KEY", "") ? "anthropic" : "mymemory",
  });
};
