
import { create_module, get_module, list_module, taxSchema } from "../src/app";
import { extraction } from "../src/extract";
import { Stored } from "../src/helpers";
import { request } from "../src/request";
import type { Schema } from "../src/schemas";
import type { Module, Taxonomy } from "../src/types";

import { background, body, button, color, div, h2, h3, height, p, padding, popup, pre, span, style, textarea, type HTMLArg } from "./html";

let page = div({
})

body.append(
  div(
    h2("lexxtract", {onclick: ()=>{pick_module()}}),
    page,
    {style:{
      padding:"1em"
    }}
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
    "you are an extraction agent. Extract all relevant information from the following documents:\n\n{DOCUMENT}\n\n",
    {},
  )
  return name
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
    console.log(content)
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


const schema_editor = (schema:Schema, update:(s:Schema) => void):HTMLElement=>{
  let area = string_editor(JSON.stringify(schema, null, 2), s=>{
    try{
      let parsed = JSON.parse(s)
      schema = parsed
      update(parsed)
    }catch(e){
      alert("Invalid JSON: " + e)
    }
  }, p, {
    fontFamily:"monospace",
    whiteSpace:"pre",
  })
  return area
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
        [button("-", {onclick:()=>{
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

let format = (template:string, data:{[key:string]: string}):string=>{
  Object.entries(data).forEach(([k,v])=>{
    if (!template.includes(`{${k}}`)) throw new Error(`Placeholder {${k}} not found in template`)
    template = template.replaceAll(`{${k}}`, v)
  })
  return template
}

let display_module = (name:string)=>{

  current_module.set(name)
  let module = get_module(name)
  let mod = module.get()!
  let save = ()=>module.set(mod)

  // let update = (f:(m:Module)=>Module)=>{module.set(f(module.get()!))}
  const Instructions = string_editor(mod.prompt, s=>{
    mod.prompt = s
    save()
  })

  const Structure = taxonomy_editor(module.get()!.taxonomy, (t)=>{
    mod.taxonomy = t
    save()
  })



  let resdiv = pre()
  
  const Agent =div(
    p(model_picker),
    mod.extraction
    ? div("TODO")
    : button("start extraction", {onclick:()=>{
      let schema = taxSchema(mod.taxonomy)
      if (mod.prompt == "") return alert("Prompt cannot be empty")
      if (Object.keys(mod.source).length == 0) return alert("At least one document is required")
      if (mod.taxonomy.children.length == 0) return alert("Taxonomy must have at least one field")
      if (!mod.prompt.includes("{DOCUMENT}")) return alert("Prompt must include {DOCUMENT} placeholder")

      let prompt = format(mod.prompt, {
        DOCUMENT: Object.entries(mod.source).filter(([key, value])=>value.type == "txt").map(([key, value])=>key+":\n"+value.content).join("\n\n"),
      })

      request(prompt, model.get()!, {
        name:"respond",
        description:"respond with extracted items",
        argname: "items",
        argschema: schema
      }, 0).then(r=>{
        resdiv.textContent = JSON.stringify(r, null, 2)
      })
      }
    }),
    resdiv
  )



  let docs = div()
  
  const Documents = div(docs)
  {
    let showdoc = (title:string)=>{
      let s = mod.source[title]
      if (s==undefined) throw new Error("no doc of title: "+ title)
      let de = p(
        button("-",{onclick:()=>{
          delete mod.source[title]
          save()
          de.remove()
        }}),
        string_editor(title, t=>{
          mod.source[t] = s
          delete mod.source[title]
          save()
        }, span, {fontWeight:"bold", fontSize:"1.1em", cursor:"pointer"}),
        p(s.type == "txt"? string_editor(s.content,c=>{ 
          s.content = c
          save()

        }, p, {
          whiteSpace:"pre",
        }) : "PDF"))
      docs.append(de)
    }

    Object.keys(mod.source).forEach(showdoc)
    Documents.append(p("+add", { style:{cursor:"pointer"}, onclick:()=>{
      let name = 'new doc'
      let ctr = 0
      while (name in mod.source) {name = 'new doc ' + ctr ++ }
      mod.source[name] = {type:'txt', content:'<content>'}
      save()
      showdoc(name)
    }}))

  }


  const sections : {[key:string]: HTMLElement} = {
    Instructions,
    Structure,
    Documents,
    Agent,
  }

  let defaultSection = Agent

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
  renderSideBar("Agent")


  page.replaceChildren(
    h3( span("module: ",name, { style:{fontWeight:"bold" }, onclick: ()=> {pick_module()}}),
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
