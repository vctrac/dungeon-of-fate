// Deterministic movement boundary tests use the real renderer/arrival callback.
exports.clock=function(){
 const raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame,set=window.setTimeout,clear=window.clearTimeout;
 let key=-1;window.walkTimers=new Map();window.hops=walkTimers;
 window.requestAnimationFrame=function(fn){if(fn.name!=='frame')return raf(fn);const id=key--;walkTimers.set(id,{fn:()=>{const t=__dofTest.travelState();fn(t?t.started+t.duration+1:performance.now())},raw:fn,ms:__dofTest.travelState().duration});return id};
 window.cancelAnimationFrame=function(id){if(walkTimers.has(id))walkTimers.delete(id);else caf(id)};
 window.setTimeout=function(fn,ms,...args){if(fn.name!=='hop')return set(fn,ms,...args);const id=key--;walkTimers.set(id,{fn,ms});return id};
 window.clearTimeout=function(id){if(walkTimers.has(id))walkTimers.delete(id);else clear(id)};
 window.walkTick=window.hop=function(){const entry=walkTimers.entries().next().value;if(!entry)return null;walkTimers.delete(entry[0]);window.lastHop=entry[1].fn;entry[1].fn();return entry[1].ms};
 window.travelProgress=function(p){const entry=[...walkTimers.entries()].find(([,v])=>v.raw);if(!entry)return;walkTimers.delete(entry[0]);const t=__dofTest.travelState();entry[1].raw(t.started+t.duration*p)};
};
exports.install=function(){window.testMove=async function(t,id){t.enter(id);if(window.walkTick&&t.travelState())walkTick();while(t.travelState())await new Promise(r=>setTimeout(r,10))}};
