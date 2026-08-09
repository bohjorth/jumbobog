const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(express.static(__dirname));

// REAL cover attempt using Open Library (uses ID as seed but real cover infra)
app.get('/api/cover/:id', (req, res) => {
    const id = req.params.id;

    // Try OpenLibrary cover API (uses numeric seed as ISBN-like)
    const url = `https://covers.openlibrary.org/b/id/${1000000 + parseInt(id) * 10}-L.jpg`;

    res.redirect(url);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Running on ' + PORT);
});
