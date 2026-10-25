const assert=require('node:assert/strict'),{test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../utils/wheelPid.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const mod={exports:{}};new Function('module','exports',code)(mod,mod.exports);
const {sendWheelPid}=mod.exports;
test('PID after STOP always reselects the requested wheels and never starts motion',async()=>{
 const writes=[];
 const reply=await sendWheelPid(async(_,body)=>{writes.push(body);return {acknowledged:true,ack:'T:ACK:PID'}},4,{kp:1,ki:1.2,kd:0});
 assert.deepEqual(writes,[{action:'select',mask:4},{action:'pid',kp:1,ki:1.2,kd:0}]);
 assert.equal(reply.ack,'T:ACK:PID');
});
test('invalid PID rejects before changing the device selection',async()=>{
 for(const bad of [NaN,Infinity,-1,101,'2',null,true]){
  const writes=[];
  await assert.rejects(sendWheelPid(async(_,body)=>writes.push(body),15,{kp:bad,ki:0,kd:0}));
  assert.deepEqual(writes,[]);
 }
});
test('failed selection or missing PID ACK never reports success',async()=>{
 const writes=[];
 await assert.rejects(sendWheelPid(async(_,body)=>{writes.push(body.action);throw Error('offline')},1,{kp:1,ki:0,kd:0}),/offline/);
 assert.deepEqual(writes,['select']);
 await assert.rejects(sendWheelPid(async()=>({acknowledged:false}),1,{kp:1,ki:0,kd:0}),/ACK/);
 await assert.rejects(sendWheelPid(async()=>({acknowledged:true,ack:'T:ACK:SELECT'}),1,{kp:1,ki:0,kd:0}),/ACK/);
});
