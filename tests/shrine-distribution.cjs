// Focused graph/RNG checks without browser timing or rendering.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const el=()=>({style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},focus(){},remove(){},textContent:'',children:[]});
const nodes={},context=vm.createContext({console,document:{querySelectorAll(){return []},getElementById:id=>nodes[id]||(nodes[id]=el()),addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout(){return 1},clearTimeout(){},requestAnimationFrame(){return 1},cancelAnimationFrame(){},performance:{now:()=>0}});
const checks=String.raw`
function check(v,m){if(!v)throw Error(m)}
function fixture(){rooms=[];layers=[];appendLayer("base",0);appendLayer("upper",1);startId=0;exitId=1;floorNo=6;floorFortune=1;rooms.forEach(r=>{r.active=true;r.event="empty"});room(10).event="heal"}
fixture();check(!shrineAllowed(room(11))&&shrineAllowed(room(91)),"layer-local cap");
check(preferShrineCoordinates([room(91),room(92)])[0].id===92,"prefer different coordinate");check(preferShrineCoordinates([room(91)])[0].id===91,"coordinate fallback");
Math.random=()=>0;floorFortune=10;applyFortune();check(rooms.filter(r=>r.event==="heal").length===2,"Fortune can use empty layer");applyFortune();check(rooms.filter(r=>r.event==="heal").length===2,"Fortune cannot bypass either cap");
check(gateReward(.95,shrineAllowed(room(12)))==="treasure","Gate uses existing reward fallback");
fixture();rooms.forEach(r=>r.event="empty");applyFortune();check(!rooms.some(r=>r.event==="heal"),"cap does not add a Shrine to a zero-budget layer");
// A short event candidate list has no Shrine quota/fill pass.
rooms.forEach(r=>r.active=r.id<5);placeEvents();check(!rooms.some(r=>r.event==="heal"),"no forced Shrine when list cannot place it");
Math.random=()=>.4;floorNo=1;newFloor(false,"");let saved=serializeRun();const candidates=saved.floor.rooms.filter(r=>r.active&&r.id!==saved.floor.startId&&r.id!==saved.floor.exitId);candidates[0].event=candidates[1].event="heal";saved.gameVersion="2.20.2";check(validateSave(saved),"old multiple-Shrine floor remains valid");
console.log("PASS Shrine cap, Fortune, Gate fallback, coordinate preference/fallback, no quota, legacy save validation");
`;
let script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
script=script.replace('bootRun();\n})();',`saveRun=flushRun=function(){};renderItemCard=revealAcquiredItem=dollRescue=update=updateRelicHUD=clearFeedback=showLocalFeedback=updateContext=effectNotice=theftFeedback=markArrival=resourceFlight=function(){};\nbeginRun();\n${checks}\n})();`);
vm.runInContext(script,context);
