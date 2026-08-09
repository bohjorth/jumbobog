const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;

http.createServer((req,res)=>{
  let file = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(__dirname, file);

  fs.readFile(filePath, (err,data)=>{
    if(err){
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
}).listen(port, ()=>console.log("Running on "+port));
