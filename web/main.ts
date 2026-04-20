
import { Stored } from "../src/helpers";
import { request } from "../src/request";
import type { JsonData, Schema } from "../src/struct";
import { fillSchema, localDB, TaxonomySchema } from "../src/struct";
import type { Module, Taxonomy } from "../src/types";
import { background, body, border, button, color, div, h2, h3, height, margin, p, padding, popup, pre, span, style, textarea, type HTMLArg } from "./html";
import { viewer } from "./viewer";

let page = div({
})


let current_module = Stored<string | null>("current_module", null)

let mkbutton = (text:string, onclick:()=>void):HTMLButtonElement=>{
  return button(
    text,{onclick,
      style:{
        background:color.gray,
        border:"unset",
        color:color.color,
        padding:"0.5em 1em",
        borderRadius:".3em",
        cursor:"pointer",
        margin:"0 0.5em"
      }
    }
  )
}



let string_editor = (content:string, update:(s:string)=>void, tag:(...cs: HTMLArg[])=> HTMLElement = pre , style:Partial<CSSStyleDeclaration> = {}):HTMLElement=>{
  let saver = button("save", {onclick: ()=>{
    let go = (c:Node):string=>{
      if (c instanceof HTMLBRElement) return "\n"
      else if (c instanceof Text) return c.textContent
      let t = Array.from(c.childNodes).map(go).join("")
      return c instanceof HTMLDivElement ? t + "\n" : t
    }
    let content = go(area)
    update(content);
    saver.style.display = "none";
  }, style:{display:"none", margin:"1em 0"}})
  let area = tag(
    content,
    {
      style:{
        padding:".2em",
        whiteSpace: "pre",
        ...style
      }
    },
    {contentEditable:true,
    oninput:()=>{saver.style.display = "block"}
  });
  return span(area, saver)
}

type Model = string

const models = Stored<Model[]>("models", [
  "openai/gpt-oss-120b",
  "anthropic/claude-opus-4.5",
])
const model = Stored<Model>("model", models.get()![0]!)

const model_picker = p()
{
  let but = button(model.get()!, {onclick:()=>{
    let mkpop = ()=>popup(
      h2("choose a model"),
      models.get()!.map(m=>
      p(
        button('-', {onclick:()=>{
          models.set(models.get()!.filter(x=>x!=m))
          update()
        }}),
        mkbutton(m, ()=> {
          model.set(m);
          but.textContent = m;
          pop.remove()
        })
      )),
      button("+add", {onclick:()=>{
        let name = prompt("choose model")
        if (!name)return 
        models.set([...models.get()!, name])
        update()
      }})
    )
    let update = ()=>{
      let np = mkpop()
      pop.replaceWith(np)
      pop = np
    }
    let pop = mkpop()

  }})
  model_picker.append("Model: ", but)

}


let format = (template:string, data:{[key:string]: string}):string=>{
  Object.entries(data).forEach(([k,v])=>{
    if (!template.includes(`{${k}}`)) throw new Error(`Placeholder {${k}} not found in template`)
    template = template.replaceAll(`{${k}}`, v)
  })
  return template
}


let taxonomy = localDB.get("admin", "taxonomy", TaxonomySchema)
const Taxonomy = viewer(taxonomy)



const docs = localDB.get("admin", name+".docs", 
  {type:"object", additionalProperties:{type:"string"} }
)

const Documents = div(
  viewer(docs),
  button("+add",{onclick:()=> docs.get().then(s=>docs.set({"untitled":"", ...(s as {})}))})
)

let it = localDB.get("admin", "admin.test", {type:"array", items:{type:"string"}})
it.get().then(d=>console.log("got data", d)).catch(e=>console.log("error getting data", e))



const sections : {[key:string]: HTMLElement} = {
  Taxonomy,
  Documents,
}

let defaultSection = "Taxonomy"

let content = div()

let contentbar = div(
  style({
    display:"flex",
    flexDirection:"column",
    gap:"1em",
    padding:"1em"
  }),
  content
)


let sidebar = div()
let renderSideBar = (item:string) => sidebar.replaceChildren(div(
  style({
    display:"flex",
    flexDirection:"column",
    borderRight:`1px solid ${color.gray}`,
    width:"200px",
    height:"100vh",
  }),
  ...Object.entries(sections).map(([k,v])=>{
    if (item == k) content.replaceChildren(v)
    return h3(k, {
      style:{
        cursor:"pointer",
        margin:0,
        padding:".4em",
        ...(item == k ? {
          background: color.gray,
        } : {})
      },
      onclick: ()=>renderSideBar(k)
    })
  })
))
renderSideBar(defaultSection)


page.replaceChildren(

  div(
    style({
      display:"flex",
      flexDirection:"row",
      gap:"2em",

    }),
    sidebar,
    contentbar
  )
)

body.append(page)