const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const file=path.resolve(__dirname,'../utils/liveOdometry.ts');
const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const mod={exports:{}};new Function('require','module','exports',code)(require,mod,mod.exports);
const {measuredPose,validAnchor,livePoseFresh,actualMotion,startReference}=mod.exports;
const anchor={id:'map1',pose_epoch:'boot1',odom_origin:[2,3,0],map_origin:[.477,7.155],rotation:-Math.PI/2,cell_m:.954,pose_sequence:1};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('known A6 start uses measured encoder deltas to reach A8 without a board anchor',()=>{
 const settings={cell_m:.954,start_mode:'outside_a6',outside_clearance_m:.45};
 const reference=startReference({pose:[2,3,.4],pose_epoch:'boot1',pose_sequence:1},settings);
 const initial=measuredPose([2,3,.4],reference);
 close(initial.x,-.45);close(initial.y,7.5*.954-2.0);close(initial.heading,Math.PI/2);
 const distance=2.0;
 const moved=measuredPose([2+Math.cos(.4)*distance,3+Math.sin(.4)*distance,.4],reference);
 close(moved.x,-.45);close(moved.y,7.5*.954);close(moved.heading,Math.PI/2);
 assert.deepEqual(reference.odom_origin,[2,3,.4]);
});
test('measured encoder XY maps into the field using a fixed anchor, preserving real yaw',()=>{
 assert.ok(validAnchor(anchor,'boot1'));assert.ok(!validAnchor(anchor,'boot2'));
 const p=measuredPose([2,3-.954,Math.PI/2],anchor);
 close(p.x,1.431);close(p.y,7.155);close(p.heading,Math.PI);
});
test('unanchored odometry retains actual coordinate frame and rotation',()=>{
 assert.deepEqual(measuredPose([1.2,-.3,-.8]),{x:1.2,y:-.3,heading:-.8});
});
test('age, HTTP latency, disconnect and wrong pose source cannot appear live',()=>{
 const s={pose_source:'/lawengwanla/mainprogram/odom',pose:[0,0,0],pose_fresh:true,pose_age_ms:30,pose_epoch:'boot1',pose_sequence:1};
 assert.ok(livePoseFresh(s,100,200));assert.ok(!livePoseFresh(s,100,500));assert.ok(!livePoseFresh(s,100,200,true));
 assert.ok(!livePoseFresh({...s,pose_source:'/simulation'},100,200));assert.ok(!livePoseFresh({...s,pose:[NaN,0,0]},100,200));
});
test('movement and turn labels use measured velocities rather than commanded goals',()=>{
 assert.equal(actualMotion([0,0,0],[.2,0,0],true),'เดินหน้า');
 assert.equal(actualMotion([0,0,0],[0,-.2,0],true),'สไลด์ขวา');
 assert.match(actualMotion([0,0,0],[0,0,.5],true),/หมุนซ้าย/);
 assert.match(actualMotion([0,0,0],[0,0,-.5],true),/หมุนขวา/);
 assert.match(actualMotion([0,0,0],[0,0,0],true),/หยุดนิ่ง/);
 assert.match(actualMotion([0,0,0],[9,9,9],false),/ข้อมูล odometry ขาด/);
});
