require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "data", "menu.json");
const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const CATEGORIES = ["signature", "moment", "snacking", "kids", "frites", "supplements", "desserts"];
const PLATFORMS = ["ubereats", "facebook", "instagram", "tiktok", "snapchat", "x", "youtube", "whatsapp", "maps", "website", "other"];
const CURSOR_STYLES = ["classic", "bite", "smash"];
const CURSOR_SIZES = ["s", "m", "l"];

if (!ADMIN_PASSWORD) {
  console.warn(
    "\n[Daily Smash] ATTENTION : aucun ADMIN_PASSWORD défini dans .env.\n" +
    "L'administration est DÉSACTIVÉE (toutes les routes /api/admin répondent 503) tant qu'un mot de passe n'est pas défini.\n" +
    "Copiez .env.example vers .env et choisissez un mot de passe.\n"
  );
}

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---- stockage : un fichier JSON (suffisant pour un seul snack ; pas une vraie base de données :
//      pas de transactions, la dernière écriture gagne. Voir README pour migrer vers SQLite/Postgres.) ----
let writeQueue = Promise.resolve();
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
function writeData(data) {
  writeQueue = writeQueue.then(() => {
    const tmp = DATA_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmp, DATA_FILE);
  });
  return writeQueue;
}

// ---- authentification : HTTP Basic vérifié à chaque requête admin, comparaison en temps constant,
//      blocage temporaire après trop d'échecs depuis une même IP. ----
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
const failures = new Map(); // ip -> { count, until }
const MAX_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: "admin_disabled" });
  const f = failures.get(req.ip);
  if (f && f.until > Date.now()) return res.status(429).json({ error: "too_many_attempts" });

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const sep = decoded.indexOf(":"); // le mot de passe peut contenir ":"
    const user = sep === -1 ? decoded : decoded.slice(0, sep);
    const pass = sep === -1 ? "" : decoded.slice(sep + 1);
    const okUser = safeEqual(user, ADMIN_USER);
    const okPass = safeEqual(pass, ADMIN_PASSWORD);
    if (okUser && okPass) { failures.delete(req.ip); return next(); }
  }
  const cur = failures.get(req.ip) || { count: 0, until: 0 };
  cur.count += 1;
  if (cur.count >= MAX_FAILS) { cur.until = Date.now() + LOCK_MS; cur.count = 0; }
  failures.set(req.ip, cur);
  // Pas d'en-tête WWW-Authenticate : on ne veut pas de boîte de dialogue native du navigateur.
  return res.status(401).json({ error: "unauthorized" });
}

// ---- validation ----
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
function cleanUrl(v) {
  const s = str(v, 400);
  if (!s) return "";
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch (e) { return null; }
}
function cleanImage(v) {
  if (v == null || v === "") return null;
  const s = String(v);
  return /^\/(uploads|assets)\/[A-Za-z0-9._\/-]+$/.test(s) && !s.includes("..") ? s : undefined;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif" }[file.mimetype] || "";
      cb(null, crypto.randomBytes(16).toString("hex") + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.mimetype);
    cb(ok ? null : new Error("unsupported_type"), ok);
  }
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ---- API publique (lecture seule) ----
app.get("/api/menu", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(readData());
});

// ---- API admin ----
app.get("/api/admin/ping", requireAdmin, (req, res) => res.json({ ok: true }));

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const data = readData();
  const b = req.body || {};
  if (!CATEGORIES.includes(b.category)) return res.status(400).json({ error: "invalid_category" });
  const name = str(b.name, 120);
  if (!name) return res.status(400).json({ error: "name_required" });
  const price = Number(b.price);
  if (!isFinite(price) || price < 0) return res.status(400).json({ error: "invalid_price" });
  const image = cleanImage(b.image);
  if (image === undefined) return res.status(400).json({ error: "invalid_image" });
  const product = {
    id: crypto.randomBytes(6).toString("hex"), category: b.category, name,
    desc: str(b.desc, 400), note: str(b.note, 400), price: Math.round(price * 100) / 100,
    image, active: true,
    order: Math.max(0, ...data.products.filter((p) => p.category === b.category).map((p) => p.order || 0)) + 1
  };
  data.products.push(product);
  writeData(data);
  res.status(201).json(product);
});

