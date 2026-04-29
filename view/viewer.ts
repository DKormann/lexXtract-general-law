
import { get_path, set_path, stringify, type JsonData } from "../model/json";
import { button, color, div, errorpopup, h2, h3, p, padding, popup, pre, span, style, textarea, width } from "./html";
import { ANY, format, validate, type Pattern } from "../model/pattern";


type Path = (string | number)[]
type View = (d:JsonData, path?: Path, onclick?: (path:Path)=>void)=>HTMLElement


export const jsonView : View = (d, path = [], onclick_):HTMLElement =>{

  let onclick = ()=>onclick_?.(path)
  let mkclickable = (el:HTMLElement)=>{
    el.style.cursor = "pointer"
    el.onclick = onclick
    return el
  }
  let margin = "0.2em"
  if (Array.isArray(d)){
    return div(d.map((x,i)=>{
      let el = jsonView(x, [...path, i], onclick_)
      el.prepend(span("• ", style({color:color.gray})))
      return mkclickable(el)
    }))
  }
  if (typeof d == "string" || typeof d == "number" || d == null) {
    return mkclickable(div(style({color: typeof d == "string" ? color.color : color.blue, margin , whiteSpace:"pre-wrap"}),String(d)))
  }
  return div(...Object.entries(d).map(([k,v])=>{
    let ch = jsonView(v, [...path, k], onclick_)
    let toggle = button("-", {
      style:{
        background:"unset",
        border:"unset",
        cursor:"pointer",
        padding:"0",
        width:"1.1em",
        fontWeight:"bold",
        fontSize:"1.1em",
        color:color.gray,
      },
      onclick:e=>{
      if (ch.style.display == "none"){
        ch.style.display = ""
        toggle.innerText = "-"
      }else{
        ch.style.display = "none"
        toggle.innerText = "+"
      }
      e.stopPropagation()
    }})
    ch.style.marginLeft = "1em"
    return [mkclickable(p(toggle, style({fontWeight:"bold", margin}),k,": ")), ch]
  }))
}


let sample = {
  array: [1,2,3],
  textArray: ["Bob","Alice","Eve"],
  object: {a:1, b:"text", c:{nested: "value"}},
  text: "hello",
  longText: "Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit.\nSed do eiusmod tempor incididunt\nsut labore et dolore magna aliqua.",
  number: 42,
  empty_array: [],
  empty_object: {},
  empty_string: "",
  null_value: null,
}


let listener = () => {}


export const viewer = <T extends JsonData>(
  data: {
    get: ()=>T,
    set: (t:T)=>Promise<void>,
    pattern: Pattern,
    onupdate?: (f:()=>void)=>void
  },
  displayfn: View = jsonView) =>{


  let el = div("loading...")
  let update = ()=>{
    el.replaceChildren(displayfn(data.get(), [], pth=>{
      if (!data.onupdate) return
      let d = get_path(data.get(), pth) as T
      let astext = typeof d == "string"
      let newd = d
      let ta = textarea({oninput:()=>{
        try{
          console.log(ta.value)
          let v = astext ? ta.value : JSON.parse(ta.value)
          newd = set_path(data.get(),pth,v) as T
          validate(data.pattern, newd)
          info.innerText = ""
        }catch(e){
          info.innerText = "Invalid JSON: "+e
        }
      }})
      ta.value = astext ? d as string : JSON.stringify(d, null, 2);
      ta.cols = 60;
      ta.rows = Math.min(20, Math.max(3, ta.value.split("\n").length));

      let info = p();
      let pop = popup(
        h2("Edit value"),
        h3("Path: "+pth.join(".")),
        ta,
        info,
        button("save", {onclick:()=>{data.set(newd); pop.remove()}})
      )
    }))
  }

  data.onupdate?.(update)
  update()

  return el


}



 popup(
  h2("This is a demo of the lexXtract json interface."),
  div(
    viewer(
      {
        get: ()=>sample,
        set: async (v)=>{sample = v; listener()},
        onupdate: (f)=> listener = f,
        pattern: ANY
      },
      jsonView
    )
  )
)
