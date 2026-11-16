const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),Module=require("node:module"),ts=require("typescript");
const React=require("react"),{renderToStaticMarkup}=require("react-dom/server");
function load(file,dependencies={}){
 const filename=path.resolve(__dirname,"..",file),testModule={exports:{}},requireFile=Module.createRequire(filename);
 const code=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{module:testModule,exports:testModule.exports,require:name=>dependencies[name]||requireFile(name),URL,console},{filename});
 return testModule.exports;
}
const helper=load("app/lib/imageUrl.ts");
const urls=["https://res.cloudinary.com/demo/image/upload/v123/users/a.jpg","https://res.cloudinary.com/demo/image/upload/v123/users/b.jpg"];
test("card previews use a bounded thumbnail and never load full-size legacy URLs",()=>{
 for(const value of urls){const thumbnail=helper.activityThumbnailUrl(value);assert.notEqual(thumbnail,value);assert.match(thumbnail,/f_auto,q_auto:eco,c_limit,w_240,h_160\/v123/);}
 for(const value of ["https://example.test/image/upload/a.jpg","https://firebasestorage.googleapis.com/v0/a.jpg","http://res.cloudinary.com/demo/image/upload/a.jpg","data:image/png;base64,x","invalid"])assert.equal(helper.activityThumbnailUrl(value),"");
});
test("an existing large transform cannot override the final thumbnail dimensions",()=>{
 const value=helper.activityThumbnailUrl("https://res.cloudinary.com/demo/image/upload/w_2000/v123/users/a.jpg");
 assert.match(value,/w_2000\/f_auto,q_auto:eco,c_limit,w_240,h_160\/v123\/users\/a.jpg$/);
});
const hooks={...React,useCallback:fn=>fn,useEffect:()=>{},useRef:()=>({current:null}),useState:value=>[value,()=>{}]};
const Gallery=load("app/components/ActivityGallery.tsx",{"react":hooks,"../lib/imageUrl":helper}).default;
test("clicking a later thumbnail retains its actual photo index",()=>{
 const opened=[],tree=Gallery({images:urls,onOpen:index=>opened.push(index)});
 const thumbnails=tree.props.children.props.children;
 const second=thumbnails[1].type(thumbnails[1].props);
 second.props.onClick();
 assert.deepEqual(opened,[1]);
 assert.equal(Gallery({images:[],onOpen:()=>{}}),null);
});
test("gallery markup defers previews, uses small images, and omits arrows for one image",()=>{
 const html=renderToStaticMarkup(React.createElement(Gallery,{images:urls,onOpen:()=>{}}));
 const sources=Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g),match=>match[1]);
 assert.equal(sources.length,2);assert.ok(sources.every(src=>src.includes("w_240,h_160")));
 assert.equal((html.match(/loading="lazy"/g)||[]).length,2);
 assert.doesNotMatch(html,/Posunout fotografie|activity-gallery-number|activity-gallery-arrow/);
 const single=renderToStaticMarkup(React.createElement(Gallery,{images:[urls[0]],onOpen:()=>{}}));
 assert.doesNotMatch(single,/Posunout fotografie/);
});
