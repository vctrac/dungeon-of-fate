const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>fs.readFile(path.join(root,req.url==='/'?'index.html':req.url),(e,data)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/html');res.writeHead(e?404:200).end(data)}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER?{executablePath:process.env.PWA_BROWSER}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const save=()=>page.evaluate(()=>__dofTest.serializeRun()),resume=async()=>{await page.reload();await page.locator('#continueRun').click()};
 async function fixture(type,exitSecondary=false){return page.evaluate(({type,exitSecondary})=>{
  const t=__dofTest;t.newRun();for(let i=0;i<300;i++){t.setFloor(12);let s=t.serializeRun();if(s.floor.layers[1]?.type!==type||(exitSecondary&&s.floor.exitId<81))continue;
   const stair=s.floor.rooms.find(r=>r.layerId===0&&r.event==='stairs'),parent=stair.links[0];
   s.floor.currentId=parent;s.floor.rooms[parent].visited=s.floor.rooms[parent].searched=s.floor.rooms[parent].known=true;s.floor.history.push(parent);s.run.searched[parent]=true;
   s.relicState.trinkets=['blood','eye'];s.relicState.floorUsed={blood:true};s.relicState.coinCharges=4;s.relicState.bargainCharges=3;s.relicState.wardArmed=true;s.run.shield=true;s.run.hp=2;
   if(!t.restoreRun(s))throw Error('fixture restore');t.enter(stair.id);t.saveRun();return stair.id;
  }throw Error('no layer fixture')},{type,exitSecondary})}
 for(const type of ['upper','lower']){
  const stair=await fixture(type,true),before=await save(),target=before.floor.rooms[stair].stairTo;
  assert.equal(before.floor.activeLayer,0);assert.equal(before.floor.currentId,stair);assert.equal(before.pending.encounter,null);
  assert.equal(await page.locator('#activeMap .stairLabel').innerText(),type==='upper'?'▲ GO UP':'▼ GO DOWN');
  const oldSize=await page.locator('#activeMap .current').boundingBox();
  await page.locator('#activeMap .current').tap();
  const after=await save();assert.equal(after.floor.currentId,target);assert.equal(after.floor.activeLayer,1);assert.equal(after.run.floorNo,12);assert.equal(after.run.totalMoves,before.run.totalMoves+1);
  assert.equal(after.relicState.coinCharges,before.relicState.coinCharges-1);assert.equal(after.relicState.bargainCharges,before.relicState.bargainCharges-1);
  for(const k of ['trinkets','floorUsed','wardArmed','consumable'])assert.deepEqual(after.relicState[k],before.relicState[k]);
  for(const k of ['hp','shield','gold','score','combo'])assert.equal(after.run[k],before.run[k]);
  for(const k of ['floorFortune','fortuneBudget','fortuneUpgrades','floorDamage','floorPerfectAwarded'])assert.deepEqual(after.floor[k],before.floor[k]);assert.deepEqual(after.fateGate,before.fateGate);
  assert.equal(after.floor.rooms[target].x,after.floor.rooms[stair].x);assert.equal(after.floor.rooms[target].y,after.floor.rooms[stair].y);
  assert(after.floor.rooms.filter(r=>r.layerId===1&&r.active&&!r.known).length>0);
  // Save during CSS animation. Background/lifecycle must retain committed destination, not its origin.
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await resume();assert.deepEqual((await save()).floor,after.floor);assert.deepEqual((await save()).relicState,after.relicState);assert.equal(await page.evaluate(()=>__dofTest.layerInfo().transition),false);
  assert.equal(await page.locator('.layerGhost').count(),0);assert(await page.locator('.inactiveLayer').evaluate(el=>el.inert&&getComputedStyle(el).pointerEvents==='none'));
  assert.equal(await page.locator('.inactiveLayer .cell').count(),0);
  const size=await page.locator('#activeMap .current').boundingBox();assert(Math.abs(size.width-oldSize.width)<.1);
  // Room IDs on another layer cannot be auto-walked to, even when already visited.
  await page.evaluate(stair=>__dofTest.travel(stair),stair);assert.equal((await save()).floor.currentId,target);assert.equal(await page.evaluate(()=>__dofTest.state().fastTraveling),false);
  // Active-layer Clues cannot reveal a BASE room, but work locally (Evil Eye remains frontier-only).
  await page.evaluate(()=>{const t=__dofTest,s=t.serializeRun(),r=s.floor.rooms.find(r=>r.layerId===0&&r.active&&!r.known);if(r){t.revealClue(s.floor.currentId,r.id,'exploration');if(t.serializeRun().floor.rooms[r.id].known)throw Error('cross-layer clue')}});
  await page.evaluate(()=>{const t=__dofTest,s=t.serializeRun(),front=s.floor.rooms[s.floor.currentId].links.find(id=>!s.fateGate?.branchIds.includes(id));t.setRoomFixture(front,{event:'monster',monsterKind:'thief',searched:false});t.markVisited([s.floor.currentId]);const state=t.state();if(!state.rooms[front].eyeMarked)throw Error('secondary Evil Eye');if(state.rooms.some(r=>r.layerId===1&&!r.known&&r.eyeMarked))throw Error('distant Eye leak')});
  const marker=await page.evaluate(()=>{const t=__dofTest,s=t.serializeRun(),id=s.floor.currentId;t.setRoomFixture(id,{scavengeOpportunity:{roll:.8,resolved:false,passiveLead:false},scavenged:false});t.revealClue(id,id,'loot');t.saveRun();return t.serializeRun()});
  await resume();assert.deepEqual((await save()).floor,marker.floor);assert((await save()).floor.rooms[target].attentionActive);
  await page.evaluate(()=>__dofTest.scavenge(__dofTest.state().currentId));await resume();assert((await save()).floor.rooms[target].attentionResolved);
  const backBefore=await save();await page.locator('#activeMap .current').tap();await page.waitForTimeout(450);const back=await save();assert.equal(back.floor.currentId,stair);assert.equal(back.floor.activeLayer,0);
  assert.equal(back.relicState.coinCharges,backBefore.relicState.coinCharges);assert.equal(back.relicState.bargainCharges,backBefore.relicState.bargainCharges);assert(back.relicState.floorUsed.blood);
  await resume();assert.deepEqual((await save()).floor,back.floor);
  console.log('PASS',type,'entry/tap, paired coordinates, effects once, no cross-layer walking/clues, marker, return/reload and transition interruption');
 }
 // Legacy saves have no layer fields. Continue must not regenerate or grant anything.
 await page.evaluate(()=>{__dofTest.newRun();__dofTest.saveRun()});const legacy=await save();delete legacy.floor.layers;delete legacy.floor.activeLayer;legacy.gameVersion='2.18.1';for(const r of legacy.floor.rooms)delete r.layerId;
 assert(await page.evaluate(s=>{const t=__dofTest;if(!t.restoreRun(s))return false;t.saveRun();return true},legacy));await resume();const migrated=await save();assert.deepEqual(migrated.run,legacy.run);assert.deepEqual(migrated.floor.layers,[{id:0,type:'base',height:0}]);const withoutLayer=migrated.floor.rooms.map(({layerId,...r})=>r);assert.deepEqual(withoutLayer,legacy.floor.rooms);
 // EXIT on secondary is the sole normal descend, resetting once-per-floor effects only then.
 await fixture('upper',true);await page.locator('#activeMap .current').tap();await page.waitForTimeout(450);
 await page.evaluate(()=>{const t=__dofTest,s=t.serializeRun();t.markVisited([s.floor.exitId]);t.setCurrent(s.floor.exitId);if(!t.descend())throw Error('secondary EXIT blocked')});assert.equal((await save()).run.floorNo,13);assert.equal((await save()).floor.activeLayer,0);assert.deepEqual((await save()).relicState.floorUsed,{});
 // Phone bounds and inactive-input layout, including a stair at the edge.
 await fixture('lower');await page.locator('#activeMap .current').tap();await page.waitForTimeout(450);
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);const b=await page.locator('#activeMap .stairLabel').boundingBox(),board=await page.locator('#board').boundingBox();assert(b.x>=board.x&&b.x+b.width<=board.x+board.width);assert(b.y>=board.y&&b.y+b.height<=board.y+board.height);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/dof-layers.png'});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#activeMap .current').tap();assert.equal(await page.locator('.layerGhost').count(),0);assert.equal(await page.evaluate(()=>__dofTest.layerInfo().transition),false);assert.equal(await page.locator('#activeMap').evaluate(el=>el.inert),false);assert.deepEqual(errors,[]);
 console.log('PASS legacy exact topology/resources, secondary EXIT, mobile bounds, no runtime errors');
}finally{if(browser)await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
