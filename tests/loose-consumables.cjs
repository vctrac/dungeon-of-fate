const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=http.createServer((q,r)=>fs.readFile(path.join(root,q.url==='/'?'index.html':q.url),(err,data)=>{r.setHeader('Content-Type',q.url.endsWith('.png')?'image/png':q.url.endsWith('.js')?'application/javascript':'text/html');r.writeHead(err?404:200).end(data)}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(require('./movement-test-helpers.cjs').install);await page.goto('http://127.0.0.1:'+server.address().port);
 const save=()=>page.evaluate(()=>__dofTest.serializeRun());
 async function resume(){await page.reload();await page.locator('#continueRun').click()}
 async function dismiss(){await page.evaluate(()=>__dofTest.closeItemCard())}
 async function reveal(){await page.evaluate(()=>__dofTest.finishItemReveal())}
 for(const held of [null,'ward']){
  await page.evaluate(held=>{const t=__dofTest;t.newRun();t.setConsumable(held);t.setRoomFixture(t.state().currentId,{event:'corpse',contentState:{seen:true,resolved:false,consumed:false}});const random=Math.random;Math.random=()=>.9;t.showDice('corpse');Math.random=random;t.revealOutcome()},held);
  const pending=(await save()).pending.encounter,found=pending.rewardItem;assert.equal(pending.roll,6);await resume();await page.locator('#diceOverlay').tap({position:{x:4,y:4}});await reveal();let s=await save(),id=s.floor.currentId;
  assert.equal(s.floor.rooms[id].event,'corpse');assert(s.floor.rooms[id].contentState.resolved);assert.equal(s.relicState.consumable,held||found);assert.equal(s.floor.rooms[id].droppedConsumable||null,held?found:null);assert(await page.evaluate(()=>__dofTest.validateSave(__dofTest.serializeRun())));
  await resume();await dismiss();await resume();s=await save();assert.equal(s.floor.rooms[id].droppedConsumable||null,held?found:null);
  if(held){
   for(let i=0;i<3;i++){await page.locator('.cell.current').tap();assert.equal((await save()).pending.cards.active.id,found);await dismiss();assert.equal((await save()).floor.rooms[id].droppedConsumable,found)}
   await page.locator('.cell.current').tap();await require('./card-hold-helpers.cjs').hold(page,'#takeItem');s=await save();assert.equal(s.relicState.consumable,found);assert.equal(s.floor.rooms[id].droppedConsumable,held);await resume();await page.locator('.cell.current').tap();await require('./card-hold-helpers.cjs').hold(page,'#takeItem');s=await save();assert.equal(s.relicState.consumable,held);assert.equal(s.floor.rooms[id].droppedConsumable,found);
   await page.evaluate(()=>__dofTest.setConsumable(null));await page.locator('.cell.current').tap();await resume();await require('./card-hold-helpers.cjs').hold(page,'#takeItem');s=await save();assert.equal(s.relicState.consumable,found);assert.equal(s.floor.rooms[id].droppedConsumable,null);
  }
  await page.locator('.cell.current').tap();assert.equal(await page.locator('#itemName').innerText(),'Corpse Remains');await dismiss();
 }
 console.log('PASS actual Corpse SUPPLIES empty/occupied, coexisting resolved content, repeated dismiss/reopen/reload, two-way exchange and empty-slot pickup');
 for(const source of ['chest','scavenge','gate']){
  await page.evaluate(async source=>{const t=__dofTest;t.newRun();t.setConsumable('ward');let id=t.state().currentId;
   if(source==='chest'){t.setFloor(6);for(let i=0;i<500&&!t.state().rooms.some(r=>r.event==='chest');i++)t.newFloor();id=t.state().rooms.find(r=>r.event==='chest').id;t.setCurrent(id);t.setRoomFixture(id,{searched:true,eventResolved:true,chest:{kind:'consumable',itemId:'flask',fallbackItemId:null,opened:false,cardSeen:false}});t.openChestCard(id,true);t.openChest()}
   if(source==='scavenge'){localStorage.setItem('dof.learnedScavenge','1');const random=Math.random;Math.random=()=>.99;t.scavenge(id,.93);Math.random=random}
   if(source==='gate'){const next=t.state().rooms[id].links[0];t.setRoomFixture(next,{event:'consumable',eventResolved:false});await testMove(t,next)}
   t.finishItemReveal()
  },source);let s=await save(),id=s.floor.currentId,found=s.floor.rooms[id].droppedConsumable;assert(found);assert.equal(s.relicState.consumable,'ward');await dismiss();await resume();assert.equal((await save()).floor.rooms[id].droppedConsumable,found);await page.locator('.cell.current').tap();assert((await save()).pending.cards.active,source);assert.equal((await save()).pending.cards.active.id,found);await dismiss();
 }
 console.log('PASS Chest, Scavenge and Gate acquisition use room placement; backdrop/reload never discards reward');
 // Capacity guards run before source resolution/randomness, never delete the existing loose item.
 for(const source of ['corpse','chest','scavenge']){
  await page.evaluate(source=>{const t=__dofTest;t.newRun();t.setConsumable('ward');t.setRoomFixture(t.state().currentId,{event:source==='scavenge'?'empty':source,droppedConsumable:'flask',scavenged:false,contentState:{seen:true,resolved:false,consumed:false},...(source==='chest'?{chest:{kind:'consumable',itemId:'charm',opened:false,cardSeen:false}}:{})});if(source==='corpse')t.openContent(t.state().currentId,false);if(source==='chest')t.openChestCard(t.state().currentId,false)},source);
  assert.equal(await page.evaluate(source=>{const t=__dofTest;return source==='corpse'?t.actOnContent():source==='chest'?t.openChest():t.scavenge(t.state().currentId,.93)},source),false);const s=await save(),r=s.floor.rooms[s.floor.currentId];assert.equal(r.droppedConsumable,'flask');assert.equal(s.relicState.consumable,'ward');assert(!r.contentState.resolved);assert(!r.scavenged);if(source==='chest')assert(!r.chest.opened);
 }
 // Markers use the actual fog/Amnesia presentation and do not wake cards during traversal.
 await page.evaluate(()=>{const t=__dofTest;t.newRun();t.setConsumable('ward');t.offerConsumable('flask');t.closeItemCard();const s=t.state(),next=s.rooms[s.currentId].links[0];window.home=s.currentId;window.next=next;t.setRoomFixture(next,{event:'empty',eventResolved:true,droppedConsumable:'coin',known:false,visited:false});});assert.equal(await page.locator('.droppedItem').count(),1);
 await page.evaluate(()=>{const t=__dofTest;t.markVisited([next]);t.applyCondition('amnesia');t.update()});assert.equal(await page.locator('.droppedItem').count(),1);assert(!(await save()).run.rememberedRooms[await page.evaluate(()=>next)]);await page.evaluate(async()=>await testMove(__dofTest,next));assert(await page.locator('#itemChoice').isHidden());assert.equal(await page.locator('.droppedItem').count(),2);await page.evaluate(()=>__dofTest.travel(home));await page.waitForFunction(()=>!__dofTest.state().fastTraveling);assert(await page.locator('#itemChoice').isHidden());await resume();assert.equal((await save()).floor.rooms[await page.evaluate(()=>__dofTest.state().currentId)].droppedConsumable,'flask');await page.evaluate(()=>__dofTest.newFloor());assert(!(await save()).floor.rooms.some(r=>r.droppedConsumable));
 console.log('PASS one-loose capacity guards preserve unresolved sources, fog/Amnesia marker privacy, quiet movement/auto-walk and floor-local lifetime');
 for(const [sick,hp,afterHp,consumed] of [[true,1,1,true],[true,3,3,true],[false,1,2,true],[false,3,3,false]]){
  await page.evaluate(({sick,hp})=>{const t=__dofTest;t.newRun();t.setVitals(hp,false);if(sick)t.applyCondition('weakness');t.setRoomFixture(t.state().currentId,{event:'food',contentState:{seen:false,resolved:false,consumed:false}});t.openContent(t.state().currentId,true)},{sick,hp});assert.equal(await page.locator('#itemName').innerText(),'Fruit Tree');assert.equal(await page.locator('#itemArt').innerText(),'🌳');assert((await page.evaluate(()=>__dofTest.codex())).discovered['discovery:food']);await page.evaluate(()=>__dofTest.actOnContent());const s=await save();assert.equal(s.run.hp,afterHp);assert(!s.run.conditions.weakness);assert.equal(s.floor.rooms[s.floor.currentId].contentState.consumed,consumed);
 }
 assert.deepEqual(errors,[]);console.log('PASS Fruit Tree cure priority/heal/no-waste, unchanged food ID/Archive identity; no runtime errors');
 }finally{if(browser)await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
