
import { create_module, get_module, list_module } from "../src/app";
import { Stored } from "../src/helpers";
import type { Module } from "../src/types";

import { background, body, button, color, div, h2, h3, height, p, popup, span, style, textarea } from "./html";

let page = div()

body.append(
  div(
    h2("lexxtract", {onclick: ()=>{pick_module()}}),
    style({
      fontFamily:"sans-serif",
    }),
    page
  )
)

let current_module = Stored<string | null>("current_module", null)

let mkbutton = (text:string, onclick:()=>void):HTMLButtonElement=>{
  return button(
    text,{onclick,
      style:{
        background:color.gray,
        border:"unset",
        color:color.background,
        padding:"0.5em 1em",
        borderRadius:".3em",
        cursor:"pointer",
        margin:"0 0.5em"
      }
    }
  )
}

let pick_module = ()=>{

  let pop = popup(
    div(
      style({
        background: color.background,
        padding: "1em",
        borderRadius: ".4em",
      }),
      h2("Pick a module"),
      ...list_module().map(x=>
        p(mkbutton(x, ()=>{
          display_module(x)
          pop.remove()
        }))
      ),
      p(mkbutton("+ new module", ()=>{
        display_module(new_module())
        pop.remove()
      }))
    )
  )
}



let new_module = ()=>{
  let name = "new_module"
  let ctr = 0
  while (list_module().includes(name)){ name = "new_module_" + ctr ++ }
  create_module(name,
    {
      name: name+"_taxonomy",
      description:"the root of the taxonomy",
      children:[],
    },
    "module prompt",
    [],
  )
  return name
}

let display_module = (name:string)=>{

  current_module.set(name)
  page.innerHTML = ''
  let module = get_module(name)

  console.log(JSON.stringify(module.get(), null, 2))
  let update = (f:(m:Module)=>Module)=>{module.set(f(module.get()!))}

  const Prompt = textarea({oninput:(e)=> update(m=>({...m, prompt:Prompt.value}))})
  Prompt.value = module.get()!.prompt

  const Taxonomy = div(JSON.stringify(module.get()!.taxonomy, null, 2))

  const Content = div()

  const sections : {[key:string]: HTMLElement} = {
    Prompt,
    Taxonomy,
    Content
  }

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

  let sidebar = div(
    style({
      display:"flex",
      flexDirection:"column",
      padding:".5em",
      borderRight:`1px solid ${color.gray}`,
      width:"200px",
      height:"100vh",
    }),
    ...Object.entries(sections).map(([k,v])=>
      h3(k, {
        style:{
          cursor:"pointer",
        },
        onclick:()=>{
          content.replaceChildren(v)
          console.log(v)
        }
      })
    )
  )

  page.append(
    p( span("module: ",name, { style:{fontSize:"1.2em",fontWeight:"bold" }, onclick: ()=> {pick_module()}}),
    mkbutton("edit name",()=>{
      let newname = prompt("New module name", name)
      if (newname) {
        let dat = module.get()!;
        create_module(newname, dat.taxonomy, dat.prompt, dat.source, dat.extraction)
        module.del()
        display_module(newname)
      }
    }),

    mkbutton("switch module",()=>pick_module()),
    mkbutton("delete module",()=>{
      if(confirm("Are you sure you want to delete this module?")){
        module.del()
        current_module.set(null)
        pick_module()
      }
    })),
    div(
      style({
        display:"flex",
        flexDirection:"row",
        gap:"2em",
        padding:"1em"
      }),
      sidebar,
      contentbar
    )
  )
}


if (!list_module().includes(current_module.get()!)){
  pick_module()
}else{
  display_module(current_module.get()!)
}
