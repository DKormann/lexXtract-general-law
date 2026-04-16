(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))i(t);new MutationObserver(t=>{for(const e of t)if(e.type==="childList")for(const r of e.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function n(t){const e={};return t.integrity&&(e.integrity=t.integrity),t.referrerPolicy&&(e.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?e.credentials="include":t.crossOrigin==="anonymous"?e.credentials="omit":e.credentials="same-origin",e}function i(t){if(t.ep)return;t.ep=!0;const e=n(t);fetch(t.href,e)}})();const f={type:"string"},y={type:"object",name:"Role",description:"A legal Role is a Actor or Recipient, having a set of obligations and rights.",properties:{title:f,definition:f,summary:f},required:["title"]};console.log(JSON.stringify(y,null,2));let b=typeof window<"u";const a=b?localStorage:(()=>{const s=new Map;return{setItem:(o,n)=>{s.set(o,n)},getItem:o=>s.get(o),clear:()=>{s.clear()}}})();let d=a.getItem("api_key");for(;!d;)d=prompt("provide openrouter key"),a.setItem("api_key",d);const O=s=>{let o=s.toString();return((...n)=>{let i=JSON.stringify([o,n]),t=a.getItem(i);if(t){let r=JSON.parse(t);return r.async?Promise.resolve(r.value):r.value}let e=s(...n);return e instanceof Promise?e.then(r=>(a.setItem(i,JSON.stringify({async:!0,value:r})),r)):(a.setItem(i,JSON.stringify({async:!1,value:e})),e)})};O((s,o,n,i)=>fetch("https://openrouter.ai/api/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${d}`},body:JSON.stringify({model:o,input:s,reasoning:{effort:"low"},tools:[{type:"function",name:n.name,description:n.description,parameters:{type:"object",properties:{[n.argname]:n.argschema},required:[n.argname]}}],tool_choice:{type:"function",name:n.name}})}).then(e=>e.json()).then(e=>{let r=e;return{cost:r.usage.cost,output:JSON.parse(r.output.filter(c=>c.type=="function_call")[0].arguments)}}));const $=document.body,l={light:{color:"#000",background:"#fff",red:"rgb(242, 55, 55)",green:"rgb(57, 214, 39)",blue:"rgb(48, 82, 255)",gray:"#888"},dark:{color:"#fff",background:"#222",red:"rgb(198, 20, 0)",blue:"rgb(41, 48, 255)",green:"rgb(0, 185, 19)",gray:"#565656"}};let m=document.createElement("style");m.innerHTML=`
:root {
  --color: ${l.dark.color};
  --background: ${l.dark.background};
  --red: ${l.dark.red};
  --green: ${l.dark.green};
  --blue: ${l.dark.blue};
  --gray: ${l.dark.gray};
  color: var(--color);
  background: var(--background);
}
@media (prefers-color-scheme: light) {
  :root {
    --color: ${l.light.color};
    --background: ${l.light.background};
    --red: ${l.light.red};
    --green: ${l.light.green};
    --blue: ${l.light.blue};
    --gray: ${l.light.gray};
  }
}
`;document.head.appendChild(m);const p=(s,o,n="",i)=>{const t=document.createElement(s);return t.innerText=o,i&&Object.entries(i).forEach(([e,r])=>{e==="parent"&&r.appendChild(t),e==="children"?r.forEach(c=>t.appendChild(c)):e==="eventListeners"?Object.entries(r).forEach(([c,u])=>{t.addEventListener(c,u)}):e==="color"||e==="background"?t.style[e]=r:e==="style"?Object.entries(r).forEach(([c,u])=>{c=c.replace(/([A-Z])/g,"-$1").toLowerCase(),t.style.setProperty(c,u)}):e==="class"?t.classList.add(...r.split(".").filter(c=>c)):t[e]=r}),t},S=(s,...o)=>{let n=[],i={};const t=e=>{if(typeof e=="string")n.push(p("span",e));else if(typeof e=="number")n.push(p("span",e.toString()));else if(e instanceof Promise){const r=h();e.then(c=>{r.innerHTML="",r.appendChild(h(c))}),n.push(r)}else e instanceof HTMLElement?n.push(e):e instanceof Array?e.forEach(t):i={...i,...e}};for(let e of o)t(e);return p(s,"","",{...i,children:n})},g=s=>(...o)=>S(s,...o),L=g("h2"),E=g("div"),h=g("span");$.append(E(L("lexxtract")));
