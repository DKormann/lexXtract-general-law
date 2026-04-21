
import { db } from "../src/app";
import { Stored } from "../src/helpers";
import { request } from "../src/request";
import { Schema, type JsonData } from "../src/struct";
import { fillSchema, localDB, TaxonomySchema } from "../src/struct";
import type { Module, Taxonomy } from "../src/types";
import { background, body, border, button, color, div, h2, h3, height, margin, p, padding, popup, pre, span, style, textarea, type HTMLArg } from "./html";
import { viewer } from "./viewer";

let page = div({
})

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

let header = h2("lexxtract")

let module_list = db.get("modules", Schema.array(Schema.string))
body.append(
  header,
  button("+add module", {onclick:()=>{
    let name = prompt("Module name")
    if (!name) return
    module_list.get().then(mods=>{
      module_list.set([...mods as string[], name])
      current_module.set(name)
    })
  }}),
  button("pick module", {
  onclick:async ()=>{

    let mods = await module_list.get() as string[]
    let pop = popup(
      h3("choose a module"),
      mods.map(m=>{
        return p(button(m, {onclick:()=>{
          current_module.set(m)
          pop.remove()
        }}))
      })
    )
  }
}))

let current_module = db.get("current_module", Schema.string)

current_module.get().then(m=>{
  if (m) show_module(m as string)
})

current_module.onupdate(async ()=>{
  let mod = await current_module.get()
  if (mod) show_module(mod as string)
})

const show_module = (mod:string) => {

  let mod_db = (key:string, schema:Schema) => db.get(mod+":"+key, schema)

  let taxonomy = mod_db("taxonomy", TaxonomySchema)
  const Taxonomy = viewer(taxonomy)

  let documents = mod_db("documents", Schema.record(Schema.string))
  const Documents = viewer(documents)

  let prompt = mod_db("prompt", Schema.string)
  const Prompt = viewer(prompt)

  const sections : {[key:string]: HTMLElement} = {
    Taxonomy,
    Documents,
    Prompt
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


  header.textContent = "lexxtract : " + mod

  page.replaceChildren(
    div(
      style({
        marginTop:"1em",
        display:"flex",
        flexDirection:"row",
        gap:"2em",

      }),
      sidebar,
      contentbar
    )
  )
}

body.append(page)