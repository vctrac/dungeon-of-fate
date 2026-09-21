const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),baseline=process.env.LAYER_BASELINE;
const server=http.createServer((req,res)=>fs.readFile(req.url==='/'?(baseline||path.join(root,'index.html')):path.join(root,req.url),(e,data)=>{res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':'text/html');res.writeHead(e?404:200).end(data)}));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,...(process.env.PWA_BROWSER?{executablePath:process.env.PWA_BROWSER}:{})});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 const results=[];
 for(const type of ['upper','lower'])for(const back of [false,true]){
  await page.evaluate(({type,back})=>{const t=__dofTest;t.newRun();for(let i=0;i<500;i++){t.setFloor(20);const s=t.serializeRun();if(s.floor.layers[1]?.type!==type)continue;
   s.floor.rooms.forEach(r=>{if(r.active)r.known=r.visited=r.searched=r.eventResolved=true});if(s.fateGate)s.fateGate.entered=s.fateGate.discovered=true;
   const stair=s.floor.rooms.find(r=>r.event==='stairs'&&r.layerId===(back?1:0));s.floor.activeLayer=stair.layerId;s.floor.currentId=stair.links[0];s.floor.history.push(s.floor.currentId);
   if(!t.restoreRun(s))throw Error('fixture');t.enter(stair.id);window.originId=stair.id;window.originMoves=t.serializeRun().run.totalMoves;return
  }throw Error('no layers')},{type,back});
  await page.evaluate(()=>{window.oldMap=document.querySelector('#activeMap');window.mutations=0;window.observer=new MutationObserver(ms=>{for(const m of ms)mutations+=m.addedNodes.length+m.removedNodes.length});__dofTest.traverseStairs();window.destMap=document.querySelector('#activeMap');observer.observe(document.querySelector('#board'),{childList:true,subtree:true});window.retained=document.querySelector('.layerGhost')===oldMap});
  await page.waitForTimeout(90);
  const a=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  await page.waitForTimeout(280);
  const b=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const during=await page.evaluate(()=>({mutations,retained,stable:document.querySelector('#activeMap')===destMap,source:oldMap.isConnected,locked:document.querySelector('#activeMap').inert}));
  results.push({type,back,...during,layouts:b.LayoutCount-a.LayoutCount,recalcMs:Math.round((b.RecalcStyleDuration-a.RecalcStyleDuration)*1000),layoutMs:Math.round((b.LayoutDuration-a.LayoutDuration)*1000),taskMs:Math.round((b.TaskDuration-a.TaskDuration)*1000)});
  if(!baseline){assert(during.retained&&during.stable&&during.source&&during.locked);assert.equal(during.mutations,0);assert.equal(b.LayoutCount-a.LayoutCount,0);
   await page.evaluate(()=>{const held=__dofTest.state().relics.consumable;if(__dofTest.inspectItem('consumable',held)||__dofTest.useConsumable(true))throw Error('input during transition');__dofTest.update();__dofTest.traverseStairs();__dofTest.traverseStairs();if(document.querySelector('#activeMap')!==destMap)throw Error('redraw during animation')});
  }
  await page.waitForFunction(()=>!__dofTest.layerInfo().transition);
  await page.evaluate(()=>observer.disconnect());
  if(!baseline){assert.equal(await page.locator('.layerGhost,.layerCompositing').count(),0);assert.equal(await page.locator('#activeMap').evaluate(e=>e.inert),false);assert.equal(await page.evaluate(()=>__dofTest.serializeRun().run.totalMoves-originMoves),1)}
 }
 console.log(baseline?'BASELINE':'OPTIMIZED',JSON.stringify(results));
 if(!baseline){
  // Pending RAF/timers are canceled by lifecycle cleanup; return never restarts a visual transition.
  await page.evaluate(()=>{__dofTest.traverseStairs();window.committed=__dofTest.serializeRun();window.dispatchEvent(new Event('pagehide'))});
  assert.equal(await page.locator('.layerGhost').count(),0);await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>__dofTest.layerInfo().transition),false);
  await page.reload();await page.locator('#continueRun').click();assert.equal(await page.evaluate(()=>__dofTest.layerInfo().transition),false);
  // Repeat using actual taps and wait for completion rather than assuming timer/refresh alignment.
  for(let i=0;i<6;i++){await page.locator('#activeMap .current').tap();await page.waitForFunction(()=>!__dofTest.layerInfo().transition);assert.equal(await page.locator('.layerGhost,.layerCompositing').count(),0)}
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#activeMap .current').tap();assert.equal(await page.evaluate(()=>__dofTest.layerInfo().transition),false);
  const css=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const keyframe of css.matchAll(/@keyframes layer[^\n]+/g))assert(!/filter|blur|width|height|left|top/.test(keyframe[0]));
  assert.deepEqual(errors,[]);console.log('PASS stable source/destination, zero mid-animation DOM mutations/layout, deferred redraw, rapid taps, four directions, repeated cleanup, background/reload and reduced motion');
 }
}finally{if(browser)await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
