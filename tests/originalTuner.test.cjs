const assert=require('node:assert/strict'),{test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../utils/originalTuner.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const mod={exports:{}};new Function('module','exports',output)(mod,mod.exports);
const {originalRequest}=mod.exports;
test('Yaw PD uses an explicit RPM maximum and all editable gains accept 9999',()=>{
 assert.deepEqual(originalRequest('yaw_pid',{max_rpm:9999,kp:9999,kd:9999}),{action:'yaw_pid',max_rpm:9999,kp:9999,kd:9999});
 for(const action of ['pos_pid_x','pos_pid_y'])assert.deepEqual(originalRequest(action,{kp:9999,ki:0,kd:9999}),{action,kp:9999,ki:0,kd:9999});
 assert.deepEqual(originalRequest('pos_speed',{speed:9999}),{action:'pos_speed',speed:9999});
});
test('P5 zero is rejected because firmware ignores zero; XY zero remains editable',()=>{
 for(const key of ['max_rpm','kp','kd'])assert.throws(()=>originalRequest('yaw_pid',{max_rpm:120,kp:80,kd:5,[key]:0}));
 assert.equal(originalRequest('pos_pid_x',{kp:0,ki:0,kd:0}).kp,0);
});
test('incomplete or over-range settings fail before making a request',()=>{
 for(const bad of [NaN,Infinity,-1,10000,'2',null,true])assert.throws(()=>originalRequest('pos_pid_y',{kp:bad,ki:0,kd:1}));
});
test('manual command carries XY only and stop ignores unfinished input',()=>{
 assert.deepEqual(originalRequest('twist',{vx:-1,vy:2}),{action:'twist',vx:-1,vy:2});
 assert.deepEqual(originalRequest('stop',{kp:NaN}),{action:'stop'});
});
test('goal request never silently adds PID, speed or a start command',()=>{
 assert.deepEqual(originalRequest('goal',{x:1,y:-2,yaw:0}),{action:'goal',x:1,y:-2,yaw:0});
});
test('wheel PID identifies each wheel and accepts zero and 9999',()=>{
 for(const wheel of ['FL','FR','RL','RR'])assert.deepEqual(originalRequest('wheel_pid',{wheel,kp:9999,ki:0,kd:.003}),{action:'wheel_pid',wheel,kp:9999,ki:0,kd:.003});
 for(const wheel of ['ALL','FL\nW15:300',1,null])assert.throws(()=>originalRequest('wheel_pid',{wheel,kp:1,ki:2,kd:3}));
 for(const kp of [NaN,Infinity,-1,10000,null,'2'])assert.throws(()=>originalRequest('wheel_pid',{wheel:'FL',kp,ki:0,kd:0}));
});
test('direct wheel test respects hardware RPM range and selection masks',()=>{
 for(const mask of [1,2,4,8,15])for(const rpm of [-300,0,300])assert.deepEqual(originalRequest('wheel_rpm',{mask,rpm}),{action:'wheel_rpm',mask,rpm});
 for(const mask of [0,3,16,true,'1'])assert.throws(()=>originalRequest('wheel_rpm',{mask,rpm:1}));
 for(const rpm of [-301,301,NaN,Infinity])assert.throws(()=>originalRequest('wheel_rpm',{mask:1,rpm}));
 assert.deepEqual(originalRequest('wheel_info'),{action:'wheel_info'});
});
