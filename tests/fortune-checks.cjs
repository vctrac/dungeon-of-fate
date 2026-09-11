module.exports=()=>{
  const t=__dofTest,check=(x,m)=>{if(!x)throw Error(m)},state=t.state;
  for(const [kind,roll,expected] of [['basic',1,5],['basic',2,5.5],['spirit',1,1],['spirit',2,4],['spirit',3,5],['spirit',4,6],['spirit',5,6],['spirit',6,6.35]]){
   t.newRun();t.setCombo(6);t.setMonster(kind);t.resolveDice('monster',roll);check(state().combo===expected,kind+roll);t.clearPending();
  }
  for(let roll=1;roll<=4;roll++){t.setCombo(6);t.setVitals(3,false);t.resolveDice('trap',roll);check(state().combo===(roll<=2?5:5.5),'trap');t.clearPending()}
  t.setCombo(6);t.scaleFate(.5);check(state().combo===3,'scale');t.damageFate(99);check(state().combo===1,'minimum');t.gainFate(.7);check(state().combo===1.7,'gain');
  for(const wallet of [0,1,3,10,100,20000])for(let roll=1;roll<=6;roll++){
   t.newRun();t.setGold(wallet);t.setMonster('thief');t.resolveDice('monster',roll);let s=state();check(s.gold>=0,'wallet minimum');if(roll<=3)check(s.gold===wallet-Math.floor(wallet*[0,.25,.15,.07][roll]),'theft');if(roll===4)check(s.gold===wallet,'escape');t.clearPending();
  }
  t.newRun();t.setCombo(6);t.acquireTrinket('doll');t.closeItemCard();t.setVitals(1,false);t.resolveDice('monster',1);check(state().hp===1&&state().combo===1&&!state().relics.trinkets.includes('doll'),'doll');t.clearPending();
  t.newRun();t.setVitals(2,false);t.acquireTrinket('blood');t.closeItemCard();t.resolveDice('monster',5);check(state().hp===3&&state().relics.floorUsed.blood,'blood');t.clearPending();
  t.newRun();t.setConsumable('charm');check(t.useConsumable(true)&&state().shield&&!state().relics.consumable,'charm');t.resolveDice('monster',1);check(state().hp===3&&!state().shield,'shield');t.clearPending();
  t.newRun();t.setConsumable('bargain');check(t.useConsumable(true)&&state().hp===1&&state().relics.bargainCharges===3,'bargain activation');t.resolveDice('monster',1);check(state().hp===1,'bargain protection');t.clearPending();
  for(const type of ['monster','trap','heal']){
   t.newRun();t.resolveDice(type,6);let plain=state().gold;t.clearPending();t.newRun();t.acquireTrinket('horseshoe');t.closeItemCard();t.resolveDice(type,6);check(state().gold-plain===30,'horseshoe');t.clearPending();
  }
  for(const fate of [1,2,5.4,9])for(const event of ['treasure','rich']){
   t.newRun();t.setCombo(fate);t.resolveSimple(event);check(state().gold===Math.floor((event==='rich'?90:30)*t.rewardMultiplier(fate)),'reward math');check(state().combo>fate,'gain never lowers high Fate');
  }
  // Same seed gives identical topology/danger; fortune cannot consume danger or exits.
  const original=Math.random,signatures=new Set();let low=0,high=0,rich=0;
  function seed(n){Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
  for(let i=1;i<=300;i++){
   seed(i);t.setCombo(1);t.generateDungeon();const a=state();check(a.fortuneBudget===0,'baseline');
   seed(i);t.setCombo(7);t.generateDungeon();const b=state();check(b.fortuneUpgrades.filter(u=>u.to==='heal').length<=1,'one bonus shrine');check(b.floorFortune===7&&b.fortuneBudget<=5&&b.fortuneUpgrades.length<=3,'cap/snapshot');
   const normal=s=>s.rooms.filter(r=>!s.fateGate||r.id!==s.fateGate.roomId).filter(r=>r.active).map(r=>[r.id,r.links.filter(id=>!s.fateGate||id!==s.fateGate.roomId)]);check(JSON.stringify(normal(a))===JSON.stringify(normal(b)),'topology');
   check(a.exitId===b.exitId&&a.startId===b.startId,'endpoints');
   for(const r of a.rooms)if(['monster','trap'].includes(r.event))check(b.rooms[r.id].event===r.event,'danger');
   for(const u of b.fortuneUpgrades){check(b.rooms[u.id].active&&u.id!==b.exitId&&u.id!==b.startId,'placement');if(u.to==='rich')rich++}
   low+=a.rooms.filter(r=>r.active&&['heal','treasure','rich'].includes(r.event)).length;high+=b.rooms.filter(r=>r.active&&['heal','treasure','rich'].includes(r.event)).length;
   signatures.add(b.fortuneUpgrades.map(u=>u.to).join(','));const snapshot=JSON.stringify(b.rooms);t.setCombo(100);check(JSON.stringify(state().rooms)===snapshot,'immutable floor');
  }
  Math.random=original;check(high>low&&rich>0&&signatures.size>3,'opportunity/randomness');
  const depthStats=[];
  for(const depth of [1,2,5,10,20,40]){
   let monsters=0,eligible=0,maxShrines=0;
   for(let i=0;i<80;i++){
    t.setCombo(12);t.setFloor(depth);const s=state(),active=s.rooms.filter(r=>r.active&&r.id!==s.startId&&r.id!==s.exitId&&(!s.fateGate||r.id!==s.fateGate.roomId));
    const count=active.filter(r=>r.event==='monster').length;
    monsters+=count;eligible+=active.length;maxShrines=Math.max(maxShrines,active.filter(r=>r.event==='heal').length);
    check(count<=Math.round(active.length*.30),'monster ceiling');check(s.floorEconomy.bonusShrines<=1&&s.floorEconomy.naturalShrines===1,'shrine telemetry');
    check(Object.values(s.floorEconomy.monsters).reduce((a,b)=>a+b,0)===count,'archetype telemetry');
    const reached=new Set([s.startId]),q=[s.startId];for(let j=0;j<q.length;j++)for(const n of s.rooms[q[j]].links)if(!reached.has(n)){reached.add(n);q.push(n)}check(reached.size===active.length+2+(s.fateGate?1:0),'reachable rooms');
   }
   depthStats.push({depth,rate:monsters/eligible,maxShrines});check(maxShrines<=2,'total shrines');
  }
  check(depthStats[0].rate<depthStats[2].rate&&depthStats[2].rate<depthStats[3].rate&&depthStats[3].rate<depthStats[4].rate,'rising danger');check(Math.abs(depthStats[5].rate-depthStats[4].rate)<.02,'plateau');
  t.newRun();t.setCombo(1);t.gainFate(1);check(state().combo===2,'low fate');
  t.setCombo(6);t.gainFate(1);check(state().combo===6.5,'mid fate');
  t.setCombo(11);t.gainFate(1);check(state().combo===11.2,'high fate');
  t.setCombo(101);for(let i=0;i<100;i++)t.gainFate(.15);check(state().combo>101,'fractional gain avoids hard cap');
  t.setCombo(1);for(let i=0;i<100;i++)t.gainFate(.5);const sustainedFate=state().combo;check(sustainedFate>10&&sustainedFate<15,'sustained gain curve');
  // Acquisition must not reveal hidden monsters; later frontier reveal marks all types alike.
  t.newRun();let s=state(),ids=s.rooms.filter(r=>r.active&&!r.known&&r.id!==s.exitId).slice(0,3).map(r=>r.id);
  ids.forEach((id,i)=>t.setRoomFixture(id,{event:'monster',monsterKind:['basic','thief','spirit'][i]}));t.acquireTrinket('eye');t.closeItemCard();
  check(ids.every(id=>!state().rooms[id].known&&!state().rooms[id].eyeMarked),'eye hidden');
  ids.forEach(id=>{t.setRoomFixture(id,{searched:false,visited:false,known:false,eyeMarked:false});const neighbor=state().rooms[id].links[0];t.markVisited([neighbor]);check(state().rooms[id].eyeMarked,'eye frontier')});
  // Five-floor reward sweep: every room, every encounter won, normal Scavenge finds, no deaths.
  let wallets=[];
  for(let run=0;run<30;run++){
   t.newRun();
   for(let floor=1;floor<=5;floor++){
    t.setFloor(floor);let s=state();
    for(const r of s.rooms.filter(r=>r.active&&r.id!==s.startId&&r.id!==s.exitId&&(!s.fateGate||r.id!==s.fateGate.roomId))){
     t.setCurrent(r.id);t.setVitals(3,true);
     if(['monster','trap','heal'].includes(r.event)){t.setMonster(r.monsterKind||'basic');t.resolveDice(r.event,5);t.clearPending()}
     else t.resolveSimple(r.event);
     t.setRoomEvent(r.id,r.event);t.scavenge(r.id,.55);t.clearPending();
    }
   }
   const s=state();check(s.gold<10000,'early inflation '+JSON.stringify({gold:s.gold,fate:s.combo,floor:s.floorNo,coin:s.relics.coinRoom,charges:s.relics.coinCharges}));check(s.floorEconomy.entering+s.floorEconomy.gained-s.floorEconomy.lost===s.gold,'telemetry');wallets.push(s.gold);
  }
  return{depthStats,sustainedFate,pairedFloors:300,low,high,rich,variants:signatures.size,winningFiveFloorGold:{min:Math.min(...wallets),max:Math.max(...wallets),mean:Math.round(wallets.reduce((a,b)=>a+b)/wallets.length)}};
 };
