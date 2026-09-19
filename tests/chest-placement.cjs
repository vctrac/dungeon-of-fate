// Focused graph/RNG checks without browser timing or rendering.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const el=()=>({style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},focus(){},remove(){},textContent:'',children:[]});
const nodes={},context=vm.createContext({console,document:{querySelectorAll(){return []},getElementById:id=>nodes[id]||(nodes[id]=el()),addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout(){return 1},clearTimeout(){},requestAnimationFrame(){return 1},cancelAnimationFrame(){},performance:{now:()=>0}});
const checks=String.raw`
function check(v,m){if(!v)throw Error(m)}
function fixture(){startId=0;exitId=3;fateGate=null;rooms=Array.from({length:N},(_,id)=>({id,x:id%W,y:Math.floor(id/W),active:false,event:'empty',links:[]}));for(const [a,b] of [[0,1],[0,9],[1,2],[2,3],[1,10],[10,19],[2,11],[11,20],[20,29],[20,21],[21,30]]){rooms[a].active=rooms[b].active=true;rooms[a].links.push(b);rooms[b].links.push(a)}}
fixture();check(chestCandidates().map(r=>r.id).sort().join(',')==='19,29,30','candidate exclusions');check(preferredChestCandidates(chestCandidates()).map(r=>r.id).sort().join(',')==='29,30','farther band');
room(30).event='altar';check(!chestCandidates().some(r=>r.id===30),'special room exclusion');fateGate={branchIds:[29],parentId:20};check(!chestCandidates().some(r=>r.id===29),'Gate exclusion');
const random=Math.random;let calls=0;Math.random=()=>{calls++;return .2};fixture();generateChest();check(calls===1&&!rooms.some(r=>r.chest),'one failed spawn roll at exact threshold');
fixture();room(19).event=room(29).event=room(30).event='altar';calls=0;generateChest();check(calls===0&&!rooms.some(r=>r.chest),'START neighbor alone is not eligibility; no RNG or forced placement');
let selected=new Set();for(const choice of [0,.999]){fixture();let sequence=[.199999,choice,.99],i=0;Math.random=()=>{calls++;return sequence[i++]??.5};calls=0;const topology=JSON.stringify(rooms.map(r=>[r.active,r.links]));generateChest();check(calls===3,'one spawn, one selection, one Mimic content roll');const found=rooms.filter(r=>r.chest);check(found.length===1,'max one');selected.add(found[0].id);check(JSON.stringify(rooms.map(r=>[r.active,r.links]))===topology,'no topology mutation');const used=calls;generateChest();check(calls===used,'existing Chest guard');}
check(selected.has(29)&&selected.has(30),'randomness among comparable terminals');
// Compare geometry immediately before/after actual generation placement, every generated floor.
Math.random=random;const real=generateChest;let placed=0;generateChest=function(){const before=rooms.map(r=>({id:r.id,active:r.active,links:r.links.slice(),event:r.event})),ends=[startId,exitId],gate=JSON.stringify(fateGate);real();check(ends[0]===startId&&ends[1]===exitId&&gate===JSON.stringify(fateGate),'endpoints/Gate unchanged');rooms.forEach((r,i)=>{check(r.active===before[i].active&&JSON.stringify(r.links)===JSON.stringify(before[i].links),'graph changed');if(r.event!==before[i].event){check(before[i].event==='empty'&&r.event==='chest','overwritten content');placed++;const d=distancesFrom(startId),other=chestCandidates();check(other.every(c=>d[r.id]>=d[c.id]-1),'preferred distance band');check(d[r.id]>=2,'START adjacent');}})};
for(let seed=1;seed<=300;seed++){let n=seed;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};floorNo=1+seed%20;generateDungeon()}
Math.random=random;generateChest=real;console.log('PASS single 20% floor roll, filters, ranked randomized terminals, empty eligibility, max one; unchanged graph/content on 300 floors; placed',placed);
`;
let script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
script=script.replace('bootRun();\n})();',`saveRun=flushRun=function(){};renderItemCard=revealAcquiredItem=dollRescue=update=updateRelicHUD=clearFeedback=showLocalFeedback=updateContext=effectNotice=theftFeedback=markArrival=resourceFlight=function(){};\nbeginRun();\n${checks}\n})();`);
vm.runInContext(script,context);
