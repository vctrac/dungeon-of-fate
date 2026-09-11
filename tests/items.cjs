const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>fs.readFile(path.join(root,req.url==='/'?'index.html':req.url),(err,data)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':req.url.endsWith('.png')?'image/png':'text/html');res.writeHead(err?404:200).end(data)}));
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER?{executablePath:process.env.PWA_BROWSER}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);const state=()=>page.evaluate(()=>__dofTest.state()),reset=()=>page.evaluate(()=>__dofTest.newRun());
 const close=()=>page.locator('#closeItem:visible, .itemChoicePanel:has(#closeItem[hidden]) #itemName').click();
 const hold=async()=>{const b=await page.locator('#consumableSlot').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.waitForTimeout(250);assert.equal(await page.locator('#consumableSlot.holding').count(),1);await page.waitForTimeout(370);await page.mouse.up()};
 const starters=await page.evaluate(()=>{const found={coin:0,ward:0};for(let i=0;i<60;i++){__dofTest.newRun();const s=__dofTest.state();if(s.cards.active||s.relics.coinCharges||s.relics.wardArmed||s.relics.trinkets.length)throw Error('starter effects');found[s.relics.consumable]++}return found});assert(starters.coin>0&&starters.ward>0);
 const held=(await state()).relics.consumable;assert.equal(await page.locator('#consumableSlot.itemAttention').count(),1);
 await page.locator('#consumableSlot').tap();assert.equal(await page.locator('#itemName').innerText(),held==='coin'?'Fortune Coin':'Trap Ward');assert.equal((await state()).relics.consumable,held);assert.equal(await page.locator('#consumableSlot.itemAttention').count(),0);await close();
 assert.equal((await state()).pendingAction,null);await reset();assert.equal(await page.locator('#consumableSlot.itemAttention').count(),0);
 await page.evaluate(()=>__dofTest.setConsumable('coin'));await hold();assert.equal((await state()).relics.coinCharges,5);assert.equal((await state()).relics.consumable,null);assert.equal((await state()).cards.active,null);
 console.log('PASS random one-item starter, no automatic activation, tap inspection, learned cue, hold ring and no click after hold');
 // Acquisition cards and full-build decisions commit once; ordinary close cannot move the player.
 await reset();
 for(const id of ['doll','eye','blood']){await page.evaluate(id=>__dofTest.acquireTrinket(id),id);assert.equal((await state()).cards.active.id,id);assert(await page.locator('#itemVisual').innerText());await close()}
 assert.equal((await state()).relics.trinkets.length,3);assert.equal(await page.locator('#trinkets button').count(),3);
 const before=(await state()).currentId;await page.locator('.trinket[data-item="eye"]').tap();assert.equal((await state()).cards.active.mode,'inspect');await close();assert.equal((await state()).currentId,before);
 await page.evaluate(()=>__dofTest.acquireTrinket('horseshoe'));assert((await state()).cards.active.decision);assert.equal(await page.locator('#replaceTrinkets button').count(),3);await page.waitForTimeout(1800);assert((await state()).cards.active.decision);await close();assert.deepEqual((await state()).relics.trinkets,['doll','eye','blood']);
 await page.evaluate(()=>__dofTest.acquireTrinket('horseshoe'));await page.locator('.replaceTrinket[data-item="eye"]').click();assert.deepEqual((await state()).relics.trinkets,['doll','blood','horseshoe']);assert(!(await state()).rooms.some(r=>r.eyeMarked));
 assert.equal(await page.evaluate(()=>__dofTest.acquireTrinket('blood')),false);
 await page.evaluate(()=>__dofTest.offerConsumable('flask'));assert((await state()).cards.active.decision);await page.locator('#takeItem').click();assert.equal((await state()).relics.consumable,'flask');assert.equal((await state()).cards.active,null);
 // Queue important loot behind an unresolved battle, then behind another card.
 await reset();await page.evaluate(()=>{__dofTest.showDice('monster','basic');__dofTest.acquireTrinket('eye');__dofTest.offerConsumable('flask')});assert.equal((await state()).cards.queue.length,2);assert.equal((await state()).cards.active,null);
 await page.evaluate(()=>{__dofTest.resolveDice('monster',5);__dofTest.continueEncounter()});assert.equal((await state()).cards.active.id,'eye');const gold=(await state()).gold;await close();assert.equal((await state()).cards.active.id,'flask');await page.locator('#keepItem').click();assert.equal((await state()).pendingAction,null);assert.equal((await state()).gold,gold);
 console.log('PASS reusable cards, three-slot cap, reject/replace, duplicate prevention, and battle → loot → choice → map');
 // Actual movement pipeline: Coin does not affect its activation room, includes fifth room and Scavenge, and excludes revisits.
 await reset();await page.evaluate(()=>{__dofTest.setConsumable('coin');__dofTest.setCombo(1);__dofTest.useConsumable(true);__dofTest.resolveSimple('treasure')});assert.equal((await state()).gold,30);
 for(let i=1;i<=5;i++){
  await page.evaluate(()=>{const s=__dofTest.state(),id=s.rooms[s.currentId].links.find(id=>id!==s.exitId);__dofTest.setCombo(1);__dofTest.setRoomFixture(id,{event:'treasure',visited:false,searched:false,eventResolved:false});__dofTest.enter(id)});
  const before=(await state()).gold;await page.waitForFunction(()=>__dofTest.state().pendingAction===null);const s=await state();assert.equal(s.gold-before,60);assert.equal(s.relics.coinCharges,5-i);assert.equal(s.relics.coinRoom,s.currentId);
 }
 await page.evaluate(()=>{localStorage.setItem('dof.learnedScavenge','1');__dofTest.setCombo(1);__dofTest.scavenge(__dofTest.state().currentId,.55)});let s=await state();assert.equal(s.relics.coinCharges,0);assert.equal(await page.locator('#coinState').innerText(),'🪙×2 ◉');
 await page.evaluate(()=>{const s=__dofTest.state(),id=s.rooms[s.currentId].links[0];__dofTest.setRoomFixture(id,{visited:true,searched:true,eventResolved:true});__dofTest.enter(id)});assert.equal((await state()).relics.coinRoom,null);assert.equal((await state()).relics.coinCharges,0);
 // All relevant Gold paths double once, including guaranteed clues and Horseshoe, but not unrelated wallet changes.
 for(const type of ['treasure','rich','key','monster','trap','heal','loot','scavenge','horseshoe']){
  const gains=[];
  for(const coin of [false,true])gains.push(await page.evaluate(({type,coin})=>{
   const t=__dofTest;t.newRun();t.setConsumable(null);t.setVitals(2,false);if(type==='horseshoe'){t.acquireTrinket('horseshoe');t.closeItemCard()}
   if(coin){t.setConsumable('coin');t.useConsumable(true);t.beginRoomEffects(t.state().currentId,true)}t.setCombo(1);
   if(['treasure','rich','key'].includes(type))t.resolveSimple(type);
   else if(type==='loot'){t.setRoomFixture(t.state().currentId,{hiddenScavengeReward:{kind:'gold',base:12}});t.scavenge(t.state().currentId,.5)}
   else if(type==='scavenge'){localStorage.setItem('dof.learnedScavenge','1');t.scavenge(t.state().currentId,.55)}
   else t.resolveDice(type==='horseshoe'?'monster':type,6);
   return t.state().gold;
  },{type,coin}));assert.equal(gains[1],gains[0]*2,type)
 }
 // Coin entry state clears at a floor boundary without spending an extra entry.
 await reset();await page.evaluate(()=>{__dofTest.setConsumable('coin');__dofTest.useConsumable(true);__dofTest.beginRoomEffects(__dofTest.state().currentId,true);__dofTest.setFloor(2)});assert.equal((await state()).relics.coinCharges,4);assert.equal((await state()).relics.coinRoom,null);
 console.log('PASS Coin: 5 actual entries, activation-room exclusion, fifth room, revisits, all reward paths, floor transition');
 // Ward remains until a trap and bypasses the entire roll, including Scavenge traps.
 for(const scavenged of [false,true]){
  await reset();await page.evaluate(()=>{__dofTest.setConsumable('ward');__dofTest.useConsumable(true);__dofTest.setCombo(5);__dofTest.setFloor(2)});assert((await state()).relics.wardArmed);
  if(scavenged)await page.evaluate(()=>{localStorage.setItem('dof.learnedScavenge','1');__dofTest.scavenge(__dofTest.state().currentId,.99)});
  else{await page.evaluate(()=>{const s=__dofTest.state(),id=s.rooms[s.currentId].links.find(id=>id!==s.exitId);__dofTest.setRoomFixture(id,{event:'trap',visited:false,searched:false,eventResolved:false});__dofTest.enter(id)});await page.waitForFunction(()=>__dofTest.state().pendingAction===null)}
  s=await state();assert(!s.relics.wardArmed);assert.equal(s.hp,3);assert.equal(s.combo,5);assert.equal(s.diceOverlay,'none');assert.equal(s.pendingAction,null);
 }
 // Lethal rescue must survive encounter continuation at either low or high Fate.
 for(const fate of [1,7]){
  await reset();await page.evaluate(fate=>{__dofTest.acquireTrinket('doll');__dofTest.closeItemCard();__dofTest.setVitals(1,false);__dofTest.setCombo(fate);__dofTest.showDice('monster','basic');__dofTest.resolveDice('monster',1)},fate);
  s=await state();assert.equal(s.hp,1);assert.equal(s.combo,1);assert(!s.relics.trinkets.includes('doll'));assert.equal(await page.locator('.dollRescue').count()>0,true);await page.evaluate(()=>__dofTest.continueEncounter());assert.equal((await state()).overlay,'none');
 }
 console.log('PASS persistent Ward skips room/Scavenge trap rolls; Doll rescue survives continuation at ×1 and high Fate');
 // Narrow phones + landscape: every card and replacement choice stays reachable without page scrolling.
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);await reset();
  for(const id of ['doll','blood','eye'])await page.evaluate(id=>{__dofTest.acquireTrinket(id);__dofTest.closeItemCard()},id);
  await page.evaluate(()=>__dofTest.acquireTrinket('horseshoe'));
  const layout=await page.evaluate(()=>{const p=document.querySelector('.itemChoicePanel'),r=p.getBoundingClientRect(),b=document.querySelector('#consumableSlot').getBoundingClientRect();return{inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,scroll:document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight,slot:b.width>=44&&b.right<=innerWidth,overflow:p.scrollHeight>p.clientHeight}});assert(layout.inside&&layout.scroll&&layout.slot);
  await page.locator('#closeItem').scrollIntoViewIfNeeded();await close();
 }
 assert.deepEqual(errors,[]);console.log('PASS phone/landscape card bounds, replacement controls, no document overflow or runtime errors');
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
