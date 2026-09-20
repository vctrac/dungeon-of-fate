const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>fs.readFile(path.join(root,req.url==='/'?'index.html':req.url),(err,data)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':req.url.endsWith('.png')?'image/png':'text/html');res.writeHead(err?404:200).end(data)}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER?{executablePath:process.env.PWA_BROWSER}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 // Control only hop callbacks: deterministic boundaries, real gameplay/render/storage code.
 await context.addInitScript(()=>{
  const set=window.setTimeout,clear=window.clearTimeout;let id=-1;window.walkTimers=new Map();window.lastHop=null;
  window.setTimeout=function(fn,ms,...args){if(fn.name==='hop'){const key=id--;walkTimers.set(key,{fn,ms});return key}return set(fn,ms,...args)};
  window.clearTimeout=function(key){if(walkTimers.has(key))walkTimers.delete(key);else clear(key)};
  window.walkTick=function(){const entry=walkTimers.entries().next().value;if(!entry)return null;walkTimers.delete(entry[0]);window.lastHop=entry[1].fn;entry[1].fn();return entry[1].ms};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dof.activeRun')));
 const tick=()=>page.evaluate(()=>walkTick());
 const comparable=s=>({run:s.run,floor:s.floor,relicState:s.relicState,fateGate:s.fateGate,pending:s.pending});
 async function setup(){return page.evaluate(()=>{
  const t=__dofTest;t.newRun();const s=t.state();
  // Real generated route, including EXIT. Existing-only traversal must not use new-room charges.
  const q=[[s.startId]],seen=new Set([s.startId]);let route;
  while(q.length){const p=q.shift(),id=p.at(-1);if(id===s.exitId){route=p;break}for(const n of s.rooms[id].links)if(!seen.has(n)){seen.add(n);q.push([...p,n])}}
  if(route.length<4)throw Error('route too short');
  t.markVisited(route);t.setConsumable('coin');t.useConsumable(true);t.setConsumable('bargain');t.useConsumable(true);t.setConsumable('ward');t.useConsumable(true);
  t.saveRun();window.testRoute=route;t.travel(route.at(-1));return route;
 })}
 // Every boundary, including before first hop and just before/after EXIT, on both lifecycle events.
 const route=await setup(),origin=await saved();
 for(const lifecycle of ['pagehide','visibilitychange']){
  for(let hops=0;hops<route.length;hops++){
   // Reuse one floor so each iteration probes the same route and resources.
   await page.evaluate(({s,p})=>{__dofTest.restoreRun(s);__dofTest.saveRun();window.testRoute=p;__dofTest.travel(p.at(-1))},{s:origin,p:route});
   const base=await saved(),p=await page.evaluate(()=>testRoute);
   const limit=Math.min(hops,p.length-1);
   for(let i=0;i<limit;i++){
    await tick();const s=await saved();assert.equal(s.floor.currentId,p[i+1]);assert.equal(s.run.totalMoves,base.run.totalMoves+i+1);assert.equal(s.floor.history.at(-1),p[i+1]);assert(s.floor.rooms[p[i+1]].visited);
    assert.equal(s.relicState.coinCharges,5);assert.equal(s.relicState.bargainCharges,3);assert.equal(s.relicState.coinRoom,null);assert.equal(s.relicState.bargainRoom,null);assert(s.relicState.wardArmed);
   }
   const committed=await saved();
   await page.evaluate(kind=>{window.staleHop=walkTimers.values().next().value?.fn;if(kind==='visibilitychange'){Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event(kind))}else window.dispatchEvent(new Event(kind))},lifecycle);
   assert.equal(await page.evaluate(()=>__dofTest.state().fastTraveling),false,'background must stop remaining route');
   // Even a callback already queued by the browser must be invalidated, including after return.
   await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));if(staleHop)staleHop();walkTick()});
   assert.deepEqual(comparable(await saved()),comparable(committed));
   await page.reload();await page.locator('#continueRun').click();assert.deepEqual(comparable(await page.evaluate(()=>__dofTest.serializeRun())),comparable(committed));
   assert.equal(await page.evaluate(()=>__dofTest.state().fastTraveling),false);assert.equal(await tick(),null);

  }
 }
 console.log('PASS every hop + EXIT boundaries: pagehide/hidden cancels route, stale callbacks cannot move, exact reload state/effects');
 await setup();const p=await page.evaluate(()=>testRoute);for(let i=1;i<p.length;i++)await tick();const final=await saved();assert.equal(final.floor.currentId,p.at(-1));await tick();assert.equal(await page.evaluate(()=>__dofTest.state().fastTraveling),false);await page.reload();await page.locator('#continueRun').click();assert.deepEqual(comparable(await page.evaluate(()=>__dofTest.serializeRun())),comparable(final));assert.equal((await saved()).run.floorNo,1);
 console.log('PASS normal completion restores EXIT without descent; no route is serialized or resumed');
 // A delayed lifecycle notification must not allow hidden timers to advance gameplay.
 await setup();const hiddenBase=await saved();await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}));await tick();assert.deepEqual(comparable(await saved()),comparable(hiddenBase));assert.equal(await page.evaluate(()=>__dofTest.state().fastTraveling),false);await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}));
 // Newly noticed finite information survives the 400ms emphasis wait; known markers use 150ms.
 const attentionPath=await setup(),marked=attentionPath[1];await page.evaluate(id=>{__dofTest.setRoomFixture(id,{scavenged:false,attentionActive:false,attentionResolved:false,attentionEmphasized:false,lootClued:false,scavengeOpportunity:{roll:.8,resolved:false,passiveLead:true}});__dofTest.saveRun()},marked);await tick();let info=await saved();assert(info.floor.rooms[marked].attentionActive);assert.equal(await page.evaluate(()=>walkTimers.values().next().value.ms),400);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.reload();await page.locator('#continueRun').click();assert.deepEqual(comparable(await page.evaluate(()=>__dofTest.serializeRun())),comparable(info));await page.evaluate(p=>{__dofTest.travel(p[0])},attentionPath);await tick();await tick();await page.evaluate(p=>__dofTest.travel(p.at(-1)),attentionPath);await tick();assert.equal(await page.evaluate(()=>walkTimers.values().next().value.ms),150);assert(!(await saved()).floor.rooms[marked].scavengeOpportunity.resolved);
 // Real generated branch: enter legitimately, revisit via auto-walk, resume inside, leave at low FATE.
 await page.evaluate(()=>{const t=__dofTest;t.newRun();for(let i=0;i<200;i++){t.setFloor(8);const s=t.state(),g=s.fateGate;if(!g)continue;t.markVisited([g.parentId]);t.setRoomFixture(g.parentId,{event:'empty',eventResolved:true});t.setCurrent(g.parentId);t.setRoomFixture(g.roomId,{event:'empty'});t.setCombo(g.requirement);t.enter(g.roomId);t.enter(g.parentId);t.saveRun();t.travel(g.roomId);return}throw Error('no gate')});await tick();const inside=await saved();assert(inside.fateGate.branchIds.includes(inside.floor.currentId));await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.reload();await page.locator('#continueRun').click();assert.deepEqual(comparable(await page.evaluate(()=>__dofTest.serializeRun())),comparable(inside));await page.evaluate(()=>{const t=__dofTest;t.setCombo(1);t.travel(t.state().fateGate.parentId)});await tick();await tick();assert.equal((await saved()).floor.currentId,inside.fateGate.parentId);await page.evaluate(()=>__dofTest.travel(__dofTest.state().fateGate.roomId));assert.equal(await page.evaluate(()=>__dofTest.state().fastTraveling),false);
 // A real V2.16.3-format save remains compatible; no schema bump or synthetic room entry.
 const compatible=await saved();compatible.gameVersion='2.16.3';assert(await page.evaluate(s=>__dofTest.restoreRun(s),compatible));await page.evaluate(()=>__dofTest.flushRun());await page.reload();await page.locator('#continueRun').click();assert.deepEqual(comparable(await page.evaluate(()=>__dofTest.serializeRun())),comparable(compatible));assert.equal((await saved()).saveVersion,1);
 console.log('PASS hidden timer guard, new/known attention timing, Gate exit/access, and V2.16.3 compatibility');

 assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
