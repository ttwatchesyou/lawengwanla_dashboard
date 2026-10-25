const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../utils/gripperAxes.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleValue={exports:{}};new Function('module','exports',code)(moduleValue,moduleValue.exports);
const {gripperCanJog,gripperCanTarget}=moduleValue.exports;
const packet=(extra={})=>({axis:"idle",active_mask:0,homed:true,commanded_steps:10,...extra});
test('PA0 blocks up while down remains available, PA1 blocks down while up remains available',()=>{
 assert.equal(gripperCanJog(packet({active_mask:1}),'lift',1,100),false);
 assert.equal(gripperCanJog(packet({active_mask:1}),'lift',-1,100),true);
 assert.equal(gripperCanJog(packet({active_mask:2}),'lift',-1,100),false);
 assert.equal(gripperCanJog(packet({active_mask:2}),'lift',1,100),true);
});
test('PA2 blocks toward zero only and allows backing away into configured range',()=>{
 assert.equal(gripperCanJog(packet({active_mask:4,commanded_steps:0}),'stepper',-1,100),false);
 assert.equal(gripperCanJog(packet({active_mask:4,commanded_steps:0}),'stepper',1,100),true);
});
test('pulse maximum blocks further forward motion while reverse remains available',()=>{
 assert.equal(gripperCanJog(packet({commanded_steps:100}),'stepper',1,100),false);
 assert.equal(gripperCanJog(packet({commanded_steps:100}),'stepper',-1,100),true);
 assert.equal(gripperCanJog(packet({commanded_steps:0}),'stepper',-1,100),false);
});
test('moving right requires home, with an optional measured pulse maximum',()=>{
 assert.equal(gripperCanJog(packet({homed:false}),'stepper',1,100),false);
 assert.equal(gripperCanJog(packet(),'stepper',1,0),true);
 assert.equal(gripperCanJog(null,'lift',1,100),false);
 assert.equal(gripperCanJog(packet(),'stepper',1,100),true);
});

test('a held PA2 permits right escape without a measured maximum',()=>{
 assert.equal(gripperCanJog(packet({active_mask:4,commanded_steps:0}),'stepper',1,0),true);
 assert.equal(gripperCanJog(packet({active_mask:4,commanded_steps:0}),'stepper',-1,0),false);
});

test('click targets interlock held limits, right and center positions, and active moves',()=>{
 const p=packet({commanded_steps:0,active_mask:4});
 assert.equal(gripperCanTarget(p,'left',10882),false);
 assert.equal(gripperCanTarget(p,'right',10882),true);
 assert.equal(gripperCanTarget(p,'center',10882),true);
 assert.equal(gripperCanTarget(packet({commanded_steps:5441}),'center',10882),false);
 assert.equal(gripperCanTarget(packet({commanded_steps:10882}),'right',10882),false);
 assert.equal(gripperCanTarget(packet({commanded_steps:10882}),'center',10882),true);
 assert.equal(gripperCanTarget(packet({homed:false}),'center',10882),false);
 assert.equal(gripperCanTarget(packet({active_mask:1}),'up',10882),false);
 assert.equal(gripperCanTarget(packet({active_mask:1}),'down',10882),true);
 assert.equal(gripperCanTarget(packet({active_mask:2}),'down',10882),false);
 assert.equal(gripperCanTarget(packet({active_mask:2}),'up',10882),true);
 assert.equal(gripperCanTarget(packet({axis:'stepper'}),'up',10882),false);
});
