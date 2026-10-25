const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../utils/recoveredConfiguration.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017}}).outputText;
const mod={exports:{}};new Function('require','module','exports',code)(require,mod,mod.exports);
const {restoreRecoveredConfiguration:restore,RECOVERED_BROWSER_CONFIG:recovered,CONFIG_RECOVERY_KEY:marker,CONFIG_RECOVERY_BACKUP_KEY:backup}=mod.exports;
const waypoint='lawengwanla-waypoint-settings-v1',execution='lawengwanla-mainprogram-settings-v2',route='lawengwanla-maze-route-v1';
function storage(initial={}){const values=new Map(Object.entries(initial));return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};}

test('recover saved cells, route and START settings with an exact prior-value backup',()=>{
 const s=storage({[waypoint]:'{}',[route]:'[]'});assert.equal(restore(s),true);
 assert.deepEqual(JSON.parse(s.getItem(waypoint)),recovered[waypoint]);
 assert.equal(Object.keys(JSON.parse(s.getItem(waypoint))).length,9);
 assert.equal(JSON.parse(s.getItem(waypoint))['7,2'].distance_offset_m,.2);
 assert.equal(JSON.parse(s.getItem(route)).length,37);
 assert.equal(JSON.parse(s.getItem(execution)).cell_m,.954);
 assert.deepEqual(JSON.parse(s.getItem(backup))[waypoint],'{}');
 assert.equal(s.getItem(marker),'done');
});

test('keep surviving X/Y, stop selections, other cells and START offsets',()=>{
 const old={'7,2':{distance_offset_x_m:.12,distance_offset_y_m:-.08,distance_offset_axis:'x',stop_here:true},'1,1':{speed_mps:.4}};
 const oldRoute=[{row:7,col:0}];
 const s=storage({[waypoint]:JSON.stringify(old),[execution]:JSON.stringify({approach_offset_x_m:.07,approach_offset_y_m:-.03}),[route]:JSON.stringify(oldRoute)});
 restore(s);const after=JSON.parse(s.getItem(waypoint));
 assert.equal(after['7,2'].speed_mps,.75);assert.equal(after['7,2'].distance_offset_x_m,.12);assert.equal(after['7,2'].distance_offset_y_m,-.08);
 assert.equal(after['7,2'].stop_here,true);assert.equal(after['7,2'].distance_offset_axis,'x');assert.deepEqual(after['1,1'],old['1,1']);
 assert.deepEqual(JSON.parse(s.getItem(route)),oldRoute);
 assert.equal(JSON.parse(s.getItem(execution)).approach_offset_x_m,.07);
 assert.equal(JSON.parse(s.getItem(execution)).approach_offset_y_m,-.03);
});

test('future edits survive reload and recovery never rewrites its original backup',()=>{
 const s=storage();restore(s);const before=s.getItem(backup);
 s.setItem(waypoint,JSON.stringify({'7,2':{speed_mps:.9}}));
 assert.equal(restore(s),false);assert.equal(JSON.parse(s.getItem(waypoint))['7,2'].speed_mps,.9);assert.equal(s.getItem(backup),before);
});

test('malformed old JSON is backed up and replaced with recovered settings',()=>{
 const s=storage({[waypoint]:'broken',[execution]:'null',[route]:'oops'});restore(s);
 assert.equal(JSON.parse(s.getItem(backup))[waypoint],'broken');assert.equal(JSON.parse(s.getItem(waypoint))['4,5'].distance_offset_m,.2);
});

test('interrupted recovery retries without losing the original backup',()=>{
 const s=storage({[waypoint]:'{}'});const write=s.setItem;let fail=true;
 s.setItem=(k,v)=>{if(k===execution&&fail){fail=false;throw Error('storage unavailable');}write(k,v);};
 assert.throws(()=>restore(s));assert.equal(s.getItem(marker),null);const before=s.getItem(backup);
 assert.equal(restore(s),true);assert.equal(s.getItem(backup),before);assert.equal(JSON.parse(before)[waypoint],'{}');
});
