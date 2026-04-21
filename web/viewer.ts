import type { JsonData, Stored } from "../src/struct";
import { button, color, div, errorpopup, p, pre, style, textarea } from "./html";

export const jsonView = (d:JsonData):HTMLElement =>{



    return div(
      style({paddingLeft:"0.5em", borderLeft:"2px solid "+color.gray, }),
      (typeof d == "string") ? pre(d) :
      (d instanceof Array) ? div(...d.map(jsonView)) :
      (d instanceof Object) ? div(...Object.entries(d).map(([k,v])=>p(k, ":", jsonView(v)))) :
      errorpopup("Invalid data")
    )
  }

export const viewer = (data:Stored, viewer:(d:JsonData)=>HTMLElement = jsonView) => {

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
  let editor = pre({contentEditable:true})


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
      if (!editmode) bod.replaceChildren(viewer(dat))
    })
  })

  data.get().then(d=>{
    dat = d
    bod.replaceChildren(viewer(dat))
  })
  return el

}
