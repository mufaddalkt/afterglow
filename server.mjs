import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'};
http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(file===root)file=path.join(root,'index.html');fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(err?'Not found':data);});}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
