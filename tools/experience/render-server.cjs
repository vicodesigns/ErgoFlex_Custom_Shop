#!/usr/bin/env node
// Static server for headless renders: no live reload (writes under exports/
// can't reload the stage mid-render) and HTTP Range support (media textures
// must seek frame-accurately during bakes).
//   node tools/experience/render-server.cjs [port=3017]
const http=require('http'),path=require('path'),send=require('send');
const root=path.resolve(__dirname,'..','..'),port=Number(process.argv[2])||3017;
http.createServer((req,res)=>{
  send(req,decodeURIComponent(new URL(req.url,'http://x').pathname),{root,index:['index.html'],dotfiles:'deny'})
    .on('error',e=>{res.statusCode=e.status||500;res.end();})
    .pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`render server http://127.0.0.1:${port} → ${root}`));
