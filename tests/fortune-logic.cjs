// DOM-free balance checks. Intentionally does not validate rendering, timers or input.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const el=()=>({style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},focus(){},textContent:'',children:[]});
const nodes={},context=vm.createContext({console,document:{querySelectorAll(){return []},getElementById:id=>nodes[id]||(nodes[id]=el()),addEventListener(){}},window:{},localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout(){return 1},clearTimeout(){},requestAnimationFrame(){return 1},cancelAnimationFrame(){},performance:{now:()=>0}});
let script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
for(const block of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
script=script.replace('beginRun();\n})();','renderItemCard=dollRescue=update=updateRelicHUD=clearFeedback=showLocalFeedback=updateContext=effectNotice=theftFeedback=markArrival=resourceFlight=function(){};\nbeginRun();\n})();');
vm.runInContext(script,context);context.__dofTest=context.window.__dofTest;
const checks=require('./fortune-checks.cjs');console.log('PASS logic only',vm.runInContext('('+checks.toString()+')()',context));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));assert.equal(manifest.display,'fullscreen');
for(const icon of manifest.icons){const png=fs.readFileSync(path.join(root,icon.src));assert.equal(png.readUInt32BE(16)+'x'+png.readUInt32BE(20),icon.sizes)}
console.log('PASS script syntax, manifest, original icon dimensions');
