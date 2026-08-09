try { require('dotenv').config(); } catch (e) { /* dotenv is optional; systemd sets env vars in production */ }

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;
const COVERS_DIR = path.join(__dirname, 'covers');

if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR);

app.use(express.json());
app.use('/covers', express.static(COVERS_DIR));
app.use(express.static(__dirname)); // serves index.html

// --- Get list of already-saved covers ---
app.get('/api/covers', (req, res) => {
  const files = fs.readdirSync(COVERS_DIR).filter(f => f.endsWith('.jpg'));
  res.json(files.map(f => ({ id: f.replace('.jpg', ''), url: '/covers/' + f })));
});

// --- Server-side image search via Serper.dev (stable Google Images API) ---
// Get a free API key at https://serper.dev (2,500 free searches, no card required)
// and set it as an environment variable before starting the server:
//   Windows (PowerShell):  $env:SERPER_API_KEY="din-nøgle-her"
//   Mac/Linux:             export SERPER_API_KEY="din-nøgle-her"
const SERPER_API_KEY = process.env.SERPER_API_KEY;

// Simple in-memory cache so re-visiting a book doesn't spend a search credit again.
const searchCache = new Map();

async function serperImageSearch(query) {
  if (!SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY mangler. Sæt miljøvariablen SERPER_API_KEY med din nøgle fra serper.dev, og genstart serveren.');
  }
  if (searchCache.has(query)) return searchCache.get(query);

  const res = await fetch('https://google.serper.dev/images', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query, num: 6 })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Serper-søgning fejlede (status ${res.status}). ${body}`.trim());
  }

  const data = await res.json();
  const results = (data.images || []).slice(0, 6).map(img => ({
    image: img.imageUrl,
    thumbnail: img.thumbnailUrl,
    title: img.title
  }));

  searchCache.set(query, results);
  return results;
}

app.get('/api/search/:num', async (req, res) => {
  const num = req.params.num;
  try {
    const results = await serperImageSearch(`Jumbobog ${num} cover`);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Save chosen cover ---
app.post('/api/save', async (req, res) => {
  const { id, url } = req.body;

  if (!id || !/^[a-zA-Z0-9_-]+$/.test(String(id))) {
    return res.status(400).json({ error: 'Ugyldigt id' });
  }
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Ugyldig URL' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Kunne ikke hente billedet (status ' + response.status + ')');
    const arrayBuffer = await response.arrayBuffer();
    const filePath = path.join(COVERS_DIR, id + '.jpg');
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    res.json({ success: true, url: '/covers/' + id + '.jpg' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Delete a saved cover (in case you change your mind) ---
app.delete('/api/save/:id', (req, res) => {
  const id = req.params.id;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return res.status(400).json({ error: 'Ugyldigt id' });
  const filePath = path.join(COVERS_DIR, id + '.jpg');
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('Server kører på http://localhost:' + PORT));
