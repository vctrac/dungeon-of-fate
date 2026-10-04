const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=http.createServer((q,r)=>fs.readFile(path.join(root,q.url==='/'?'index.html':q.url),(err,data)=>{r.setHeader('Content-Type',q.url.endsWith('.png')?'image/png':q.url.endsWith('.js')?'application/javascript':'text/html');r.writeHead(err?404:200).end(data)}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);const touch=await page.context().newCDPSession(page);
 const snap=()=>page.evaluate(()=>{const s=__dofTest.serializeRun();return{run:s.run,floor:s.floor,relicState:s.relicState,pending:s.pending}});
 async function send(type,x,y){await touch.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y}]})}
 async function drag(panel,dy){const b=await page.locator(panel).boundingBox(),x=b.x+b.width*.5,y=b.y+b.height*.38;await send('touchStart',x,y);await send('touchMove',x,y+dy);await send('touchEnd');await page.waitForTimeout(230)}
 async function hold(selector,{ms=730,jitter=false,cancel=false,foreign=false}={}){
  const b=await page.locator(selector).boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  await send('touchStart',x,y);assert(await page.locator(selector).evaluate(e=>e.classList.contains('holding')));
  if(foreign)await page.locator(selector).evaluate(e=>{for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])e.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:999,isPrimary:false,pointerType:'touch',clientX:0,clientY:0}))});
  if(jitter){for(const [dx,dy] of [[3,4],[-4,3],[5,-4],[-3,-2]]){await page.waitForTimeout(45);await send('touchMove',x+dx,y+dy)}await page.waitForTimeout(Math.max(0,ms-180))}else await page.waitForTimeout(ms);
  await send(cancel?'touchCancel':'touchEnd');await page.waitForTimeout(30)
 }
 // Reproduces the original mobile failure: touch drag emits no click, leaving the reused panel's drag suppression armed.
 await page.evaluate(()=>{const t=__dofTest;t.newRun();t.applyCondition('weakness');t.setRoomFixture(t.state().currentId,{event:'garden',contentState:{seen:false,resolved:false,consumed:false}});t.openContent(t.state().currentId,true)});
 await drag('.itemChoicePanel',120);assert(await page.locator('#itemChoice').isHidden());await page.evaluate(()=>__dofTest.openContent(__dofTest.state().currentId,false));await hold('#contentAction',{jitter:true});assert.deepEqual((await snap()).run.conditions,{});assert(await page.locator('#itemChoice').isHidden());
 console.log('PASS actual touch dismiss/reopen then FIRST jittered REST succeeds, without a preliminary hold');
 // Every existing gameplay action traverses the same capture guard, including the encounter panel's REROLL.
 for(const action of ['corpse','flower','food','garden','hole','chest','altar','loose','replacement','boss','reroll']){
  await page.evaluate(action=>{const t=__dofTest;t.newRun();t.setVitals(2,false);t.setCombo(5);const id=t.state().currentId;
   if(['corpse','flower','food','garden','hole'].includes(action)){t.applyCondition('weakness');t.setRoomFixture(id,{event:action,contentState:{seen:false,resolved:false,consumed:false}});t.openContent(id,true)}
   if(action==='chest'){t.setRoomFixture(id,{event:'chest',chest:{kind:'consumable',itemId:'flask',fallbackItemId:null,opened:false,cardSeen:false}});t.openChestCard(id,false)}
   if(action==='altar'){t.setRoomFixture(id,{event:'altar',altarUsed:false});t.openAltar(id,false)}
   if(action==='loose'){t.setConsumable('ward');t.setRoomFixture(id,{droppedConsumable:'flask'});t.openDroppedConsumable(id)}
   if(action==='replacement'){for(const name of ['doll','eye','blood']){t.acquireTrinket(name);t.closeItemCard()}t.acquireTrinket('horseshoe')}
   if(action==='boss'){t.setFloor(25);t.setCurrent(t.state().exitId);t.openBossCard(t.state().exitId)}
   if(action==='reroll'){t.showDice('monster','basic');t.revealOutcome()}
  },action);
  const selector=action==='chest'?'#chestOpen':action==='altar'?'#altarOffer':action==='loose'?'#takeItem':action==='replacement'?'#replaceSelected':action==='reroll'?'#rerollButton':'#contentAction',panel=action==='reroll'?'.encounterPanel':'.itemChoicePanel';
  if(action==='replacement'){await page.locator('.replaceTrinket[data-item="eye"]').click();assert(await page.locator(selector).isEnabled())}await page.waitForSelector(selector+':visible');
  const before=await snap();await drag(panel,40);assert.deepEqual(await snap(),before); // cancelled drag must not swallow the next valid hold either
  await hold(selector,{jitter:true,foreign:true});const after=await snap();assert.notDeepEqual(after,before,action+' first complete hold');
  if(action==='boss'){assert.equal(after.floor.rooms[after.floor.exitId].boss.state,'active');assert.equal(after.floor.rooms[after.floor.exitId].boss.round,1)}
  if(action==='reroll')assert(after.pending.encounter.rerollUsed);
  if(action==='loose'){assert.equal(after.relicState.consumable,'flask');assert.equal(after.floor.rooms[after.floor.currentId].droppedConsumable,'ward')}
  if(action==='replacement')assert.deepEqual(after.relicState.trinkets,['doll','blood','horseshoe']);
  // Release/click did not dismiss the new encounter or mutate its result again.
  assert.deepEqual(await snap(),after,action+' single commit');
 }
 console.log('PASS all 11 current action paths: first uninterrupted real touch hold, normal jitter, foreign pointers and single commit');
 // Future shared actions use the same contract; sample the authoritative progress without production logging.
 await page.evaluate(()=>{const t=__dofTest;t.newRun();if(!t.showCodex())throw Error('Archive fixture');t.closeCodex();t.inspectItem('consumable',t.state().relics.consumable);const b=document.createElement('button');b.id='futureHold';b.textContent='TEST';b.style.cssText='height:44px';window.count=0;window.charges=[];b.addEventListener('click',()=>count++);const set=b.style.setProperty.bind(b.style);b.style.setProperty=(k,v,...rest)=>{if(k==='--charge')charges.push(parseFloat(v));return set(k,v,...rest)};document.querySelector('.cardContent').appendChild(b)});
 await drag('.itemChoicePanel',40);await page.locator('#futureHold').tap();await hold('#futureHold',{ms:120});await hold('#futureHold',{ms:100,cancel:true});assert.equal(await page.evaluate(()=>count),0);assert(await page.locator('#itemChoice').isVisible());await hold('#futureHold',{jitter:true});assert.equal(await page.evaluate(()=>count),1);assert.equal(await page.evaluate(()=>Math.max(...charges)),360);assert(await page.locator('#itemChoice').isVisible());assert.equal(await page.locator('.cardDismiss:has(#futureHold)').evaluate(e=>getComputedStyle(e).transform),'none');
 // A release just after the threshold must honor elapsed time even between RAF callbacks.
 await page.evaluate(()=>{const raf=window.requestAnimationFrame;window.oldHoldRAF=raf;window.requestAnimationFrame=fn=>{if(fn.name==='tick'){window.delayedHoldTick=fn;return raf(()=>{})}return raf(fn)}});await hold('#futureHold',{ms:680});assert.equal(await page.evaluate(()=>count),2);await page.evaluate(()=>{window.requestAnimationFrame=oldHoldRAF;delayedHoldTick(performance.now()+1000)});assert.equal(await page.evaluate(()=>count),2);
 await drag('.itemChoicePanel',120);assert(await page.locator('#itemChoice').isHidden());
 assert.deepEqual(errors,[]);console.log('PASS future action default, 100% elapsed-time progress, action pointer never drags the Card, and intentional drag still dismisses');
 }finally{if(browser)await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
