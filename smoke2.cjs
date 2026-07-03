const fs=require('fs');
const noop=()=>{};
function mkClassList(){const s=new Set();return{add:x=>s.add(x),remove:x=>s.delete(x),toggle:(x,f)=>{f?s.add(x):s.delete(x);return f;},contains:x=>s.has(x)};}
const ctx2d=new Proxy({},{get:(t,p)=>p==='createRadialGradient'||p==='createLinearGradient'?()=>({addColorStop:noop}):(typeof p==='string'?noop:undefined)});
function mkEl(tag='div'){
  const attrs={};const kids=[];
  const el={
    tagName:(tag||'div').toUpperCase(),style:new Proxy({},{get:()=>'',set:()=>true}),
    classList:mkClassList(),children:kids,parentNode:null,hidden:false,disabled:false,offsetParent:{},offsetWidth:120,offsetHeight:40,dataset:{},textContent:'',innerHTML:'',
    setAttribute:(k,v)=>{attrs[k]=v;},getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs,removeAttribute:k=>{delete attrs[k];},
    appendChild:c=>{kids.push(c);if(c&&typeof c==='object')c.parentNode=el;return c;},prepend:noop,
    insertBefore:(n)=>{kids.push(n);return n;},remove:noop,closest:()=>null,contains:()=>false,
    addEventListener:noop,removeEventListener:noop,focus:noop,click:noop,
    querySelector:sel=>mkEl(),querySelectorAll:()=>[],
    getBoundingClientRect:()=>({top:0,left:0,right:120,bottom:40,width:120,height:40}),getContext:()=>ctx2d,
  };
  return el;
}
const bodyEl=mkEl('body');
const navEl=mkEl('nav');navEl.setAttribute('aria-label','Nav');navEl.querySelectorAll=()=>[];
const wrapEl=mkEl('div');wrapEl.parentNode=bodyEl;
const doc={readyState:'complete',documentElement:{scrollHeight:2000,clientHeight:900,scrollTop:0},body:bodyEl,hidden:false,
  createElement:mkEl,getElementById:()=>null,
  querySelector:s=>s==='nav.site-nav[aria-label]'?navEl:(s&&s.includes('.wrap')?wrapEl:null),
  querySelectorAll:()=>[],addEventListener:noop,removeEventListener:noop};
const win={matchMedia:()=>({matches:false,addEventListener:noop,addListener:noop}),requestAnimationFrame:()=>1,cancelAnimationFrame:noop,
  addEventListener:noop,removeEventListener:noop,scrollTo:noop,scrollY:0,innerWidth:1280,innerHeight:900,devicePixelRatio:1,
  getComputedStyle:()=>({position:'static'}),performance:{now:()=>0},setTimeout:(f)=>{return 1;},clearTimeout:noop,
  IntersectionObserver:class{observe(){}unobserve(){}disconnect(){}}};
global.window=win;global.document=doc;global.performance=win.performance;global.matchMedia=win.matchMedia;
global.requestAnimationFrame=win.requestAnimationFrame;global.cancelAnimationFrame=win.cancelAnimationFrame;
global.IntersectionObserver=win.IntersectionObserver;global.getComputedStyle=win.getComputedStyle;
global.navigator={userAgent:'node'};global.location={pathname:'/index.html'};
let ok=true;
for(const f of ['js/site-nav.js','js/site-bg.js','js/site-interactions.js']){
  try{(new Function('window','document',fs.readFileSync(f,'utf8')))(win,doc);console.log('RAN OK :',f);}
  catch(e){ok=false;console.log('THREW  :',f,'→',e.message);}
}
try{win.toast('teste',{type:'ok'});console.log('toast() callable OK');}catch(e){ok=false;console.log('toast threw',e.message);}
console.log('\nSMOKE:',ok?'PASS':'FAIL');
