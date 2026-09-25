// Focused graph/RNG checks without browser timing or rendering.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const el=()=>({style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},focus(){},remove(){},textContent:'',children:[]});
const nodes={},context=vm.createContext({console,document:{querySelectorAll(){return []},getElementById:id=>nodes[id]||(nodes[id]=el()),addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout(){return 1},clearTimeout(){},requestAnimationFrame(){return 1},cancelAnimationFrame(){},performance:{now:()=>0}});
const checks=String.raw`
function check(v,m){if(!v)throw Error(m)}
const discovered=JSON.stringify(codexState),counts={},sizes=[0,0,0];let secondary=0,gateTraps=0;
for(let seed=1;seed<=4000;seed++){
 let n=seed;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};floorNo=1+seed%25;combo=seed%2?1:10;newFloor(false,"");
 const active=rooms.filter(r=>r.active),ordinary=active.filter(r=>!inGateBranch(r.id));
 check(!ordinary.some(r=>r.event==='trap'||r.event==='wasps'),'no ordinary Trap/Wasps');
 const hazards=ordinary.filter(r=>HAZARD_POOL.includes(r.event));check(hazards.length===(floorNo===1&&hazards.length===3?3:2),'same danger budget');check(new Set(hazards.map(r=>r.event)).size===hazards.length,'variety');
 const discoveries=active.filter(r=>CONTENT[r.event]?.weight);sizes[discoveries.length]++;check(discoveries.length<=2&&new Set(discoveries.map(r=>r.event)).size===discoveries.length,'floor Discovery cap');
 discoveries.forEach(r=>{check(r.id!==startId&&r.id!==exitId&&r.stairTo===undefined&&!r.chest&&!inGateBranch(r.id),'ordinary candidates');check(!r.contentState.seen&&!r.contentState.resolved,'unencountered');counts[r.event]=(counts[r.event]||0)+1;if(r.layerId===1)secondary++});
 gateTraps+=active.filter(r=>inGateBranch(r.id)&&r.event==='trap').length;
 check(normalReachableWithoutGate()&&validateSave(serializeRun()),'valid connected save');
 layers.forEach(l=>check(active.filter(r=>r.layerId===l.id&&r.event==='heal').length<=1,'Shrine cap'));check(active.filter(r=>r.chest).length<=1,'Chest cap');
}
check(JSON.stringify(codexState)===discovered,'generation never discovers');check(sizes.every(n=>n>0)&&secondary>0&&gateTraps>0,'0/1/2, secondary, Gate trap coverage');
console.log('PASS 4000 floors Hazard replacement/variety, Discovery caps/privacy, reserved rooms, Shrine/Chest/layers/Gate traps',{sizes,perFloor:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v/4000])),secondary,gateTraps});
for(const type of HAZARD_POOL)for(let roll=1;roll<=6;roll++){
 clearConditions();relicState=freshRelicState();hp=3;shield=false;combo=5;fateGainRemainder=0;pendingAction=type;const out=contentOutcome(type,roll),p=previewOutcome(type,roll,'basic');
 check(out.fate===(roll<=2?-1:roll<=4?-.5:.2),'shared curve');check(out.hp===((type==='spikes'||type==='stones')&&roll<=2?-1:0),'HP table');
 check(JSON.stringify(conditions)==='{}'&&hp===3&&combo===5,'preview pure');
 resolveDice(type,roll);check(hp===p.after.hp&&combo===p.after.combo&&JSON.stringify(conditions)===JSON.stringify(p.after.conditions),'preview/commit '+type+roll);pendingAction=null;pendingEncounter=null;
}
for(const health of [1,2])for(const protection of ['none','shield','bargain','doll']){
 clearConditions();relicState=freshRelicState();hp=health;shield=protection==='shield';if(protection==='bargain')relicState.bargainCharges=3;if(protection==='doll')relicState.trinkets=['doll'];combo=5;applyCondition('sickness');const p=previewOutcome('trap',1,'basic');resolveDice('trap',1);check(!conditions.sickness,'amplification consumed');check(hp===p.after.hp&&shield===p.after.shield,'protections match preview');deathPending=false;gameOver=false;pendingAction=null;pendingEncounter=null;
}
clearConditions();applyCondition('slowed');applyCondition('sickness');applyCondition('amnesia');const original=JSON.stringify(rooms);for(let i=0;i<4;i++)moveConditions(currentId);check(conditions.slowed===1&&conditions.sickness===1&&conditions.amnesia===1,'four movements');applyCondition('slowed');check(conditions.slowed===5,'refresh');moveConditions(currentId);check(!conditions.sickness&&!conditions.amnesia&&conditions.slowed===4,'expiry independently');check(JSON.stringify(rooms)===original,'memory never mutates world');
console.log('PASS 24 Hazard tables, pure previews, Sickness/protection ordering, refresh/coexistence/expiry and non-destructive Amnesia');
`;
let script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
script=script.replace('bootRun();\n})();',`saveRun=flushRun=function(){};renderItemCard=revealAcquiredItem=dollRescue=update=updateRelicHUD=clearFeedback=showLocalFeedback=updateContext=effectNotice=theftFeedback=markArrival=resourceFlight=function(){};\nbeginRun();\n${checks}\n})();`);
vm.runInContext(script,context);
