// Jumbobog-samling — simpel Express-server med JSON-fil som datalager.
// Ingen database-server nødvendig; alt gemmes i data/collection.json.

const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "collection.json");
const IMAGES_DIR = path.join(DATA_DIR, "images");

const TOTAL_BOOKS = 552; // ret op hvis der udkommer flere numre

// Bekræftede titler for de første 20 numre. Resten udfyldes af dig,
// enten manuelt eller via "Importér titler" i appen.
const SEED_TITLES = {
  1: "Onkel Joakims trillioner",
  2: "Onkel Joakims skattejagt",
  3: "Anders And i knibe…",
  4: "Anders And i topform",
  5: "Onkel Joakim jorden rundt",
  6: "Anders And og Bjørne-banden",
  7: "Onkel Joakim i hopla",
  8: "Anders And klarer ærterne",
  9: "Pas på pengene onkel Joakim",
  10: "Anders And vover livet",
  11: "Kvikke Mickey",
  12: "Onkel Joakim redder æren",
  13: "Anders And – den frygtløse ridder",
  14: "Rip, Rap og Rup gi'r aldrig op",
  15: "Onkel Joakim i perlehumør",
  16: "Bange Bjørnebanditter",
  17: "Stakkels onkel Anders",
  18: "Anders And fægter sig frem",
  19: "Anders Ands ønskedrøm",
  20: "Onkel Joakims glæder og sorger",
};

function defaultData() {
  const entries = {};
  for (let n = 1; n <= TOTAL_BOOKS; n++) {
    entries[n] = { title: SEED_TITLES[n] || "", copies: [] };
  }
  return { entries, extras: [], totalBooks: TOTAL_BOOKS };
}

// Migrerer et ældre entry-format ({title, edition, condition, owned, notes})
// til det nye ({title, copies: [...]}), så eksisterende data ikke går tabt.
function migrateEntry(old) {
  if (old && Array.isArray(old.copies)) return old;
  const copies = [];
  if (old && old.owned) {
    copies.push({
      id: Date.now() + Math.floor(Math.random() * 100000),
      oplaeg: "",
      edition: old.edition || "",
      condition: old.condition || "",
      notes: old.notes || "",
      image: "",
    });
  }
  return { title: (old && old.title) || "", copies };
}

function loadData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const initial = defaultData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const base = defaultData();
    const entries = { ...base.entries };
    for (const num in parsed.entries || {}) {
      entries[num] = migrateEntry(parsed.entries[num]);
    }
    return {
      entries,
      extras: parsed.extras || [],
      totalBooks: TOTAL_BOOKS,
    };
  } catch (e) {
    console.error("Kunne ikke læse data-fil, starter forfra:", e);
    return defaultData();
  }
}

let data = loadData();
let saveTimer = null;
function saveData() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => {
      if (err) console.error("Fejl ved gem:", err);
    });
  }, 250);
}

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(IMAGES_DIR));

function ensureImagesDir() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

function deleteImageFile(imagePath) {
  if (!imagePath) return;
  const filename = path.basename(imagePath);
  const full = path.join(IMAGES_DIR, filename);
  fs.unlink(full, () => {}); // ignorér fejl (fx allerede slettet)
}

app.get("/api/state", (req, res) => {
  res.json(data);
});

app.patch("/api/entries/:num", (req, res) => {
  const num = parseInt(req.params.num, 10);
  if (!data.entries[num]) return res.status(404).json({ error: "Ukendt nummer" });
  if ("title" in req.body) data.entries[num].title = req.body.title;
  saveData();
  res.json(data.entries[num]);
});

app.post("/api/entries/:num/copies", (req, res) => {
  const num = parseInt(req.params.num, 10);
  if (!data.entries[num]) return res.status(404).json({ error: "Ukendt nummer" });
  const copy = {
    id: Date.now() + Math.floor(Math.random() * 100000),
    oplaeg: req.body.oplaeg || "",
    edition: req.body.edition || "",
    condition: req.body.condition || "",
    notes: req.body.notes || "",
    image: "",
  };
  data.entries[num].copies.push(copy);
  saveData();
  res.json(copy);
});

