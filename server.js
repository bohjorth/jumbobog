const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');

const app = express();
const PORT = 8080;

const COVER_DIR = path.join(__dirname, 'covers');

// sørg for folder findes
if (!fs.existsSync(COVER_DIR)) {
    fs.mkdirSync(COVER_DIR);
}

// download funktion (SAFE)
function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        try {
            const parsed = new URL(url); // 💥 her fejlede du før

            https.get(parsed, (res) => {
                if (res.statusCode !== 200) {
                    return reject('HTTP ' + res.statusCode);
                }

                const file = fs.createWriteStream(filepath);
                res.pipe(file);

                file.on('finish', () => {
                    file.close(resolve);
                });

            }).on('error', reject);

        } catch (err) {
            reject(err);
        }
    });
}

// fallback billede
function createFallback(filepath) {
    fs.writeFileSync(filepath, '');
}

// FIX: håndter relative URLs
function fixUrl(url, base) {
    if (!url) return null;

    if (url.startsWith('http')) return url;

    if (url.startsWith('/')) {
        return base + url;
    }

    return null;
}

// hent cover
async function getRealCover(id) {
    const file = path.join(COVER_DIR, `${id}.jpg`);

    if (fs.existsSync(file) && fs.statSync(file).size > 0) {
        return file;
    }

    try {
        // ⚠️ skift denne base hvis du scraper andet site
        const base = 'https://jumbobog.dk';

        // fake eksempel – her skal din rigtige scraping være
        let imageUrl = '/resources/assets/logo.png';

        imageUrl = fixUrl(imageUrl, base);

        if (!imageUrl) throw 'Invalid image URL';

        await downloadFile(imageUrl, file);

        return file;

    } catch (err) {
        console.log('Cover fejl:', err);

        createFallback(file);
        return file;
    }
}

// API
app.get('/api/cover/:id', async (req, res) => {
    const file = await getRealCover(req.params.id);

    res.sendFile(file);
});

// test route
app.get('/', (req, res) => {
    res.send('Jumbobog API kører');
});

app.listen(PORT, () => {
    console.log('Running on ' + PORT);
});