app.patch("/api/admin/products/:id", requireAdmin, (req, res) => {
  const data = readData();
  const p = data.products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "not_found" });
  const b = req.body || {};
  if (b.name != null) { const n = str(b.name, 120); if (!n) return res.status(400).json({ error: "name_required" }); p.name = n; }
  if (b.desc != null) p.desc = str(b.desc, 400);
  if (b.note != null) p.note = str(b.note, 400);
  if (b.price != null) {
    const price = Number(b.price);
    if (!isFinite(price) || price < 0) return res.status(400).json({ error: "invalid_price" });
    p.price = Math.round(price * 100) / 100;
  }
  if (b.active != null) {
    if (p.core && !b.active) return res.status(400).json({ error: "signature_always_active" });
    p.active = !!b.active;
  }
  if (b.image !== undefined) {
    const image = cleanImage(b.image);
    if (image === undefined) return res.status(400).json({ error: "invalid_image" });
    p.image = image;
  }
  writeData(data);
  res.json(p);
});

app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  const data = readData();
  const p = data.products.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "not_found" });
  if (p.core) return res.status(400).json({ error: "signature_fixed" });
  data.products = data.products.filter((x) => x.id !== p.id);
  writeData(data);
  res.status(204).end();
});

// Mise à jour partielle : seules les sections présentes dans le corps sont remplacées.
app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const data = readData();
  const s = data.settings = data.settings || {};
  const b = req.body || {};
  if (b.banner) {
    s.banner = { enabled: !!b.banner.enabled, text: str(b.banner.text, 200) };
  }
  if (b.cursor) {
    s.cursor = {
      enabled: !!b.cursor.enabled,
      style: CURSOR_STYLES.includes(b.cursor.style) ? b.cursor.style : "classic",
      size: CURSOR_SIZES.includes(b.cursor.size) ? b.cursor.size : "m"
    };
  }
  if (b.info) {
    s.info = { address: str(b.info.address, 200), phone: str(b.info.phone, 40) };
  }
  if (b.hours) {
    const d = b.hours.days;
    const T = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!Array.isArray(d) || d.length !== 7) return res.status(400).json({ error: "invalid_hours" });
    const days = [];
    for (const x of d) {
      if (x && x.closed) { days.push({ closed: true, open: "", close: "" }); continue; }
      if (!x || !T.test(x.open) || !T.test(x.close) || x.open >= x.close) return res.status(400).json({ error: "invalid_hours" });
      days.push({ closed: false, open: x.open, close: x.close });
    }
    s.hours = { days, note: str(b.hours.note, 200) };
  }
  if (b.socials) {
    if (!Array.isArray(b.socials) || b.socials.length > 20) return res.status(400).json({ error: "invalid_socials" });
    const out = [];
    for (const x of b.socials) {
      const url = cleanUrl(x && x.url);
      if (!url) return res.status(400).json({ error: "invalid_url" });
      out.push({
        id: str(x.id, 40) || crypto.randomBytes(4).toString("hex"),
        platform: PLATFORMS.includes(x.platform) ? x.platform : "other",
        label: str(x.label, 40),
        url
      });
    }
    s.socials = out;
  }
  writeData(data);
  res.json(s);
});

app.post("/api/admin/upload", requireAdmin, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message === "unsupported_type" ? "unsupported_type" : "upload_failed" });
    if (!req.file) return res.status(400).json({ error: "no_file" });
    res.status(201).json({ url: "/uploads/" + req.file.filename });
  });
});

app.listen(PORT, () => console.log(`Daily Smash — http://localhost:${PORT}`));
