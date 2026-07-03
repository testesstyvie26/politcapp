const fs = require('fs');
// ---- Minimal DOM/Window stub ----
const noop = () => {};
function mkClassList(){ const s=new Set(); return {add:x=>s.add(x),remove:x=>s.delete(x),toggle:(x,f)=>{f?s.add(x):s.delete(x);return f;},contains:x=>s.has(x)}; }
function mkEl(tag='div'){
  const attrs={}; const kids=[];
  const el={
    tagName:(tag||'div').toUpperCase(), style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:mkClassList(), children:kids, hidden:false, disabled:false, offsetParent:{}, offsetWidth:120, offsetHeight:40,
    dataset:{}, textContent:'', innerHTML:'',
    setAttribute:(k,v)=>{attrs[k]=v;}, getAttribute:k=>attrs[k]??null, hasAttribute:k=>k in attrs, removeAttribute:k=>{delete attrs[k];},
    appendChild:c=>{kids.push(c);return c;}, prepend:noop, insertBefore:(n)=>n, remove:noop, closest:()=>null, contains:()=>false,
    addEventListener:noop, removeEventListener:noop, focus:noop, click:noop,
    querySelector:()=>null, querySelectorAll:()=>[],
    getBoundingClientRect:()=>({top:0,left:0,right:120,bottom:40,width:120,height:40}),
    getContext:()=>ctx2d,
  };
  return el;
}
const ctx2d = new Proxy({}, { get:(t,p)=> {
  if(p==='createRadialGradient') return ()=>({addColorStop:noop});
  if(p==='createLinearGradient') return ()=>({addColorStop:noop});
  return typeof p==='string' ? noop : undefined;
}});

const navEl = mkEl('nav'); navEl.setAttribute('aria-label','Nav');
navEl.querySelectorAll = (sel)=> sel && sel.includes('summary') ? [] : [];
const doc = {
  readyState:'complete', documentElement:{scrollHeight:2000,clientHeight:900,scrollTop:0},
  body: mkEl('body'), hidden:false,
  createElement: mkEl, getElementById:()=>null,
  querySelector:(s)=> s==='nav.site-nav[aria-label]'?navEl : (s && s.includes('.wrap')?mkEl():null),
  querySelectorAll:(s)=> s==='[data-reveal]'?[] : [],
  addEventListener:noop, removeEventListener:noop,
};
const win = {
  matchMedia:()=>({matches:false,addEventListener:noop,addListener:noop}),
  requestAnimationFrame:()=>1, cancelAnimationFrame:noop,
  addEventListener:noop, removeEventListener:noop, scrollTo:noop, scrollY:0,
  innerWidth:1280, innerHeight:900, devicePixelRatio:1,
  getComputedStyle:()=>({position:'static'}),
  performance:{now:()=>0}, setTimeout:(f)=>{try{f&&f()}catch(e){}return 1;}, clearTimeout:noop,
  IntersectionObserver: class{ constructor(){} observe(){} unobserve(){} disconnect(){} },
};
global.window=win; global.document=doc; global.performance=win.performance;
global.matchMedia=win.matchMedia; global.requestAnimationFrame=win.requestAnimationFrame;
global.cancelAnimationFrame=win.cancelAnimationFrame; global.IntersectionObserver=win.IntersectionObserver;
global.getComputedStyle=win.getComputedStyle; global.navigator={userAgent:'node'};
Object.assign(global, {location:{pathname:'/index.html'}});

let ok=true;
for(const f of ['js/site-nav.js','js/site-bg.js','js/site-interactions.js']){
  try{
    const code=fs.readFileSync(f,'utf8');
    // run in current global context
    (new Function('window','document',code))(win,doc);
    console.log('RAN OK :', f);
  }catch(e){ ok=false; console.log('THREW  :', f, '→', e.message); }
}
// exercise window.toast
try{ if(typeof win.toast==='function'){ win.toast('teste',{type:'ok'}); console.log('toast() callable OK'); } else console.log('toast() NOT defined'); }catch(e){ ok=false; console.log('toast threw', e.message); }
console.log('\nSMOKE:', ok?'PASS':'FAIL');
