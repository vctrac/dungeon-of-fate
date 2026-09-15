// Run with Playwright installed. Set PWA_BROWSER to a Chromium executable if needed.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.display,'fullscreen');
for(const icon of manifest.icons){const png=fs.readFileSync(path.join(root,icon.src));assert.equal(png.readUInt32BE(16)+'x'+png.readUInt32BE(20),icon.sizes)}
for(const tag of ['viewport-fit=cover','apple-mobile-web-app-capable','apple-touch-icon','manifest.webmanifest','env(safe-area-inset-top)','env(safe-area-inset-bottom)','env(safe-area-inset-left)','env(safe-area-inset-right)','-webkit-touch-callout:none'])assert(html.includes(tag),tag);
const server=http.createServer((req,res)=>{
 let name=new URL(req.url,'http://localhost').pathname.replace(/^\/dungeon-of-fate/,'');if(!name||name==='/')name='/index.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.webmanifest')?'application/manifest+json':file.endsWith('.png')?'image/png':'text/plain');res.end(data)});
});
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/dungeon-of-fate/';
 browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER?{executablePath:process.env.PWA_BROWSER}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(()=>__dofTest.state());
 const clear=()=>page.evaluate(()=>{__dofTest.clearPending();__dofTest.clearFeedback()});
 await page.goto(url);await page.waitForTimeout(400);
 assert.match(await page.title(),/V2\.16/);assert.equal((await state()).hp,3);
 assert(await page.locator('.cell').count()>1);assert.match(await page.locator('#hp').innerText(),/❤️/);
 assert(await page.locator('#gold').innerText());assert.equal(await page.locator('.current').count(),1);
 console.log('PASS startup and PWA metadata');
 // The graph, neighbor reveal, and ordinary hint privacy.
 for(let run=0;run<15;run++){
  const result=await page.evaluate(()=>{
   __dofTest.newFloor();const s=__dofTest.state(),seen=new Set([s.startId]),q=[s.startId];
   for(let i=0;i<q.length;i++)for(const id of s.rooms[q[i]].links)if(!seen.has(id)){seen.add(id);q.push(id)}
   return{connected:seen.size===s.rooms.filter(r=>r.active).length,exit:seen.has(s.exitId),frontier:[...document.querySelectorAll('.frontier')].every(el=>el.querySelector('.icon').textContent==='?'&&!el.dataset.exactHint&&!el.querySelector('.event'))}
  });assert(result.connected&&result.exit&&result.frontier);
 }
 await page.waitForTimeout(400);
 let next=await page.evaluate(()=>{
  const s=__dofTest.state(),id=s.rooms[s.currentId].links.find(id=>id!==s.exitId);
  __dofTest.setRoomEvent(id,'empty');__dofTest.enter(id);return id;
 });
 await page.waitForTimeout(450);
 let s=await state();assert.equal(s.currentId,next);assert(s.rooms[next].links.every(id=>s.rooms[id].known));
 console.log('PASS connected maps, reachable exit, neighbor reveal, ambiguous frontier');
 // Feedback is tested at all nine anchor regions on phone and landscape sizes.
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(200);
  for(const [x,y] of [[45,45],[45,0],[45,92],[0,45],[92,45],[0,0],[92,0],[0,92],[92,92]]){
   await page.evaluate(({x,y})=>{
    __dofTest.clearFeedback();const id=__dofTest.state().currentId,cell=document.querySelector('.current');cell.style.left=x+'%';cell.style.top=y+'%';
    for(let i=0;i<4;i++)__dofTest.showFeedback(id,'+'+(i+1)+' 🪙','fate',i===3?'180 ×3.2 ✦':'✦ ×2.0',3000);
   },{x,y});
   await page.waitForTimeout(220);
   const result=await page.evaluate(()=>{
    const b=document.querySelector('#board').getBoundingClientRect(),els=[...document.querySelectorAll('.roomFeedback')],rects=els.map(el=>el.getBoundingClientRect());
    return{count:els.length,inside:rects.every(r=>r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom),separate:rects.every((r,i)=>rects.every((q,j)=>i===j||r.bottom<=q.top||q.bottom<=r.top||r.right<=q.left||q.right<=r.left)),newestLowest:rects[2].top>rects[1].top&&rects[1].top>rects[0].top};
   });
   assert.equal(result.count,3);assert(result.inside&&result.separate&&result.newestLowest,JSON.stringify({viewport,x,y,result}));
  }
 }
 await clear();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>__dofTest.update());await page.waitForTimeout(200);
 console.log('PASS feedback cap, order, clamping and non-overlap at center/edges/corners in 3 sizes');
 // Actual scavenge clue path; other tendencies are checked through the same reveal function.
 await page.evaluate(()=>{localStorage.setItem('dof.learnedScavenge','1');__dofTest.newFloor();__dofTest.scavenge(__dofTest.state().currentId,.9)});
 await page.waitForTimeout(250);
 s=await state();let clued=s.rooms.find(r=>r.clued);assert(clued&&clued.known&&!clued.searched);
 assert(await page.locator('.clue-reveal .clueRing').count());assert(await page.locator('.roomFeedback[data-room-id="'+clued.id+'"]').count());
 for(const [event,tendency] of [['monster','danger'],['trap','danger'],['treasure','fortune'],['rich','fortune'],['key','fortune'],['heal','safe'],['empty','safe']]){
  await page.evaluate(()=>__dofTest.newFloor());
  // Generated rooms include each normal event; find the requested event instead of mutating production logic.
  const ids=await page.evaluate(event=>{
   const s=__dofTest.state(),r=s.rooms.find(r=>r.active&&!r.searched&&r.id!==s.exitId&&r.event===event);
   if(!r)return null;__dofTest.revealClue(s.currentId,r.id);return{id:r.id,hint:r.hint};
  },event);
  assert(ids,'No '+event+' fixture');await page.waitForTimeout(260);
  const info=await page.evaluate(id=>{
   const r=__dofTest.state().rooms[id],el=document.querySelector('.cell[data-id="'+id+'"]');
   return{tendency:r.clueTendency,hint:r.hint,shown:el.dataset.hint,glyph:el.querySelector('.icon').textContent,exact:el.dataset.exactHint,event:!!el.querySelector('.event'),marker:!!el.querySelector('.clueMark')};
  },ids.id);
  assert.equal(info.tendency,tendency);assert.equal(info.shown,tendency);assert.equal(info.hint,ids.hint);assert.equal(info.glyph,'?');assert(!info.exact&&!info.event&&info.marker);
 }
 await page.evaluate(()=>{const s=__dofTest.state();__dofTest.revealClue(s.currentId,s.exitId)});
 await page.waitForTimeout(2100);
 s=await state();assert.equal(s.rooms[s.exitId].clueTendency,'stairs');
 assert.equal(await page.locator('.clue-reveal').count(),0);assert.match(await page.locator('.cell[data-id="'+s.exitId+'"] .clueMark').innerText(),/▼/);
 console.log('PASS source-to-target scavenge clues, all true tendencies, persistence, stairs, exact-event privacy');
 // Pointer motion never contributes to RNG: six directions consume the same ten random draws.
 const directions=[[65,0],[-65,0],[50,-45],[50,45],[-50,-45],[-50,45]];
 await page.evaluate(()=>{window.savedRandom=Math.random;window.rngCalls=0;Math.random=()=>{window.rngCalls++;return .72}});
 for(const [dx,dy] of directions){
  await clear();await page.evaluate(()=>{__dofTest.setVitals(3,false);__dofTest.setCombo(2);window.rngCalls=0;(__dofTest.setVitals(3,false),__dofTest.showDice('monster'))});
  const box=await page.locator('#eventCard').boundingBox(),x=box.x+box.width/2-dx/2,y=box.y+box.height/2-dy/2;
  await page.waitForTimeout(350);assert.equal(await page.locator('#diceOverlay.awaiting-swipe').count(),1);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+4,y+3);await page.mouse.up();
  assert.equal(await page.locator('#diceOverlay.awaiting-swipe').count(),1);
  assert.equal(await page.evaluate(()=>rngCalls),0);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:4});
  assert.equal(await page.locator('#eventCard.swipe-impact').count(),1);
  if(dx===65){
   await page.mouse.up();await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy);
  }
  await page.waitForFunction(()=>document.querySelector('#die').classList.contains('landed'));
  assert.equal(await page.locator('#diceOverlay.resolved').count(),0,'Landing pause must precede outcome');
  await page.waitForSelector('#diceOverlay.resolved');
  // Keep the accepted pointer held through resolution; its release must not continue.
  await page.mouse.up();assert.equal(await page.locator('#diceOverlay.resolved').count(),1);
  assert.equal(await page.evaluate(()=>rngCalls),10);
  assert.equal(await page.locator('#diceResult').innerText(),'ROLLED 5');
  assert.equal((await state()).combo,2.48);
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  assert.equal(await page.locator('#diceOverlay').evaluate(el=>el.style.display),'none');
 }
 await page.evaluate(()=>{Math.random=savedRandom});
 // Real touch cancellation and swipe; no scroll or selection.
 await clear();await page.evaluate(()=>(__dofTest.setVitals(3,false),__dofTest.showDice('monster')));
 const cdp=await context.newCDPSession(page),box=await page.locator('#eventCard').boundingBox(),x=box.x+35,y=box.y+70;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+5,y:y+4,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert.equal(await page.locator('#diceOverlay.awaiting-swipe').count(),1);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+65,y:y+45,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForSelector('#diceOverlay.resolved');
 assert.deepEqual(await page.evaluate(()=>({x:scrollX,y:scrollY,selection:getSelection().toString(),action:getComputedStyle(document.querySelector('#diceOverlay')).touchAction})),{x:0,y:0,selection:'',action:'none'});
 await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
 assert.equal((await state()).diceOverlay,'none');
 await page.evaluate(()=>(__dofTest.setVitals(3,false),__dofTest.showDice('monster')));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:3}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:3},{x:x+10,y:y+10,id:4}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y,id:3},{x:x+65,y:y+30,id:4}]});
 assert.equal(await page.locator('#diceOverlay.awaiting-swipe').count(),1,'Secondary finger must not commit');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await clear();
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{(__dofTest.setVitals(3,false),__dofTest.showDice('monster'));__dofTest.showFeedback(__dofTest.state().currentId,'⌁','clue','',1500)});
 assert.equal(await page.locator('.feedbackBody').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.equal(await page.locator('.swipeCue').evaluate(el=>getComputedStyle(el,'::after').opacity),'0.65');
 await page.keyboard.press('Enter');await page.waitForSelector('#diceOverlay.resolved');await page.keyboard.press('Enter');
 assert.equal((await state()).diceOverlay,'none');
 await page.emulateMedia({reducedMotion:'no-preference'});

 // Swipes can start and finish outside the card, over any screen region.
 for(const [x,y,dx,dy] of [[20,25,90,0],[280,750,-80,-45],[20,430,70,45],[280,430,-65,0]]){
  await clear();await page.evaluate(()=>(__dofTest.setVitals(3,false),__dofTest.showDice('monster')));
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+3,y+2);await page.mouse.up();
  assert.equal(await page.locator('#diceOverlay.awaiting-swipe').count(),1);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:4});
  assert.equal(await page.locator('#eventCard.swipe-impact').count(),1);
  await page.waitForSelector('#diceOverlay.resolved');
  await page.mouse.up();
  assert.equal(await page.locator('#diceOverlay.resolved').count(),1,'Swipe release must not continue');
  await page.mouse.click(20,25);assert.equal((await state()).diceOverlay,'none');
 }
 await clear();await page.evaluate(()=>(__dofTest.setVitals(3,false),__dofTest.showDice('monster')));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:25,y:720,id:9}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:670,id:9}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForSelector('#diceOverlay.resolved');
 await page.touchscreen.tap(25,720);assert.equal((await state()).diceOverlay,'none');
 console.log('PASS screen-wide mouse and touch swipes, accidental taps, safe release and continue');
 console.log('PASS six swipe directions, accidental taps, impact, one RNG roll, landing pause, held-pointer safety, touch cancellation and continue');
 for(const type of ['trap','heal']){
  await clear();await page.evaluate(type=>__dofTest.showDice(type),type);
  assert.equal(await page.locator('#diceOverlay.awaiting-swipe').count(),0);
  await page.waitForSelector('#die.rolling');await page.waitForSelector('#diceOverlay.resolved');
 }
 await clear();
 for(const [event,base,after] of [['treasure',30,2.33],['rich',90,2.57]]){
  const before=await state();await page.evaluate(event=>{__dofTest.setCombo(2);__dofTest.resolveSimple(event)},event);
  const afterState=await state();assert.equal(afterState.gold-before.gold,Math.floor(base*1.35));assert.equal(afterState.score-before.score,Math.floor(base*1.35));assert.equal(afterState.combo,after);
  await page.waitForTimeout(300);assert.equal(await page.locator('.roomFeedback .reward').filter({hasText:'+'+(Math.floor(base*1.35))+' 🪙'}).count(),1);
  await clear();
 }
 await page.evaluate(()=>{__dofTest.setVitals(3,true);__dofTest.resolveDice('monster',1)});
 s=await state();assert.equal(s.hp,3);assert.equal(s.shield,false);
 await clear();await page.evaluate(()=>{__dofTest.setVitals(3,false);__dofTest.resolveDice('heal',4)});
 assert.equal((await state()).shield,true);await clear();
 console.log('PASS automatic trap/shrine/treasure, composed reward, Gold/Score/FATE calculations, Divine Shield');
 // Exercise the existing map holds with trusted pointer input.
 await page.evaluate(()=>__dofTest.newFloor());await page.waitForTimeout(400);
 let current=await page.locator('.current').boundingBox();
 await page.mouse.move(current.x+current.width/2,current.y+current.height/2);await page.mouse.down();await page.waitForTimeout(370);await page.mouse.up();
 assert((await state()).rooms[(await state()).currentId].scavenged);
 await clear();
 const travel=await page.evaluate(()=>{
  __dofTest.newFloor();const s=__dofTest.state();__dofTest.markVisited(s.rooms.filter(r=>r.active).map(r=>r.id));__dofTest.setCombo(3.2);return{start:s.currentId,target:s.exitId,floor:s.floorNo};
 });
 await page.waitForTimeout(400);
 let exit=await page.locator('.cell[data-id="'+travel.target+'"]').boundingBox();
 await page.mouse.move(exit.x+exit.width/2,exit.y+exit.height/2);await page.mouse.down();await page.waitForTimeout(380);await page.mouse.up();
 await page.waitForFunction(id=>__dofTest.state().currentId===id&&!__dofTest.state().fastTraveling,travel.target);
 s=await state();assert.equal(s.combo,3.2);assert.equal(s.floorNo,travel.floor);
 current=await page.locator('.current').boundingBox();await page.mouse.move(current.x+current.width/2,current.y+current.height/2);await page.mouse.down();await page.waitForTimeout(370);await page.mouse.up();
 assert.equal((await state()).floorNo,travel.floor+1);
 console.log('PASS Scavenge hold, distant EXIT Fast Travel hold, FATE preserved, current EXIT descend hold');
 await clear();
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.setOffline(true);await page.goto(url+'index.html');assert(await page.locator('.current').count());
 assert.equal(await page.evaluate(()=>caches.keys().then(keys=>keys.includes('dungeon-of-fate-v2.16.2-1'))),true);
 await page.goto(url);assert(await page.locator('.current').count());
 await context.setOffline(false);
 assert.deepEqual(errors,[]);
 console.log('PASS actual service worker install, offline file and directory launch, no runtime errors');
 await browser.close();browser=null;server.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();server.close();process.exitCode=1});


