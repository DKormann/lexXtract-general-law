
import { create_module, list_module } from "../src/app";
import { Stored } from "../src/helpers";

import { background, body, button, color, div, h2, h3, popup, style } from "./html";

let page = div()

body.append(
  div(
    h2("lexxtract"),
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
        cursor:"pointer"
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
        mkbutton(x, ()=>{
          display_module(x)
          pop.remove()
        })
      ),
      mkbutton("+ new module", ()=>{
        display_module(new_module())
        pop.remove()
      })
    )
  )
}

let display_module = (name:string)=>{
  current_module.set(name)
  page.innerHTML = '',
  page.appendChild(div(`Module: ${name}`))
}


if (!list_module().includes(current_module.get()!)){
  pick_module()
}else{
  display_module(current_module.get()!)
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
