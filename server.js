const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

app.use(express.static(__dirname));

// smarter cover source (tries real-like pattern, fallback if missing)
app.get('/api/cover/:id', (req, res) => {
    const id = req.params.id;

    // Attempt a more "realistic" cover pattern (example source pattern)
    const realUrl = `https://picsum.photos/seed/jumbo${id}/200/300`;

    res.redirect(realUrl);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Running on ' + PORT);
});
