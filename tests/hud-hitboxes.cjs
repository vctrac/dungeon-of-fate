const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=http.createServer((q,r)=>fs.readFile(path.join(root,q.url==='/'?'index.html':q.url),(err,data)=>{r.setHeader('Content-Type',q.url.endsWith('.png')?'image/png':q.url.endsWith('.js')?'application/javascript':'text/html');r.writeHead(err?404:200).end(data)}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER});const context=await browser.newContext({isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const touch=await context.newCDPSession(page);
 const close=()=>page.locator('#itemChoice').tap({position:{x:3,y:3}});
 for(const [width,height] of [[320,568],[360,800],[390,844],[430,932],[568,320],[844,390]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{const t=__dofTest;t.newRun();for(const id of ['eye','blood','doll']){t.acquireTrinket(id);t.closeItemCard()}t.setConsumable('coin');t.useConsumable(true);t.setConsumable('ward');t.useConsumable(true);t.setConsumable('bargain');t.useConsumable(true);t.setConsumable('flask');t.setVitals(2,false)});
  for(const stress of [false,true]){
   await page.evaluate(stress=>{document.querySelector('#game').style.padding=stress?'7px 28px 27px':' ';const a=document.querySelector('#footer>.codexAccess');a.style.fontSize=stress?'13.5px':'';a.textContent=stress?'ARCHIVE +':'ARCHIVE'},stress);
   const geometry=await page.evaluate(()=>{const buttons=[...document.querySelectorAll('#trinkets button'),document.querySelector('#consumableSlot'),document.querySelector('#footer>.codexAccess')];const bounds=buttons.map(b=>b.getBoundingClientRect().toJSON());let overlaps=0;for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];if(Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top))overlaps++}const slot=bounds[3];let intercepted=0;for(let x=slot.left+1;x<slot.right;x+=3)for(let y=slot.top+1;y<slot.bottom;y+=3)if(document.elementFromPoint(x,y)?.closest('.codexAccess'))intercepted++;return{bounds,overlaps,intercepted,scroll:document.documentElement.scrollWidth,centers:buttons.map((b,i)=>document.elementFromPoint(bounds[i].x+bounds[i].width/2,bounds[i].y+bounds[i].height/2)===b)}});
   assert.equal(geometry.overlaps,0);assert.equal(geometry.intercepted,0);assert(geometry.centers.every(Boolean));assert(geometry.scroll<=width);for(const b of geometry.bounds)assert(b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height);assert.equal(geometry.bounds[3].width,44);assert.equal(geometry.bounds[3].height,44);assert.equal(geometry.bounds[4].width,64);assert.equal(geometry.bounds[4].height,44);assert(geometry.bounds[4].left-geometry.bounds[3].right>=8);
   // Hit the formerly obstructed right side, using real touch input.
   const s=geometry.bounds[3];await page.touchscreen.tap(s.right-4,s.y+s.height/2);assert.equal(await page.locator('#itemName').innerText(),'Healing Flask');assert(await page.locator('#codexOverlay').isHidden());await close();
   await page.mouse.move(s.right-4,s.y+s.height/2);await page.mouse.down();await page.waitForTimeout(120);await page.mouse.up();assert.equal(await page.evaluate(()=>__dofTest.state().relics.consumable),'flask');assert(await page.locator('#itemChoice').isVisible());await close();
   await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:s.right-4,y:s.y+s.height/2}]});await page.waitForTimeout(610);await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});assert.equal(await page.evaluate(()=>__dofTest.state().relics.consumable),null);assert.equal(await page.evaluate(()=>__dofTest.state().hp),3);assert(await page.locator('#codexOverlay').isHidden());
   await page.evaluate(()=>{__dofTest.setConsumable('flask');__dofTest.setVitals(2,false)});
   const a=geometry.bounds[4];await page.touchscreen.tap(a.left+4,a.y+a.height/2);assert(await page.locator('#codexOverlay').isVisible());await page.locator('#codexBack').tap();assert.equal(await page.evaluate(()=>__dofTest.state().relics.consumable),'flask');
   // The 8px gap belongs to neither control.
   await page.mouse.click((s.right+a.left)/2,s.y+s.height/2);assert(await page.locator('#codexOverlay').isHidden());assert(await page.locator('#itemChoice').isHidden());
   for(const id of ['eye','blood','doll']){await page.locator('.trinket[data-item="'+id+'"]').tap();assert.equal(await page.evaluate(()=>__dofTest.state().cards.active.id),id);await close()}
  }
  await page.evaluate(()=>{document.querySelector('#game').style.padding='';document.querySelector('#footer>.codexAccess').style.fontSize='';document.querySelector('#footer>.codexAccess').textContent='ARCHIVE'});
  await page.screenshot({path:'/tmp/hud-'+width+'.png'});console.log('PASS',width+'×'+height,'bounds, touch hit-testing, tap/partial/full hold, Archive, boundary gap, 3 Trinkets; enlarged label + simulated safe areas');
 }
 assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
