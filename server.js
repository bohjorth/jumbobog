// Jumbobog-samling — simpel Express-server med JSON-fil som datalager.
// Ingen database-server nødvendig; alt gemmes i data/collection.json.

const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "collection.json");

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
    entries[n] = {
      title: SEED_TITLES[n] || "",
      edition: "",
      condition: "",
      owned: false,
      notes: "",
    };
  }
  return { entries, extras: [], totalBooks: TOTAL_BOOKS };
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
    // Udvid hvis TOTAL_BOOKS er hævet siden sidst
    const base = defaultData();
    parsed.entries = { ...base.entries, ...parsed.entries };
    parsed.extras = parsed.extras || [];
    parsed.totalBooks = TOTAL_BOOKS;
    return parsed;
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
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/state", (req, res) => {
  res.json(data);
});

app.patch("/api/entries/:num", (req, res) => {
  const num = parseInt(req.params.num, 10);
  if (!data.entries[num]) return res.status(404).json({ error: "Ukendt nummer" });
  const allowed = ["title", "edition", "condition", "owned", "notes"];
  for (const key of allowed) {
    if (key in req.body) data.entries[num][key] = req.body[key];
  }
  saveData();
  res.json(data.entries[num]);
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
