const fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const el=()=>({style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},focus(){},remove(){},textContent:'',children:[]});
const nodes={},context=vm.createContext({console,topologyHash:value=>crypto.createHash('sha256').update(value).digest('hex'),document:{body:el(),querySelectorAll(){return []},getElementById:id=>nodes[id]||(nodes[id]=el()),addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout(){return 1},clearTimeout(){},requestAnimationFrame(){return 1},cancelAnimationFrame(){},performance:{now:()=>0}});
const checks=String.raw`
function check(v,m){if(!v)throw Error(m)}
// Fixed against the inspected pre-update renderer/generator, excluding intentional content changes.
const baseline=[];for(let seed=1;seed<=500;seed++){let n=seed;Math.random=()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);floorNo=1+seed%24;generateDungeon();baseline.push({start:startId,exit:exitId,layers:layers,rooms:rooms.map(r=>({active:r.active,links:r.links,stairTo:r.stairTo,shape:r.shape}))})}
check(topologyHash(JSON.stringify(baseline))==='e58cf30381177a8d8b21fd29d21a0005ad1c71efbc149d0d87d7b15e2b39a898','normal floor topology/shapes unchanged');
const initialArchive=JSON.stringify(codexState);let early={spikes:0,trap:0},variants={basic:0,wretch:0},multi=0,base=0,secondary=0,nonterminal=0;
for(let seed=1;seed<=2000;seed++){
 let n=seed;Math.random=()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);floorNo=1+seed%24;generateDungeon();
 rooms.filter(r=>r.active&&!inGateBranch(r.id)&&r.event==='monster').forEach(r=>{check(['basic','wretch'].includes(r.monsterKind),'early creatures');variants[r.monsterKind]++});
 const hazards=rooms.filter(r=>r.active&&!inGateBranch(r.id)&&(HAZARD_POOL.includes(r.event)||r.event==='trap'));
 check(hazards.length===2||floorNo===1&&hazards.length===3,'danger budget');hazards.forEach(r=>{check(['spikes','trap'].includes(r.event),'early hazard eligibility');early[r.event]++});
 if(room(exitId).links.length>1)nonterminal++;
 floorNo=25;generateDungeon();const boss=room(exitId),d=distancesFrom(startId);
 check(rooms.filter(r=>r.boss).length===1&&boss.boss.id==='general'&&boss.boss.hp===3&&boss.boss.state==='unresolved','exactly one fresh boss');
 check(startId!==exitId&&boss.links.length===1&&boss.event==='empty'&&d[exitId]>1,'terminal distant EXIT');
 const seen=new Set([startId]),q=[startId];for(let i=0;i<q.length;i++)floorNeighbors(q[i]).forEach(id=>{if(id!==exitId&&!seen.has(id)){seen.add(id);q.push(id)}});
 check(rooms.every(r=>!r.active||r.id===exitId||seen.has(r.id)),'boss never blocks other rooms');check(normalReachableWithoutGate(),'optional gate');
 check(rooms.filter(r=>r.chest).length<=1,'Chest cap');for(const layer of layers)check(rooms.filter(r=>r.active&&r.layerId===layer.id&&r.event==='heal').length<=1,'Shrine cap');
 rooms.filter(r=>r.stairTo!==undefined).forEach(r=>{const o=room(r.stairTo);check(o.stairTo===r.id&&o.x===r.x&&o.y===r.y&&r.id!==exitId,'stairs')});
 check(rooms.every(r=>!r.active||ROOM_SHAPES.kinds.includes(r.shape.kind)),'shapes');if(layers.length===2)multi++;if(layerOf(exitId)===0)base++;else secondary++;
}
check(early.spikes/(early.spikes+early.trap)>.85&&early.trap>0,'90/10 early tuning');check(variants.basic>0&&variants.wretch>0&&nonterminal>0&&multi>0&&secondary>0&&base>0,'coverage');
check(JSON.stringify(codexState)===initialArchive,'no generation discovery');
for(const depth of [1,2,3,5,10,20,25,50,100,200]){check(monsterRate(depth)===.14+.16*Math.min(1,Math.max(0,(depth-2)/18)),'frequency unchanged');check(creatureFamilyWeights(depth).basic>=.6,'Heart family dominant')}
check(MONSTERS.basic.living&&MONSTERS.wretch.living&&MONSTERS.wretch.family==='basic','shared life/behavior');
check([25,50,75,100,125,150,175,200,225].map(bossMilestone).join(',')==='1,2,3,4,1,2,3,4,1','cycle');
for(const depth of [50,75,100,150,175,200]){floorNo=depth;generateDungeon();check(!rooms.some(r=>r.boss),'safe unimplemented boss fallback')}
check(Object.keys(CARD_REGISTRY).length===32&&CARD_REGISTRY['creature:wretch']&&CARD_REGISTRY['creature:general'],'Archive identities');
console.log('PASS 2000 early floors + 2000 Floor-25 seeds: eligibility, fixed danger budget, 90/10 Hazards, terminal Boss EXIT, layers/stairs/Gates/Chests/Shrines/shapes, Archive privacy, frequency and milestone fallback',{early,variants,multi,base,secondary,nonterminal});
`;
let script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];script=script.replace('bootRun();\n})();',`update=updateContext=updateRelicHUD=clearFeedback=markArrival=function(){};\n${checks}\n})();`);vm.runInContext(script,context,{timeout:30000});
