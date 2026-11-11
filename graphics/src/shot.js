const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{const dir=path.resolve(__dirname);const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.html')&&x.startsWith(process.argv[2]||'n'))){await p.goto('file://'+dir+'/'+f);await p.waitForTimeout(300);await p.screenshot({path:path.resolve(dir,'..',f.replace('.html','.png'))});}
await b.close();})();
