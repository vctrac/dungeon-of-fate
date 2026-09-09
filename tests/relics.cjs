const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname);
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.webmanifest')?'application/manifest+json':'image/png');res.end(data)})
});
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER?{executablePath:process.env.PWA_BROWSER}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');
 const state=()=>page.evaluate(()=>__dofTest.state());
 const reset=()=>page.evaluate(()=>{__dofTest.newRun();__dofTest.setConsumable(null)});
 const clear=()=>page.evaluate(()=>__dofTest.clearPending());
 const resolve=async(kind,roll)=>{await page.evaluate(({kind,roll})=>{__dofTest.setMonster(kind);__dofTest.resolveDice('monster',roll)},{kind,roll});const s=await state();await clear();return s};
 await page.evaluate(()=>{
  window.giveTrinket=id=>{__dofTest.acquireTrinket(id);if(__dofTest.state().cards.active&&!__dofTest.state().cards.active.decision)__dofTest.closeItemCard()};
  window.giveConsumable=id=>{__dofTest.offerConsumable(id);if(__dofTest.state().cards.active&&!__dofTest.state().cards.active.decision)__dofTest.closeItemCard()};
 });
 const holdSlot=async()=>{const b=await page.locator('#consumableSlot').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(610);await page.mouse.up()};
 await page.waitForTimeout(400);

 // Room reveals briefly lock input, but the consumable slot must not dim.
 for(const held of [null,'flask']){
  await reset();await page.waitForTimeout(400);
  if(held)await page.evaluate(id=>giveConsumable(id),held);
  const before=await page.locator('#consumableSlot').evaluate(el=>({opacity:getComputedStyle(el).opacity,text:el.textContent}));
  await page.evaluate(()=>{
   const s=__dofTest.state(),id=s.rooms[s.currentId].links.find(id=>id!==s.exitId);
   __dofTest.setRoomFixture(id,{event:'empty',eventResolved:false,visited:false,searched:false});
   __dofTest.enter(id);
  });
  const during=await page.locator('#consumableSlot').evaluate(el=>({opacity:getComputedStyle(el).opacity,text:el.textContent,disabled:el.disabled}));
  assert.equal(during.opacity,before.opacity);assert.equal(during.text,before.text);assert(during.disabled);
  assert.equal(await page.evaluate(()=>__dofTest.useConsumable(false)),false);
  await page.waitForFunction(()=>__dofTest.state().pendingAction===null);
  const after=await page.locator('#consumableSlot').evaluate(el=>({opacity:getComputedStyle(el).opacity,text:el.textContent,disabled:el.disabled}));
  assert.equal(after.opacity,before.opacity);assert.equal(after.text,before.text);assert.equal(after.disabled,false);
 }
 await reset();
 console.log('PASS stable empty/filled item slot across room reveals; input locks preserved');
 // Resolve each archetype, isolating HP, Gold and Fate threats.
 await page.evaluate(()=>{__dofTest.setGold(1000);__dofTest.setCombo(4)});
 let s=await resolve('basic',1);assert.equal(s.hp,2);assert.equal(s.combo,3);assert.equal(s.gold,1000);
 await reset();await page.evaluate(()=>{__dofTest.setGold(1000);__dofTest.setCombo(4)});
 s=await resolve('thief',1);assert.equal(s.hp,3);assert.equal(s.gold,750);assert.equal(s.combo,4);
 await page.evaluate(()=>__dofTest.setGold(0));s=await resolve('thief',1);assert.equal(s.gold,0);
 await page.evaluate(()=>__dofTest.setGold(100000));s=await resolve('thief',1);assert.equal(s.gold,75000);
 await page.evaluate(()=>__dofTest.setCombo(4));s=await resolve('spirit',3);assert.equal(s.combo,3);assert.equal(s.hp,3);assert.equal(s.gold,75000);
 s=await resolve('spirit',1);assert.equal(s.combo,1);assert.equal(s.hp,3);
 for(const kind of ['basic','thief','spirit']){
  await reset();await page.evaluate(()=>__dofTest.setCombo(2));s=await resolve(kind,6);assert(s.gold>0&&s.combo>2&&s.hp===3);
  await page.evaluate(kind=>__dofTest.showDice('monster',kind),kind);
  assert.equal(await page.locator('#eventArt').innerText(),{basic:'👹',thief:'🥷',spirit:'👻'}[kind]);
  assert.equal(await page.locator('#monsterThreat').innerText(),{basic:'♥',thief:'🪙',spirit:'✦'}[kind]);
  await page.waitForTimeout(400);assert.equal(await page.locator('#diceOverlay.awaiting-swipe').count(),1);
  await page.mouse.move(20,720);await page.mouse.down();await page.mouse.move(110,675,{steps:4});await page.mouse.up();
  assert.equal(await page.locator('.swipeCue').evaluate(el=>getComputedStyle(el).display),'none');
  await page.waitForFunction(()=>document.querySelector('#die').classList.contains('landed'));assert.equal(await page.locator('#diceOverlay.resolved').count(),0);
  await page.waitForSelector('#diceOverlay.resolved');await clear();
 }
 const weights=await page.evaluate(()=>[1,2,3,8].map(n=>{const counts={basic:0,thief:0,spirit:0};for(let i=0;i<100;i++)counts[__dofTest.pickMonster(n,(i+.5)/100)]++;return counts}));
 assert.deepEqual(weights,[{basic:100,thief:0,spirit:0},{basic:80,thief:20,spirit:0},{basic:78,thief:20,spirit:2},{basic:67,thief:23,spirit:10}]);
 console.log('PASS monster resource threats, reward bands, controlled depth weights, identities and screen-wide swipes');
 await reset();await page.evaluate(()=>__dofTest.showDice('monster'));
 const cue=await page.evaluate(()=>{
  const card=document.querySelector('#eventCard').getBoundingClientRect(),el=document.querySelector('.swipeCue'),b=el.getBoundingClientRect(),p=getComputedStyle(el,'::after');
  return{crosses:b.left<card.left&&b.right>card.right,duration:p.animationDuration,delay:p.animationDelay,pointer:getComputedStyle(el).pointerEvents}
 });
 assert(cue.crosses);assert.equal(cue.duration,'2.8s');assert.equal(cue.delay,'0.5s');assert.equal(cue.pointer,'none');
 assert.equal(await page.locator('#diceDetail').innerText(),'');
 await clear();await page.evaluate(()=>__dofTest.resolveSimple('empty'));await page.waitForTimeout(600);
 assert(!await page.locator('.roomFeedback').filter({hasText:'ROOM SEARCHED'}).count());
 console.log('PASS large slow demo crosses card, input-transparent instruction, no ROOM SEARCHED popup');
 // Doll only rescues lethal hits, is destroyed, and never consumes a shield first.
 await reset();await page.evaluate(()=>{giveTrinket('doll');__dofTest.setCombo(6)});
 s=await resolve('basic',1);assert.equal(s.hp,2);assert(s.relics.trinkets.includes('doll'));assert.equal(s.combo,5);
 await page.evaluate(()=>__dofTest.setVitals(1,true));s=await resolve('basic',1);assert.equal(s.hp,1);assert.equal(s.shield,false);assert(s.relics.trinkets.includes('doll'));
 s=await resolve('basic',1);assert.equal(s.hp,1);assert.equal(s.combo,1);assert(!s.relics.trinkets.includes('doll'));
 s=await resolve('basic',1);assert.equal(s.hp,0);
 // Blood: a victory at full HP must not consume its use.
 await reset();await page.evaluate(()=>giveTrinket('blood'));
 s=await resolve('basic',5);assert(!s.relics.floorUsed.blood);
 await page.evaluate(()=>__dofTest.setVitals(1,false));s=await resolve('thief',5);assert.equal(s.hp,2);assert(s.relics.floorUsed.blood);
 s=await resolve('spirit',6);assert.equal(s.hp,2);
 await page.evaluate(()=>__dofTest.newFloor());s=await resolve('spirit',5);assert.equal(s.hp,3);
 // Every perfect encounter roll dispatches a reusable passive hook.
 for(const type of ['monster','trap','heal']){
  await reset();await page.evaluate(type=>{__dofTest.setVitals(2,false);__dofTest.resolveDice(type,6)},type);
  const baseline=await state();await reset();
  await page.evaluate(type=>{giveTrinket('horseshoe');__dofTest.setVitals(2,false);__dofTest.resolveDice(type,6)},type);
  const withItem=await state();assert.equal(withItem.gold-baseline.gold,30);assert.equal(withItem.score-baseline.score,30);
 }
 await reset();await page.evaluate(()=>{['doll','blood','eye','doll'].forEach(giveTrinket)});
 s=await state();assert.equal(s.relics.trinkets.length,3);
 for(let floor=1;floor<=3;floor++){
  await page.evaluate(n=>__dofTest.setFloor(n),floor);
  const info=await page.evaluate(()=>{
   const s=__dofTest.state();
   return{all:s.rooms.filter(r=>r.active&&r.known&&!r.searched&&r.event==='monster').every(r=>r.eyeMarked),only:s.rooms.filter(r=>r.eyeMarked).every(r=>r.event==='monster'&&r.known&&!r.searched),icons:[...document.querySelectorAll('.eye-known .icon')].every(el=>el.textContent==='👹')}
  });assert(info.all&&info.only&&info.icons);
 }
 console.log('PASS lethal-only Doll and Blood floor limits, protection priority, Evil Eye on every floor, perfect-roll hook, coexistence without duplicates');
 // Ordinary consumables are never wasted.
 await reset();await page.evaluate(()=>giveConsumable('flask'));
 await holdSlot();assert.equal((await state()).relics.consumable,'flask');
 await page.evaluate(()=>__dofTest.setVitals(2,false));await holdSlot();
 s=await state();assert.equal(s.hp,3);assert.equal(s.relics.consumable,null);
 await page.evaluate(()=>{giveConsumable('charm');__dofTest.setVitals(3,true)});
 await holdSlot();assert.equal((await state()).relics.consumable,'charm');
 await page.evaluate(()=>__dofTest.setVitals(3,false));await holdSlot();
 s=await state();assert(s.shield);assert.equal(s.relics.consumable,null);
 // Full slot: either choice is explicit.
 await page.evaluate(()=>{giveConsumable('flask');giveConsumable('charm')});
 assert.equal((await state()).pendingAction,'item-card');await page.locator('#keepItem').click();assert.equal((await state()).relics.consumable,'flask');
 await page.evaluate(()=>giveConsumable('bargain'));await page.locator('#takeItem').click();assert.equal((await state()).relics.consumable,'bargain');
 // Dangerous item requires a hold; movement/cancel and a tap do not spend it.
 await page.locator('#consumableSlot').tap();assert.equal((await state()).hp,3);await page.locator('#closeItem').click();
 let slot=await page.locator('#consumableSlot').boundingBox();
 await page.mouse.move(slot.x+20,slot.y+20);await page.mouse.down();await page.mouse.move(slot.x+50,slot.y+20);await page.waitForTimeout(600);await page.mouse.up();
 assert.equal((await state()).relics.bargainCharges,0);
 await page.mouse.move(slot.x+20,slot.y+20);await page.mouse.down();await page.waitForTimeout(610);await page.mouse.up();
 s=await state();assert.equal(s.hp,1);assert.equal(s.relics.bargainCharges,3);assert.equal(s.relics.consumable,null);
 // Revisiting does not consume a charge.
 const visited=await page.evaluate(()=>{
  const s=__dofTest.state(),id=s.rooms[s.currentId].links[0];__dofTest.setRoomFixture(id,{visited:true,searched:true,eventResolved:true});__dofTest.enter(id);return id
 });
 assert.equal((await state()).relics.bargainCharges,3);
 // Three fresh entry fixtures use the real movement/encounter pipeline. The third is still protected.
 for(let entry=1;entry<=3;entry++){
  await page.evaluate(()=>{
   const s=__dofTest.state(),id=s.rooms[s.currentId].links.find(id=>id!==s.exitId);
   __dofTest.setRoomFixture(id,{visited:false,searched:false,eventResolved:false,event:'monster',monsterKind:'basic'});
   __dofTest.enter(id);
  });
  await page.waitForSelector('#diceOverlay.awaiting-swipe');
  assert.equal((await state()).relics.bargainCharges,3-entry);
  s=await resolve('basic',1);assert.equal(s.hp,1,'Protected entry '+entry);assert(s.shield,'Bargain should preserve Shield');
 }
 s=await state();assert.equal(s.relics.bargainRoom,null);assert.equal(s.relics.bargainCharges,0);
 await page.evaluate(()=>__dofTest.setVitals(2,false));s=await resolve('basic',1);assert.equal(s.hp,1,'Protection must expire');
 await page.evaluate(()=>{giveConsumable('bargain');__dofTest.useConsumable(true);__dofTest.setGold(1000);__dofTest.setCombo(4)});
 s=await resolve('thief',1);assert.equal(s.gold,750);assert.equal(s.hp,1);
 s=await resolve('spirit',1);assert.equal(s.combo,1);assert.equal(s.hp,1);
 console.log('PASS slot choice, Flask/Charm no-waste rules, safe Bargain hold, 3 NEW entries, expiry, non-HP losses');
 // Scavenge item odds are a dedicated rare band, with guaranteed first-learning Gold.
 await reset();await page.evaluate(()=>{
  localStorage.setItem('dof.learnedScavenge','1');window.realRandom=Math.random;Math.random=()=>.1;
  __dofTest.scavenge(__dofTest.state().currentId,.93);Math.random=realRandom
 });
 assert.equal((await state()).relics.trinkets.length,1);
 await reset();await page.evaluate(()=>{
  localStorage.setItem('dof.learnedScavenge','1');window.realRandom=Math.random;Math.random=()=>.9;
  __dofTest.scavenge(__dofTest.state().currentId,.93);Math.random=realRandom
 });
 assert.equal((await state()).relics.consumable,'bargain');
 // Use the actual clue branch to promise loot on another searched room.
 await reset();
 const target=await page.evaluate(()=>{
  localStorage.setItem('dof.learnedScavenge','1');const s=__dofTest.state(),id=s.rooms[s.currentId].links.find(id=>id!==s.exitId);
  __dofTest.markVisited([id]);window.realRandom=Math.random;Math.random=()=>0;
  __dofTest.scavenge(s.currentId,.9);Math.random=realRandom;return id
 });
 await page.waitForTimeout(250);
 s=await state();assert(s.rooms[target].lootClued&&s.rooms[target].hiddenScavengeReward);
 assert.equal(await page.locator('.cell[data-id="'+target+'"].loot-omen').count(),1);
 assert(await page.locator('.roomFeedback[data-room-id="'+target+'"]').count());
 const beforeGold=s.gold;
 await page.evaluate(id=>{__dofTest.setCurrent(id);__dofTest.scavenge(id,.99)},target);
 s=await state();assert(s.gold>beforeGold);assert.equal(s.pendingAction,null);assert.equal(s.rooms[target].hiddenScavengeReward,null);assert.equal(s.rooms[target].lootClued,false);
 // Serializable state, floor resets, full run reset.
 await page.evaluate(()=>{giveTrinket('doll');giveTrinket('blood')});
 assert.doesNotThrow(()=>JSON.parse(JSON.stringify(s.relics)));
 await reset();s=await state();assert.deepEqual(s.relics,{trinkets:[],capacity:3,consumable:null,floorUsed:{},bargainCharges:0,bargainRoom:null,coinCharges:0,coinRoom:null,wardArmed:false,pendingItem:null});
 // All relics fit the original footer height; slot remains touch-sized.
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);
  await page.evaluate(()=>{['doll','blood','eye'].forEach(giveTrinket);giveConsumable('bargain');__dofTest.useConsumable(true);giveConsumable('flask')});
  const geometry=await page.evaluate(()=>{
   const footer=document.querySelector('#footer').getBoundingClientRect(),slot=document.querySelector('#consumableSlot').getBoundingClientRect();
   return{height:footer.height,slot:slot.width,inside:slot.right<=innerWidth&&slot.bottom<=innerHeight,scroll:document.documentElement.scrollWidth<=innerWidth}
  });assert.equal(geometry.height,54);assert(geometry.slot>=44&&geometry.inside&&geometry.scroll);
  await reset();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS rare Scavenge items, persistent guaranteed loot clue, serializable/reset state, compact mobile footer; no runtime errors');
 await browser.close();browser=null;server.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();server.close();process.exitCode=1});

