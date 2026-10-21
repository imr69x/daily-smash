// Génère docs/ : version statique du site pour GitHub Pages (menu lu depuis menu.json, sans administration).
// Usage : npm run build:static   (puis commit + push de docs/)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(ROOT, "docs");
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "menu.json"), "utf8"));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function copy(rel) {
  const src = path.join(PUBLIC, rel), dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}
copy("css/style.css");
copy("js/app.js");
copy("assets");

// uploads : uniquement ceux réellement utilisés par le menu
for (const p of data.products) {
  if (p.image && p.image.startsWith("/uploads/") && fs.existsSync(path.join(ROOT, "public", p.image))) copy(p.image.slice(1));
}

let html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
html = html.replace('<script src="js/app.js"></script>', '<script>window.DS_STATIC = true;</script>\n  <script src="js/app.js"></script>');
fs.writeFileSync(path.join(OUT, "index.html"), html);
fs.writeFileSync(path.join(OUT, "menu.json"), JSON.stringify(data, null, 2));
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
console.log("docs/ généré :", fs.readdirSync(OUT).join(", "));
