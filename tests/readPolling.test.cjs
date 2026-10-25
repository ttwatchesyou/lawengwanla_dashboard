const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function clock(){
 let now=0,id=0,hidden=false;const tasks=new Map(),events=new Set();
 const env={hidden:()=>hidden,onVisibility:fn=>{events.add(fn);return()=>events.delete(fn);},setTimer:(fn,ms)=>{tasks.set(++id,{at:now+ms,fn});return id;},clearTimer:id=>tasks.delete(id)};
 return {env,tasks,get now(){return now;},get hidden(){return hidden;},visibility(value){hidden=value;for(const fn of events)fn();},async advance(ms){const until=now+ms;for(let i=0;i<10000;i++){await flush();const next=[...tasks].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;tasks.delete(next[0]);next[1].fn();}now=until;await flush();},get eventCount(){return events.size;}};
}
function load(file,params={},c=clock()){
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../utils',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const doc={get hidden(){return c.hidden;},addEventListener:(_,fn)=>{doc.remove=c.env.onVisibility(fn);},removeEventListener:()=>doc.remove?.()};
 const args={document:doc,performance:{now:()=>c.now},setTimeout:c.env.setTimer,clearTimeout:c.env.clearTimer,fetch:()=>{throw Error('unexpected fetch');},...params};const m={exports:{}};
 new Function('module','exports',...Object.keys(args),code)(m,m.exports,...Object.values(args));return m.exports;
}
test('readers pause and abort when hidden, never overlap, resume immediately, and clean up',async()=>{
 const c=clock(),{startVisiblePolling}=load('readPolling.ts');let calls=0,signal,resolve;
 const p=startVisiblePolling(s=>{calls++;signal=s;return new Promise(r=>resolve=r);},200,{environment:c.env});
 await c.advance(1000);assert.equal(calls,1);
 c.visibility(true);assert.equal(signal.aborted,true);c.visibility(false);await c.advance(0);assert.equal(calls,1);
 resolve();await c.advance(0);assert.equal(calls,2);
 p.stop();resolve();await c.advance(1000);assert.equal(calls,2);assert.equal(c.tasks.size,0);assert.equal(c.eventCount,0);
});
test('request timeout is distinguishable from hidden-tab cancellation',async()=>{
 const c=clock(),{startVisiblePolling,readWasCancelled}=load('readPolling.ts');let signal;
 const p=startVisiblePolling(s=>{signal=s;return new Promise(resolve=>s.addEventListener('abort',resolve));},200,{environment:c.env,timeoutMs:50});
 await c.advance(50);assert.equal(signal.reason.name,'TimeoutError');assert.equal(readWasCancelled(signal),false);p.stop();
});
test('a failed reader is retried rather than leaking a timer or dying',async()=>{
 const c=clock(),{startVisiblePolling}=load('readPolling.ts');let calls=0;
 const p=startVisiblePolling(()=>{calls++;throw Error('broken');},100,{environment:c.env});await c.advance(300);assert.equal(calls,4);p.stop();assert.equal(c.tasks.size,0);
});
test('two URL subscribers share reads, retain request timestamps, stop hidden, unsubscribe independently',async()=>{
 const c=clock();let calls=0,a=[],b=[];
 const {subscribeJson}=load('readPolling.ts',{fetch:async()=>{calls++;return {ok:true,json:async()=>({sequence:calls})};}},c);
 const stopA=subscribeJson('/state',(value,stamp)=>a.push({value,stamp}),()=>{},200);
 const stopB=subscribeJson('/state',value=>b.push(value),()=>{},400);
 await c.advance(0);assert.equal(calls,1);assert.equal(a.length,1);assert.equal(b.length,1);assert.equal(a[0].stamp.requestedAt,0);
 await c.advance(200);assert.equal(calls,2);
 c.visibility(true);await c.advance(5000);assert.equal(calls,2);
 c.visibility(false);await c.advance(0);assert.equal(calls,3);assert.equal(a[2].stamp.requestedAt,5200);
 stopA();await c.advance(400);assert.equal(calls,4);assert.equal(a.length,3);assert.equal(b.length,4);
 stopB();await c.advance(10000);assert.equal(calls,4);assert.equal(c.tasks.size,0);
});
test('shared feed ignores an old response after hide/unmount',async()=>{
 const c=clock();let release,received=0;
 const {subscribeJson}=load('readPolling.ts',{fetch:()=>new Promise(resolve=>release=()=>resolve({ok:true,json:async()=>({})}))},c);
 const stop=subscribeJson('/state',()=>received++,()=>{},200);
 c.visibility(true);release();await c.advance(0);assert.equal(received,0);stop();assert.equal(c.tasks.size,0);
});
test('demand renderer draws once while idle, coalesces changes, caps FPS, pauses offscreen/hidden',async()=>{
 const c=clock();let draws=0;
 const env={...c.env,now:()=>c.now,frame:fn=>c.env.setTimer(fn,0),cancelFrame:c.env.clearTimer};
 const {createDemandRenderer}=load('demandRenderer.ts');const r=createDemandRenderer(()=>draws++,20,env);
 r.invalidate();await c.advance(0);assert.equal(draws,1);await c.advance(5000);assert.equal(draws,1);
 for(let i=0;i<20;i++)r.invalidate();await c.advance(0);assert.equal(draws,2);
 r.invalidate();await c.advance(49);assert.equal(draws,2);await c.advance(1);assert.equal(draws,3);
 r.setVisible(false);r.invalidate();await c.advance(1000);assert.equal(draws,3);
 r.setVisible(true);await c.advance(0);assert.equal(draws,4);
 c.visibility(true);r.invalidate();await c.advance(1000);assert.equal(draws,4);
 c.visibility(false);await c.advance(0);assert.equal(draws,5);r.stop();assert.equal(c.tasks.size,0);
});
test('a hidden abort that settles after resume does not publish a connection error',async()=>{
 const c=clock();let fail,errors=0;
 const {subscribeJson}=load('readPolling.ts',{fetch:()=>new Promise((_,reject)=>fail=reject)},c);
 const stop=subscribeJson('/late',()=>{},()=>errors++,200);
 c.visibility(true);c.visibility(false);fail(new Error('Aborted'));await c.advance(0);assert.equal(errors,0);stop();
});
