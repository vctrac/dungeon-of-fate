// Focused graph/RNG checks without browser timing or rendering.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const el=()=>({style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},focus(){},remove(){},textContent:'',children:[]});
const nodes={},context=vm.createContext({console,document:{querySelectorAll(){return []},getElementById:id=>nodes[id]||(nodes[id]=el()),addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout(){return 1},clearTimeout(){},requestAnimationFrame(){return 1},cancelAnimationFrame(){},performance:{now:()=>0}});
const checks=String.raw`
function check(v,m){if(!v)throw Error(m)}
const random=Math.random,stats=[];let pairedShrines=0,emptyLayers=0,upper=0,secondaryExit=0,multi=0,secondaryContent=new Set();
for(const depth of [1,2,3,5,6,10,11,25]){
 let count=0;for(let seed=1;seed<=500;seed++){
  let n=seed+depth*10000;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};
  combo=seed%2?1:10;floorNo=depth;newFloor(false,"");const saved=serializeRun();
  check(validateSave(saved),'generated save depth '+depth+' seed '+seed);
  const shrines=rooms.filter(r=>r.active&&r.event==='heal');
  layers.forEach(l=>{const n=shrines.filter(r=>r.layerId===l.id).length;check(n<=1,'Shrine cap at depth '+depth+' seed '+seed);if(!n)emptyLayers++});
  if(shrines.length===2)pairedShrines++;
  check(layers.length<=2&&activeLayer===0&&layerOf(startId)===0,'base/max layers');
  check(normalReachableWithoutGate(),'combined reachable without Gate');
  check(rooms.filter(r=>r.event==='chest').length<=1&&rooms.filter(r=>r.event==='altar').length<=1,'floor special caps');
  if(depth>1)check(rooms.filter(r=>r.active&&r.event==='trap'&&!inGateBranch(r.id)).length===2,'fixed ordinary Trap budget');
  check(floorEconomy.bonusShrines<=1&&fortuneBudget<=5,'Fortune once per floor');
  const stairs=rooms.filter(r=>r.event==='stairs');check(stairs.length===(layers.length===2?2:0),'stairs');
  if(layers.length===2){
   count++;multi++;if(layers[1].height===1)upper++;if(layerOf(exitId)===1)secondaryExit++;
   const [a,b]=stairs;check(a.x===b.x&&a.y===b.y&&a.stairTo===b.id&&b.stairTo===a.id,'aligned reciprocal stairs');
   check(!rooms.some(r=>r.layerId===1&&r.known),'no early layer reveal');
   const normal=rooms.filter(r=>r.active&&r.layerId===1&&!inGateBranch(r.id));check(normal.length>=12&&normal.length<=18,'secondary size');
   normal.forEach(r=>secondaryContent.add(r.event));
   check(rooms.every(r=>r.links.every(id=>layerOf(id)===layerOf(r.id))),'horizontal links only');
   check(shortestVisitedPath(a.id,b.id)===null,'no cross-layer walk');
   for(const mutate of [
    x=>x.floor.rooms[a.id].stairTo=b.id+1,
    x=>x.floor.activeLayer=1,
    x=>x.floor.layers[1].height=0,
    x=>x.floor.rooms[b.id].layerId=0,
    x=>x.floor.rooms[b.id].links.push(a.id)
   ]){let bad=jsonCopy(saved);mutate(bad);check(!validateSave(bad),'reject malformed layers')}
  }
 }
 const rate=count/500;check(Math.abs(rate-layerChance(depth))<.065,'layer probability');stats.push({depth,rate});
}
check(pairedShrines>0&&emptyLayers>0,"two Shrines possible; empty layers allowed");
Math.random=random;check(Math.abs(upper/multi-.5)<.065&&Math.abs(secondaryExit/multi-.35)<.065,'direction/EXIT odds');check(secondaryContent.has('monster')&&secondaryContent.has('trap')&&secondaryContent.has('chest')&&secondaryContent.has('altar'),'ordinary secondary content');
console.log('PASS 4,000 floors, schema, topology, caps, size, stairs, fog, local paths; odds',stats,{multi,upper:upper/multi,secondaryExit:secondaryExit/multi});
`;
let script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
script=script.replace('bootRun();\n})();',`saveRun=flushRun=function(){};renderItemCard=revealAcquiredItem=dollRescue=update=updateRelicHUD=clearFeedback=showLocalFeedback=updateContext=effectNotice=theftFeedback=markArrival=resourceFlight=function(){};\nbeginRun();\n${checks}\n})();`);
vm.runInContext(script,context);
