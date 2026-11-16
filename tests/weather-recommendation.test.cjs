const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),Module=require("node:module"),ts=require("typescript");
const filename=require.resolve("../app/lib/weatherRecommendation.ts");
const compiled=new Module(filename,module);
compiled.filename=filename;compiled.paths=module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {getActivityWeatherAdvice:advice}=compiled.exports;
const point=(type,temperature=15,wind=5,rain=0)=>({weatherCondition:{type},temperature:{degrees:temperature},wind:{speed:{value:wind}},precipitation:{probability:{percent:rain}}});
test("missing weather never becomes a recommendation to go outside",()=>{
 for(const input of [undefined,{},point("CLEAR",NaN),point("CLEAR",null),point("")]){
  const result=advice(input,"běh");assert.equal(result.tone,"neutral");assert.equal(result.title,"Počasí není dostupné");
 }
});
test("storm and freezing conditions warn independently of precipitation probability",()=>{
 for(const type of ["THUNDERSTORM","FREEZING_RAIN"]){
  assert.equal(advice(point(type,5,5,0),"běh").tone,"warning");
  assert.equal(advice(point(type,5,5,0),"chůze").tone,"warning");
 }
});
test("snow, hail, rain and fog match the visible weather instead of ideal conditions",()=>{
 for(const type of ["SNOW","SLEET","HAIL","RAIN","DRIZZLE","FOG","HAZE"])assert.equal(advice(point(type),"běh").tone,"caution");
 assert.equal(advice(point("SNOW",0),"běh").tone,"warning");
 assert.equal(advice(point("RAIN",10,5,80),"běh").tone,"warning");
});
test("running and walking use their existing heat and wind thresholds",()=>{
 assert.equal(advice(point("CLEAR",28),"běh").tone,"warning");
 assert.equal(advice(point("CLEAR",28),"chůze").tone,"caution");
 assert.equal(advice(point("CLEAR",15,40),"běh").tone,"warning");
 assert.equal(advice(point("CLEAR",15,40),"chůze").tone,"caution");
 assert.match(advice(point("CLEAR"),"chůze").title,/Chůze/);
 assert.equal(advice(point("CLEAR"),"běh").tone,"good");
});
