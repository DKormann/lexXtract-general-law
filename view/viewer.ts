import { db } from "../controller/app";
import type { Stored } from "../model/db";
import type { JsonData } from "../model/struct";
import { button, color, div, errorpopup, p, padding, popup, pre, span, style, textarea } from "./html";
import { format, validate, type Pattern } from "../model/pattern";

export const jsonView = (d:JsonData):HTMLElement =>{

  let empty = pre(style({fontStyle:"italic"}), `<empty ${d instanceof Array? "array": typeof d}>`)

  return div(
    style({paddingLeft:"0.5em", borderLeft:"2px solid "+color.gray, }),
    (typeof d == "string") ? (d ? pre(d) : empty) :
    (d instanceof Array) ? (d.length ? div(...d.map(jsonView)) : empty) :
    (d instanceof Object) ? Object.keys(d).length ? div(...Object.entries(d).map(([k,v])=>p(k, ":", jsonView(v)))) : empty :
    (typeof d == "number") ? pre(String(d)) :
    (d==undefined) ? pre("undefined") :
    errorpopup("Invalid data:"+JSON.stringify(d))
  )
}

export const viewer = <T extends JsonData>(
  data: {
    get: ()=>T,
    set: (t:T)=>Promise<void>,
    pattern: Pattern,
    onupdate?: (f:()=>void)=>void
  },
  displayfn:(d:JsonData)=>HTMLElement = jsonView) => {

  let editmode = false
  let bod = div("loading...")
  let but = button("edit", {onclick:()=>setedit(!editmode)})
  let cancel = button("cancel", {onclick:()=>{
    editmode = false
    bod.replaceChildren(displayfn(data.get()))
    but.textContent = "edit"
  }})
  let el = div(but, bod)

  let editstatus = p()
  let patternview = pre(style({ color:color.gray}), `expected type:\n${format(data.pattern)}`)

  let editor = pre({contentEditable:true,
    oninput:()=>{
      try{
        let d = JSON.parse(editor.textContent)
        validate(data.pattern, d)
        editstatus.textContent = "ok"
        editstatus.replaceChildren(span(style({color:color.green}), "ok"))
      }catch(e){
        editstatus.replaceChildren(span(style({color:color.red}), String(e)))
      }
    },
  style:{
    padding:"1em",
    width: "100%",
  }})

  let setedit = (val:boolean)=>{
    editmode = val
    if (editmode){

      editor.textContent = JSON.stringify(data.get(), null, 2)
      bod.replaceChildren(cancel, editor, editstatus, patternview)
      editor.focus()
      but.textContent = "save"
    }else{
      but.textContent = "saving..."
      try{
        let next = JSON.parse(editor.textContent)
        data.set(next).then(()=>{
          but.textContent = "edit"
          bod.replaceChildren(displayfn(data.get()))
        })
        
      } catch(e){
        but.textContent = "save"
        errorpopup(String(e))
      }
    }
  }

  bod.replaceChildren(displayfn(data.get()))
  if (data.onupdate) data.onupdate(()=>{bod.replaceChildren(displayfn(data.get()))})
  return el

}
