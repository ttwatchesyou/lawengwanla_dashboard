const assert=require('node:assert/strict'),{test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../utils/stm32Contract.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const mod={exports:{}};new Function('require','module','exports',code)(require,mod,mod.exports);
const {positionGoalRequest,sendPositionGoal}=mod.exports;
const contract={protocol:'stm32_pose_only_v26'};
test('a position action sends exactly one XYZ request, with no profile or heartbeat',async()=>{
 const requests=[];await sendPositionGoal(async(path,body)=>requests.push({path,body}),{x:.1,y:-.2,yaw:0,kp:8,speed:2},contract);
 assert.deepEqual(requests,[{path:'/api/tuner/command',body:{action:'goal',x:.1,y:-.2,yaw:0}}]);
 await new Promise(r=>setTimeout(r,350));assert.equal(requests.length,1);
});
test('invalid or unknown-contract goals fail before any request',async()=>{
 for(const goal of [{x:NaN,y:0,yaw:0},{x:1000,y:0,yaw:0},{x:0,y:0,yaw:Infinity}])assert.throws(()=>positionGoalRequest(goal,contract));
 const requests=[];await assert.rejects(sendPositionGoal(async(...x)=>requests.push(x),{x:0,y:0,yaw:0},null));assert.deepEqual(requests,[]);
});
test('yaw is normalized without changing world target XY',()=>{
 const p=positionGoalRequest({x:2,y:-3,yaw:3*Math.PI},contract);
 assert.equal(p.x,2);assert.equal(p.y,-3);assert.ok(Math.abs(p.yaw-Math.PI)<1e-8);
});

test('both speed caps are attached to the one goal action without PID preamble',async()=>{
 const requests=[];const speedContract={protocol:'stm32_pose_speed_v27',position_speed_payload:true};
 await sendPositionGoal(async(path,body)=>requests.push({path,body}),{x:.5,y:-.1,yaw:0,linear_mps:.8,angular_radps:2.5},speedContract);
 assert.deepEqual(requests,[{path:'/api/tuner/command',body:{action:'goal',x:.5,y:-.1,yaw:0,linear_mps:.8,angular_radps:2.5}}]);
});
test('invalid speeds and legacy contracts never silently discard speed settings',()=>{
 const speedContract={protocol:'stm32_pose_speed_v27',position_speed_payload:true};
 for(const speeds of [{linear_mps:.3},{angular_radps:1},{linear_mps:0,angular_radps:1},{linear_mps:Infinity,angular_radps:1},{linear_mps:.3,angular_radps:5.01},{linear_mps:NaN,angular_radps:1}])assert.throws(()=>positionGoalRequest({x:0,y:0,yaw:0,...speeds},speedContract));
 assert.throws(()=>positionGoalRequest({x:0,y:0,yaw:0,linear_mps:.3,angular_radps:1},contract));
});
test('Maze speed settings preserve both saved values and default angular speed for old drafts',()=>{
 const filename=path.resolve(__dirname,'../utils/waypointSettings.ts');
 const cache={};function load(file){if(cache[file])return cache[file];const m={exports:{}};const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;new Function('require','module','exports',output)(name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name),m,m.exports);return cache[file]=m.exports;}
 const {settingsForCell,validWaypointSettings,restoreWaypointSettings}=load(filename);
 const cell={row:7,col:0},settings={'7,0':{...settingsForCell({},cell),speed_mps:.65,angular_speed_radps:2.2}};
 assert.deepEqual(restoreWaypointSettings(settings)['7,0'],settings['7,0']);
 assert.equal(settingsForCell({'7,0':{speed_mps:.2}},cell).angular_speed_radps,1);
 assert.equal(validWaypointSettings({...settings['7,0'],angular_speed_radps:0}),false);
});

test('GOAL accepts attainable speeds above the former 2 m/s ceiling',()=>{
 const c={protocol:'stm32_pose_speed_v27',position_speed_payload:true};
 assert.equal(positionGoalRequest({x:1,y:0,yaw:0,linear_mps:4.7,angular_radps:1},c).linear_mps,4.7);
});
