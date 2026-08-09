const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const port = 8080;
const dataFile = path.join(__dirname, 'data.json');
const coverDir = path.join(__dirname, 'covers');

if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir);

function serveFile(res, filePath, type="text/html"){
  fs.readFile(filePath, (err,data)=>{
    if(err){ res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, {"Content-Type": type});
    res.end(data);
  });
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function getRealCover(id, res) {
  const file = path.join(coverDir, id + '.jpg');

  if (fs.existsSync(file)) {
    return serveFile(res, file, "image/jpeg");
  }

  try {
    const url = `https://comicwiki.dk/wiki/Jumbobog_${id}`;
    const html = await fetchPage(url);

    const matches = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)];
    if (!matches.length) throw "no image";

    let imgUrl = matches.find(m => m[1].includes('Jumbobog'))?.[1] || matches[0][1];

    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    } else if (imgUrl.startsWith('/')) {
      imgUrl = 'https://comicwiki.dk' + imgUrl;
    } else if (!imgUrl.startsWith('http')) {
      throw "invalid image url";
    }

    await downloadFile(imgUrl, file);
    return serveFile(res, file, "image/jpeg");

  } catch (e) {
    console.log("Cover fallback:", id);
    res.writeHead(302, {
      Location: `https://picsum.photos/300/450?random=${id}`
    });
    return res.end();
  }
}

http.createServer((req,res)=>{

  if(req.url === '/api/jumbo' && req.method === 'GET'){
    fs.readFile(dataFile, (err,data)=>{
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(data);
    });
    return;
  }

  if(req.url === '/api/jumbo' && req.method === 'POST'){
    let body="";
    req.on('data', chunk => body+=chunk);
    req.on('end', ()=>{
      fs.writeFileSync(dataFile, body);
      res.writeHead(200);
      res.end("OK");
    });
    return;
  }

  if(req.url.startsWith('/api/cover/')){
    const id = req.url.split('/').pop();
    return getRealCover(id, res);
  }

  let file = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(__dirname, file);
  let ext = path.extname(filePath);

  let types = {
    ".js":"text/javascript",
    ".css":"text/css",
    ".json":"application/json",
    ".jpg":"image/jpeg",
    ".png":"image/png"
  };

  serveFile(res, filePath, types[ext] || "text/html");

}).listen(port, ()=>console.log("Running on "+port));
