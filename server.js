const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8080;
const dataFile = path.join(__dirname, 'data.json');

function serveFile(res, filePath, type="text/html"){
  fs.readFile(filePath, (err,data)=>{
    if(err){ res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, {"Content-Type": type});
    res.end(data);
  });
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

  let file = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(__dirname, file);
  let ext = path.extname(filePath);

  let types = {".js":"text/javascript",".css":"text/css",".json":"application/json",".jpg":"image/jpeg",".png":"image/png"};
  serveFile(res, filePath, types[ext] || "text/html");

}).listen(port, ()=>console.log("Running on "+port));
