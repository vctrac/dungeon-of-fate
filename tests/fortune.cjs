const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>fs.readFile(path.join(root,req.url==='/'?'index.html':req.url),(err,data)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/html');res.writeHead(err?404:200).end(data)}));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER?{executablePath:process.env.PWA_BROWSER}:{})});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(require('./fortune-checks.cjs')
 );
 assert.deepEqual(errors,[]);console.log('PASS Fortune/economy',JSON.stringify(result));
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
