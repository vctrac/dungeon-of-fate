const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),server=http.createServer((q,r)=>fs.readFile(path.join(root,q.url==='/'?'index.html':q.url),(err,data)=>{r.setHeader('Content-Type',q.url.endsWith('.png')?'image/png':q.url.endsWith('.js')?'application/javascript':'text/html');r.writeHead(err?404:200).end(data)}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PWA_BROWSER});const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const snapshot=()=>page.evaluate(()=>{const s=__dofTest.serializeRun();return{run:s.run,floor:s.floor,relicState:s.relicState,pending:s.pending}});
 async function press(selector,ms){const b=await page.locator(selector).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();assert(await page.locator(selector).evaluate(e=>e.classList.contains('holding')));await page.waitForTimeout(ms);await page.mouse.up()}
 for(const type of ['corpse','flower','food','garden','hole']){
  await page.evaluate(type=>{const t=__dofTest;t.newRun();t.setVitals(2,false);t.applyCondition('sickness');t.setRoomFixture(t.state().currentId,{event:type,contentState:{seen:false,resolved:false,consumed:false}});t.openContent(t.state().currentId,true)},type);
  const before=await snapshot();await page.locator('#contentAction').tap();assert.deepEqual(await snapshot(),before);await press('#contentAction',140);assert.deepEqual(await snapshot(),before);assert(await page.locator('#itemChoice').isVisible());
  await press('#contentAction',710);const after=await snapshot();assert.notDeepEqual(after,before);if(type==='corpse'||type==='hole')assert.equal(after.pending.encounter.type,type);else if(type==='garden')assert.deepEqual(after.run.conditions,{});else assert(after.floor.rooms[after.floor.currentId].contentState.consumed);
  await page.mouse.up();assert.deepEqual(await snapshot(),after);
 }
 console.log('PASS Discovery SEARCH/PICK/FRUIT/REST/REACH: tap/partial no mutation or dismissal, full hold commits once');
 // Future buttons inherit the contract without registration or individual pointer handlers.
 await page.evaluate(()=>{const t=__dofTest;t.newRun();t.inspectItem('consumable',t.state().relics.consumable);const b=document.createElement('button');b.id='futureAction';b.textContent='FUTURE TEST ACTION';b.style.cssText='position:absolute;left:20%;top:75%;width:60%;height:50px;z-index:20';window.activations=0;b.addEventListener('click',()=>activations++);document.querySelector('.itemChoicePanel').appendChild(b)});
 await page.locator('#futureAction').tap();await press('#futureAction',100);assert.equal(await page.evaluate(()=>activations),0);
 const b=await page.locator('#futureAction').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x-20,b.y);await page.waitForTimeout(720);await page.mouse.up();assert.equal(await page.evaluate(()=>activations),0);assert(await page.locator('#itemChoice').isVisible());
 await page.locator('#futureAction').focus();await page.keyboard.down('Enter');await page.waitForTimeout(100);await page.keyboard.up('Enter');assert.equal(await page.evaluate(()=>activations),0);
 await page.keyboard.down('Enter');await page.waitForTimeout(720);await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.equal(await page.evaluate(()=>activations),1);
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.locator('#futureAction').dispatchEvent('pointerdown',{pointerId:99,isPrimary:false,pointerType:'touch'});await page.waitForTimeout(720);await page.mouse.up();assert.equal(await page.evaluate(()=>activations),1);
 await page.mouse.down();await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.waitForTimeout(720);await page.mouse.up();assert.equal(await page.evaluate(()=>activations),1);
 await press('#futureAction',710);assert.equal(await page.evaluate(()=>activations),2);await page.locator('#itemChoice').tap({position:{x:3,y:3}});assert(await page.locator('#itemChoice').isHidden());
 console.log('PASS automatic future action default, drag cancellation, keyboard, multi-touch, lifecycle, single commit and outside informational dismissal');
 await page.evaluate(()=>document.querySelector('#futureAction').remove());
 for(const selector of ['#takeItem','#replaceSelected']){
  await page.evaluate(selector=>{const t=__dofTest;t.newRun();if(selector==='#takeItem'){t.setConsumable('ward');t.offerConsumable('flask')}else{for(const id of ['doll','eye','blood']){t.acquireTrinket(id);t.closeItemCard()}t.acquireTrinket('horseshoe')}},selector);
  await page.waitForSelector(selector+':visible');if(selector==='#replaceSelected')await page.locator('.replaceTrinket[data-item="eye"]').click();
  const before=await snapshot();await page.locator(selector).tap();await press(selector,140);assert.deepEqual(await snapshot(),before);assert(await page.locator('#itemChoice').isVisible());
  await press(selector,710);const after=await snapshot();if(selector==='#takeItem'){assert.equal(after.relicState.consumable,'flask');assert.equal(after.floor.rooms[after.floor.currentId].droppedConsumable,'ward')}else assert.deepEqual(after.relicState.trinkets,['doll','blood','horseshoe']);
 }
 // Removing the decision before the threshold invalidates its callback.
 await page.evaluate(()=>{const t=__dofTest;t.newRun();t.setRoomFixture(t.state().currentId,{event:'flower',contentState:{seen:false,resolved:false,consumed:false}});t.openContent(t.state().currentId,true)});
 const a=await page.locator('#contentAction').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.evaluate(()=>__dofTest.closeItemCard());await page.waitForTimeout(720);await page.mouse.up();assert(!(await snapshot()).floor.rooms[(await snapshot()).floor.currentId].contentState.consumed);
 console.log('PASS loose exchange and selected Trinket confirmation require hold; closing mid-hold cancels safely');
 assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
