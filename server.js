const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(express.json());
app.use('/covers', express.static(path.join(__dirname, 'covers')));

// get existing covers
app.get('/api/covers', (req, res) => {
  const dir = path.join(__dirname, 'covers');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
  res.json(files.map(f => ({ id: f.replace('.jpg',''), url: '/covers/' + f })));
});

// save chosen cover
app.post('/api/save', async (req, res) => {
  const { id, url } = req.body;
  const https = require('https');

  const file = fs.createWriteStream(path.join(__dirname, 'covers', id + '.jpg'));
  https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      res.json({ success: true });
    });
  }).on('error', err => {
    res.status(500).json({ error: err.message });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('Server kører på ' + PORT));
