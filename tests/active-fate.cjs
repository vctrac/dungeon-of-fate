const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>fs.readFile(path.join(root,req.url==='/'?'index.html':req.url),(err,data)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':req.url.endsWith('.png')?'image/png':'text/html');res.writeHead(err?404:200).end(data)}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER?{executablePath:process.env.PWA_BROWSER}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const state=()=>page.evaluate(()=>__dofTest.state()),reset=()=>page.evaluate(()=>__dofTest.newRun());
 const stats=await page.evaluate(()=>{
  const t=__dofTest,check=(v,m)=>{if(!v)throw Error(m)},original=Math.random;let gates=0,altars=0;const rewards={};
  for(let seed=1;seed<=1000;seed++){
   let n=seed;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};t.setCombo(3.4);t.setFloor(3+(seed%18));const s=t.state();
   check(t.normalReachableWithoutGate(),'normal reachability');check(s.rooms.every(r=>r.links.length<=4),'degree');
   check(s.rooms.filter(r=>r.event==='altar'&&r.active).length<=1,'one altar');
   if(s.altarRoom!==null){altars++;check(s.rooms[s.altarRoom].event==='altar'&&!s.rooms[s.altarRoom].altarUsed,'altar state')}
   if(s.fateGate){
    gates++;const g=s.fateGate,r=s.rooms[g.roomId];rewards[g.reward]=(rewards[g.reward]||0)+1;
    check(r.active&&r.links.length===1&&r.links[0]===g.parentId,'leaf');check(s.rooms[g.parentId].links.includes(r.id),'reciprocal');check(g.roomId!==s.startId&&g.roomId!==s.exitId,'endpoints');
    check(!r.known&&!g.discovered&&!g.entered,'hidden gate');check(g.requirement>3.4&&g.requirement<=4.3,'stretch');check(['treasure','rich','heal','consumable','trinket'].includes(r.event),'nonempty reward');
    t.setCombo(1);check(t.state().fateGate.requirement===g.requirement,'frozen');
   }
  }
  Math.random=original;check(gates>250&&gates<350,'gate frequency');check(altars>175&&altars<265,'altar frequency');
  for(const d of [1,2]){t.setFloor(d);check(!t.state().fateGate&&t.state().altarRoom===null,'early floors')}
  const distribution={};for(let i=0;i<10000;i++){const kind=t.gateReward((i+.5)/10000,true);distribution[kind]=(distribution[kind]||0)+1}
  return{floors:1000,gates,altars,rewards,distribution};
 });assert.deepEqual(stats.distribution,{treasure:5500,rich:3500,heal:800,consumable:150,trinket:50});console.log('PASS generation',JSON.stringify(stats));
 const findGate=()=>page.evaluate(()=>{const t=__dofTest;t.newRun();for(let i=0;i<100;i++){t.setCombo(3.4);t.setFloor(3);if(t.state().fateGate){const g=t.state().fateGate;t.setRoomFixture(g.roomId,{event:'treasure'});t.setRoomFixture(g.parentId,{event:'empty',eventResolved:true,visited:true,searched:true});return g}}throw Error('no gate')});
 let g=await findGate();assert.equal(await page.locator('.gateRune').count(),0);
 await page.evaluate(g=>{__dofTest.markVisited([g.parentId]);__dofTest.setCurrent(g.parentId);__dofTest.setCombo(g.requirement-.01)},g);
 assert.equal(await page.locator('.gateRune').count(),1);assert((await state()).fateGate.discovered);
 const before=await state();await page.evaluate(g=>__dofTest.enter(g.roomId),g);assert.equal((await state()).currentId,g.parentId);assert.equal((await state()).relics.coinCharges,before.relics.coinCharges);assert.equal((await state()).gold,before.gold);assert.equal(await page.locator('.fateRoom.gateDenied').count(),1);
 await page.evaluate(g=>{__dofTest.setCombo(g.requirement+1);__dofTest.setCombo(g.requirement-.01);__dofTest.enter(g.roomId)},g);assert.equal((await state()).currentId,g.parentId);assert(!(await state()).fateGate.entered);
 // Neither Clues nor existing debug teleport helper bypass the gate.
 await page.evaluate(g=>{__dofTest.revealClue(g.parentId,g.roomId);__dofTest.setCurrent(g.roomId);__dofTest.travel(g.roomId)},g);await page.waitForTimeout(230);assert.equal((await state()).currentId,g.parentId);
 await page.evaluate(g=>{__dofTest.setCombo(g.requirement);__dofTest.enter(g.roomId)},g);let s=await state();assert.equal(s.currentId,g.roomId);assert.equal(s.combo,g.requirement);assert(s.fateGate.entered);assert(!s.fateGate.resolved);await page.waitForFunction(()=>__dofTest.state().pendingAction===null);assert((await state()).fateGate.resolved);await page.waitForSelector('.gateResolved .gateRune');assert.equal(await page.locator('.gateResolved .gateRune').evaluate(el=>getComputedStyle(el).opacity),'0.45');
 await page.evaluate(g=>{__dofTest.setCombo(1);__dofTest.enter(g.parentId)},g);assert.equal((await state()).currentId,g.parentId);
 await page.evaluate(g=>__dofTest.enter(g.roomId),g);assert.equal((await state()).currentId,g.parentId);
 // A legitimate visited Gate still requires current FATE for Fast Travel back in; leaving stays possible.
 await page.evaluate(g=>{const t=__dofTest,s=t.state();t.markVisited(s.rooms.filter(r=>r.active&&r.id!==g.roomId).map(r=>r.id));t.setCurrent(s.startId);t.travel(g.roomId)},g);assert.notEqual((await state()).currentId,g.roomId);
 await page.evaluate(g=>{__dofTest.setCombo(g.requirement+1);__dofTest.travel(g.roomId)},g);await page.waitForFunction(g=>__dofTest.state().currentId===g.roomId&&!__dofTest.state().fastTraveling,g);s=await state();assert.equal(s.combo,Math.round((g.requirement+1)*100)/100);
 await page.evaluate(()=>{const s=__dofTest.state();__dofTest.setCombo(1);__dofTest.travel(s.startId)});await page.waitForFunction(()=>__dofTest.state().currentId===__dofTest.state().startId&&!__dofTest.state().fastTraveling);
 g=await findGate();await page.evaluate(g=>{const t=__dofTest,s=t.state();t.markVisited(s.rooms.filter(r=>r.active&&r.id!==g.roomId).map(r=>r.id));t.setCombo(1);t.setCurrent(s.exitId)},g);assert.equal(await page.evaluate(()=>__dofTest.unexploredCount()),0);assert(await page.evaluate(()=>__dofTest.awardPerfectFloor()));const floor=(await state()).floorNo;assert(await page.evaluate(()=>__dofTest.descend()));assert.equal((await state()).floorNo,floor+1);
 console.log('PASS frontier discovery, frozen/equal/current threshold, Clues, entry without cost, escape, Fast Travel restrictions and optional completion/descent');
 // Enter an actual generated Altar through an adjacent normal room.
 const findAltar=()=>page.evaluate(()=>{const t=__dofTest;t.newRun();for(let i=0;i<100;i++){t.setCombo(5.3);t.setFloor(4);const s=t.state();if(s.altarRoom!==null){const id=s.altarRoom,from=s.rooms[id].links.find(n=>!s.fateGate||n!==s.fateGate.roomId);t.setRoomFixture(from,{event:'empty',visited:true,searched:true,eventResolved:true});t.setCurrent(from);t.setVitals(1,false);t.enter(id);return{id,from}}}throw Error('no altar')});
 let altar=await findAltar();await page.waitForFunction(()=>__dofTest.state().cards.active?.type==='altar');s=await state();assert.equal(s.combo,5.3);assert.equal(s.hp,1);assert.equal(s.diceOverlay,'none');
 await page.locator('#altarOffer').tap();assert.equal((await state()).combo,5.3);assert.equal((await state()).hp,1);assert((await state()).cards.active);
 await page.locator('#itemName').tap();assert.equal((await state()).cards.active,null);assert(!(await state()).rooms[altar.id].altarUsed);
 await page.evaluate(a=>{__dofTest.enter(a.from);__dofTest.enter(a.id)},altar);assert.equal((await state()).cards.active,null);await page.locator('.current').tap();await page.waitForFunction(()=>__dofTest.state().cards.active?.type==='altar');
 // A canceled hold cannot sacrifice.
 let box=await page.locator('#altarOffer').boundingBox();await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();await page.waitForTimeout(220);await page.mouse.move(box.x+55,box.y+30);await page.waitForTimeout(500);await page.mouse.up();assert.equal((await state()).combo,5.3);
 // Existing Doll does not change an Altar exchange.
 await page.locator('#itemName').tap();await page.evaluate(()=>{__dofTest.acquireTrinket('doll');__dofTest.closeItemCard();__dofTest.openAltar(__dofTest.state().currentId)});
 box=await page.locator('#altarOffer').boundingBox();await page.mouse.move(box.x+40,box.y+40);await page.mouse.down();await page.waitForTimeout(250);assert.equal(await page.locator('#altarOffer.holding').count(),1);await page.waitForTimeout(450);await page.mouse.up();
 s=await state();assert.equal(s.combo,1);assert.equal(s.hp,2);assert(s.rooms[altar.id].altarUsed);assert(s.relics.trinkets.includes('doll'));assert.equal(s.cards.active,null);assert.equal(await page.evaluate(()=>__dofTest.sacrificeAltar()),false);
 await page.evaluate(a=>{__dofTest.enter(a.from);__dofTest.setCombo(4);__dofTest.enter(a.id)},altar);assert.equal((await state()).cards.active,null);assert.equal((await state()).hp,2);
 for(const [hp,fate] of [[3,5],[1,1]]){altar=await findAltar();await page.waitForFunction(()=>__dofTest.state().cards.active?.type==='altar');await page.locator('#itemName').tap();await page.evaluate(({hp,fate})=>{__dofTest.setVitals(hp,false);__dofTest.setCombo(fate);__dofTest.openAltar(__dofTest.state().currentId)},{hp,fate});assert(await page.locator('#altarOffer').isDisabled());assert.equal(await page.evaluate(()=>__dofTest.sacrificeAltar()),false);await page.locator('#itemName').tap();assert.equal((await state()).hp,hp);assert.equal((await state()).combo,fate)}
 console.log('PASS Altar no-dice/no-auto-use, canceled/tap/held input, revisit, ×1/full-health rejection, one-use healing and Doll preservation');
 // The intended Gate/Altar conflict uses no special-case bypass.
 await reset();const conflict=await page.evaluate(()=>{const t=__dofTest;for(let i=0;i<200;i++){t.setCombo(5.3);t.setFloor(6);const s=t.state();if(s.fateGate&&s.altarRoom!==null){t.setCombo(s.fateGate.requirement);t.setVitals(1,false);t.setCurrent(s.altarRoom);const available=t.gateAccess(s.altarRoom,s.fateGate.roomId,false);t.openAltar(s.altarRoom);t.sacrificeAltar();return{available,after:t.gateAccess(s.altarRoom,s.fateGate.roomId,false),hp:t.state().hp,fate:t.state().combo,requirement:t.state().fateGate.requirement,original:s.fateGate.requirement}}}throw Error('no combined floor')});assert(conflict.available&&!conflict.after);assert.equal(conflict.hp,2);assert.equal(conflict.fate,1);assert.equal(conflict.requirement,conflict.original);
 // Every Gate reward goes through the existing room-entry and card/encounter pipeline.
 for(const event of ['treasure','rich','heal','trinket','consumable']){g=await findGate();await page.evaluate(({g,event})=>{__dofTest.setCurrent(g.parentId);__dofTest.setRoomFixture(g.roomId,{event});__dofTest.setCombo(g.requirement);__dofTest.enter(g.roomId)},{g,event});await page.waitForTimeout(300);s=await state();assert.equal(s.currentId,g.roomId);if(event==='heal'){assert.equal(s.diceOverlay,'flex');await page.evaluate(()=>__dofTest.clearPending())}else if(event==='trinket'||event==='consumable'){assert.equal(s.cards.active.kind,event);await page.evaluate(()=>__dofTest.closeItemCard())}else assert(s.gold>0)}
 await reset();await page.locator('#consumableSlot').tap();assert(await page.locator('#closeItem').isHidden());const item=(await state()).relics.consumable;await page.mouse.click(3,3);assert.equal((await state()).cards.active,null);assert.equal((await state()).relics.consumable,item);
 for(const id of ['eye','blood','doll']){await page.evaluate(id=>__dofTest.acquireTrinket(id),id);assert(await page.locator('#closeItem').isHidden());await page.locator('#itemArt').tap()}
 await page.evaluate(()=>__dofTest.acquireTrinket('horseshoe'));await page.mouse.click(3,3);assert((await state()).cards.active.decision);await page.locator('#closeItem').click();
 for(const size of [{width:320,height:568},{width:844,height:390}]){await page.setViewportSize(size);altar=await findAltar();await page.waitForFunction(()=>__dofTest.state().cards.active?.type==='altar');const bounds=await page.locator('.itemChoicePanel').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=size.width&&bounds.y+bounds.height<=size.height);const target=await page.locator('#altarOffer').boundingBox();assert(target.height>=80);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));await page.locator('#itemName').tap()}
 assert.deepEqual(errors,[]);console.log('PASS Gate reward integration, broad informational dismissal, explicit replacement decisions, mobile Altar bounds and no runtime errors');
}finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