app.patch("/api/entries/:num/copies/:copyId", (req, res) => {
  const num = parseInt(req.params.num, 10);
  const copyId = parseInt(req.params.copyId, 10);
  const entry = data.entries[num];
  if (!entry) return res.status(404).json({ error: "Ukendt nummer" });
  const copy = entry.copies.find((c) => c.id === copyId);
  if (!copy) return res.status(404).json({ error: "Ukendt eksemplar" });
  const allowed = ["oplaeg", "edition", "condition", "notes"];
  for (const key of allowed) if (key in req.body) copy[key] = req.body[key];
  saveData();
  res.json(copy);
});

app.delete("/api/entries/:num/copies/:copyId", (req, res) => {
  const num = parseInt(req.params.num, 10);
  const copyId = parseInt(req.params.copyId, 10);
  const entry = data.entries[num];
  if (!entry) return res.status(404).json({ error: "Ukendt nummer" });
  const existing = entry.copies.find((c) => c.id === copyId);
  if (existing && existing.image) deleteImageFile(existing.image);
  entry.copies = entry.copies.filter((c) => c.id !== copyId);
  saveData();
  res.json({ ok: true });
});

app.post("/api/entries/:num/copies/:copyId/image", (req, res) => {
  const num = parseInt(req.params.num, 10);
  const copyId = parseInt(req.params.copyId, 10);
  const entry = data.entries[num];
  if (!entry) return res.status(404).json({ error: "Ukendt nummer" });
  const copy = entry.copies.find((c) => c.id === copyId);
  if (!copy) return res.status(404).json({ error: "Ukendt eksemplar" });

  const dataUrl = req.body.dataUrl || "";
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "Ugyldigt billedformat" });
  const ext = match[2] === "jpeg" ? "jpg" : match[2];
  const buffer = Buffer.from(match[3], "base64");
  if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Billedet er for stort (maks 8 MB)" });

  ensureImagesDir();
  if (copy.image) deleteImageFile(copy.image);
  const filename = `n${num}-${copyId}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);
  copy.image = `/images/${filename}`;
  saveData();
  res.json({ image: copy.image });
});

app.delete("/api/entries/:num/copies/:copyId/image", (req, res) => {
  const num = parseInt(req.params.num, 10);
  const copyId = parseInt(req.params.copyId, 10);
  const entry = data.entries[num];
  if (!entry) return res.status(404).json({ error: "Ukendt nummer" });
  const copy = entry.copies.find((c) => c.id === copyId);
  if (!copy) return res.status(404).json({ error: "Ukendt eksemplar" });
  if (copy.image) deleteImageFile(copy.image);
  copy.image = "";
  saveData();
  res.json({ ok: true });
});

app.post("/api/import", (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  let applied = 0;
  for (const item of items) {
    const num = parseInt(item.num, 10);
    if (data.entries[num] && item.title) {
      data.entries[num].title = String(item.title).trim();
      applied++;
    }
  }
  saveData();
  res.json({ applied });
});

app.post("/api/extras", (req, res) => {
  const extra = {
    id: Date.now(),
    label: req.body.label || "",
    title: req.body.title || "",
    edition: req.body.edition || "",
    condition: req.body.condition || "",
    owned: req.body.owned !== undefined ? !!req.body.owned : true,
    notes: req.body.notes || "",
  };
  data.extras.push(extra);
  saveData();
  res.json(extra);
});

app.patch("/api/extras/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const extra = data.extras.find((x) => x.id === id);
  if (!extra) return res.status(404).json({ error: "Ukendt id" });
  const allowed = ["label", "title", "edition", "condition", "owned", "notes"];
  for (const key of allowed) {
    if (key in req.body) extra[key] = req.body[key];
  }
  saveData();
  res.json(extra);
});

app.delete("/api/extras/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  data.extras = data.extras.filter((x) => x.id !== id);
  saveData();
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Jumbobog-samling kører på http://0.0.0.0:${PORT}`);
});
