const assert=require('node:assert/strict'),{test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../utils/positionPid.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const mod={exports:{}};new Function('module','exports',code)(mod,mod.exports);
const {sendPositionPid,validPositionPidProfile}=mod.exports;
const profile={id:'',linear_mps:.3,angular_radps:1,x:{kp:2,ki:.1,kd:.2},y:{kp:3,ki:0,kd:.4},yaw:{kp:10,kd:.4}};
test('apply sends each axis with ACK and never sends START, GOAL or RPM',async()=>{
 const requests=[];
 await sendPositionPid(async(path,body)=>{requests.push(body);return {acknowledged:true,ack:'T:ACK:PID'}},profile,['pos_pid_x','pos_pid_y','yaw_pid']);
 assert.deepEqual(requests,[{action:'pos_pid_x',...profile.x},{action:'pos_pid_y',...profile.y},{action:'yaw_pid',kp:10,kd:.4,maximum:1}]);
});
test('a failed axis stops the sequence and never applies later axes',async()=>{
 const requests=[];
 await assert.rejects(sendPositionPid(async(path,body)=>{requests.push(body.action);return {acknowledged:false}},profile,['pos_pid_x','pos_pid_y','yaw_pid']),/ACK/);
 assert.deepEqual(requests,['pos_pid_x']);
});
test('incomplete gains reject the whole batch before the first request',async()=>{
 const requests=[];const invalid={...profile,y:{...profile.y,kp:NaN}};
 await assert.rejects(sendPositionPid(async(...args)=>requests.push(args),invalid,['pos_pid_x','pos_pid_y']));assert.deepEqual(requests,[]);
 for(const bad of [-1,10000,NaN,Infinity,'2',null,true])assert.equal(validPositionPidProfile({...profile,x:{...profile.x,ki:bad}}),false);
 assert.equal(validPositionPidProfile({...profile,x:{kp:9999,ki:9999,kd:9999},yaw:{kp:9999,kd:9999}}),true);
 assert.equal(validPositionPidProfile(profile),true);
});

test('PID library accepts higher speed requests and rejects nonfinite speed',()=>{
 assert.equal(validPositionPidProfile({...profile,linear_mps:4.7}),true);
 assert.equal(validPositionPidProfile({...profile,linear_mps:Infinity}),false);
});
