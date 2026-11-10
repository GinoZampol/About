const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const root=__dirname,types={'.js':'text/javascript','.html':'text/html','.woff2':'font/woff2'};
const srv=http.createServer((q,s)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){s.writeHead(404);s.end();return}s.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});s.end(d)})}).listen(0,async()=>{
 const port=srv.address().port;const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:2000,height:1400}});p.on('console',m=>console.log('[page]',m.text()));p.on('pageerror',e=>console.log('[err]',e.message));
 await p.goto(`http://localhost:${port}/index.html?${process.argv[3]||''}`);await p.waitForFunction('window.done',null,{timeout:180000});
 await p.screenshot({path:process.argv[2]||'out.png'});
 if(process.argv[4]){const [x,y,w,h]=process.argv[4].split(',').map(Number);await p.screenshot({path:'crop.png',clip:{x,y,width:w,height:h}})}
 await b.close();srv.close();console.log('rendered')});
