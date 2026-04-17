
import { create_module, get_module, list_module } from "../src/app";
import { Stored } from "../src/helpers";
import type { Schema } from "../src/schemas";
import type { Module, Taxonomy } from "../src/types";

import { background, body, button, color, div, h2, h3, height, p, padding, popup, pre, span, style, textarea } from "./html";

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


let string_editor = (content:string, update:(s:string)=>void, style:Partial<CSSStyleDeclaration> = {}):HTMLElement=>{
  let saver = button("save", {onclick: ()=>{update(area.textContent);saver.style.display = "none"}, style:{display:"none", margin:"1em 0"}})
  let area = p(
    content,
    {
      style:{
        padding:".1em",
        ...style
      }
    },
    {contentEditable:true,
    oninput:()=>{saver.style.display = "block"}
  });
  return p(area, saver)
}


const schema_editor = (schema:Schema, update:(s:Schema) => void):HTMLElement=>{
  let area = string_editor(JSON.stringify(schema, null, 2), s=>{
    try{
      let parsed = JSON.parse(s)
      schema = parsed
      update(parsed)
    }catch(e){
      alert("Invalid JSON: " + e)
    }
  }, {
    fontFamily:"monospace",
    whiteSpace:"pre",
  })
  return area
}

const taxonomy_editor = (tax:Taxonomy, update:(t:Taxonomy)=>void):HTMLElement =>{

  let refresh = ()=>{
    update(tax)
    draw()
  }
  let res = div(style({paddingLeft:"1em",}))
  let draw = ()=>res.replaceChildren(
    h3(string_editor(tax.name, s=>{tax.name = s.replaceAll("\n", ' '); refresh()})),
    string_editor(tax.description, s=> {tax.description = s;refresh()}),
    tax.constraint ? p("constraint: "+tax.constraint) : span(),
    tax.style ? p("style: "+tax.style) : span(),
    div(
      p("children: ", button(
        " +add",
        {
          onclick: ()=>{
            name:"new taxonomy"
            tax.children.push({
              name: "new taxonomy",
              description: "empty description",
              children:[]
            })
            refresh()
          }
        }
      )),
      tax.children.map((x,i)=>
        [button("remove", {onclick:()=>{
          tax.children = tax.children.slice(0,i).concat(tax.children.slice(i+1))
          refresh()
        }}),
        taxonomy_editor((x), (t)=>{
          tax.children[i] = t
          update(tax)
        })]
      ),
    ),
    
    p("schema: ",
      tax.itemSchema? schema_editor(tax.itemSchema, s=>{
        tax.itemSchema = s
        refresh()
      }):
      button("+add", {
        onclick:()=>{
          tax.itemSchema = {type:"string"}
          refresh()
        }
      }) 
    )
  )
  draw()
  return res
}

let display_module = (name:string)=>{

  current_module.set(name)
  page.innerHTML = ''
  let module = get_module(name)

  let update = (f:(m:Module)=>Module)=>{module.set(f(module.get()!))}
  const Prompt = string_editor(module.get()!.prompt, s=>update(m=>({...m, prompt:s})));

  const Taxonomy = taxonomy_editor(module.get()!.taxonomy, (t)=>update(m=>({...m, taxonomy:t})))

  const Content = div("Not implemented yet")

  let docs = div()

  

  const Documents = div(
    module.get()!.source.map((s,i)=>{
      let content = div({
        style:{
          display: "none",
          whiteSpace:"pre-wrap",
        }
      })
      return [
        p("Document "+i, {onclick:()=>{
          if (content.textContent == "" && s.type == "txt") content.textContent = s.content
          content.style.display = content.style.display == "none" ? "block" : "none"
        }}),
        content,
      ]
    }),
    button("+add", {onclick:()=>{

    }})
  )

  const sections : {[key:string]: HTMLElement} = {
    Prompt,
    Taxonomy,
    Content,
    Documents,
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

  content.replaceChildren(Taxonomy)

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
