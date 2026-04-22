import { db } from "../src/app";
import type { Stored } from "../src/db";
import type { JsonData } from "../src/struct";
import { button, color, div, errorpopup, p, padding, popup, pre, style, textarea } from "./html";
import type { ModPath } from "./main";

export const jsonView = (d:JsonData):HTMLElement =>{

  let empty = pre(style({fontStyle:"italic"}), `<empty ${typeof d}>`)

  return div(
    style({paddingLeft:"0.5em", borderLeft:"2px solid "+color.gray, }),
    (typeof d == "string") ? (d ? pre(d) : empty) :
    (d instanceof Array) ? (d.length ? div(...d.map(jsonView)) : empty) :
    (d instanceof Object) ? Object.keys(d).length ? div(...Object.entries(d).map(([k,v])=>p(k, ":", jsonView(v)))) : empty :
    errorpopup("Invalid data")
  )
}

export const viewer = <T extends JsonData>(data:Stored<T>, viewer:(d:JsonData)=>HTMLElement = jsonView) => {

  let editmode = false
  let bod = div("loading...")
  let but = button("edit", {onclick:()=>setedit(!editmode)})
  let cancel = button("cancel", {onclick:()=>{
    editmode = false
    bod.replaceChildren(viewer(dat))
    but.textContent = "edit"
  }})
  let el = div(but, bod)

  let dat:JsonData = ""
  let editor = pre({contentEditable:true, style:{
    padding:"1em",
    width: "100%",
  }})


  let setedit = (val:boolean)=>{
    
    editmode = val
    if (editmode){
      editor.textContent = JSON.stringify(dat, null, 2)
      bod.replaceChildren(cancel, editor)
      editor.focus()
      but.textContent = "save"
    }else{
      but.textContent = "saving..."
      try{
        let next = JSON.parse(editor.textContent)
        data.set(next).then(()=>{
          but.textContent = "edit"
          dat = next
          bod.replaceChildren(viewer(dat))
        })
        
      } catch(e){
        but.textContent = "save"
        errorpopup(String(e))
      }
    }
  }

  data.onupdate(()=>{
    data.get().then(d=>{
      dat = d
      if (editmode) setedit(true)
      else bod.replaceChildren(viewer(dat))
    })
  })

  data.get().then(d=>{
    dat = d
    bod.replaceChildren(viewer(dat))
  })
  return el

}
