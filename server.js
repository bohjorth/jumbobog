const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

// serve static files (index.html)
app.use(express.static(__dirname));

// API – always returns an image (no crash)
app.get('/api/cover/:id', (req, res) => {
    const id = req.params.id;
    res.redirect(`https://via.placeholder.com/200x300?text=Jumbo+${id}`);
});

// root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Running on ' + PORT);
});
