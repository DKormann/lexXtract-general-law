
import { db } from "../src/app";
import { Stored } from "../src/helpers";
import { chat, type Message, request } from "../src/request";
import { Schema, type JsonData } from "../src/struct";
import { fillSchema, localDB, TaxonomySchema } from "../src/struct";
import type { Module, Taxonomy } from "../src/types";
import { background, body, border, button, color, div, h2, h3, height, input, margin, p, padding, popup, pre, span, style, textarea, type HTMLArg } from "./html";
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


type Model = string

const models = Stored<Model[]>("models", [
  "openai/gpt-oss-120b",
  "anthropic/claude-opus-4.5",
])


let titlebar = h2("lexxtract")

let module_list = db.get("modules", Schema.array(Schema.string))
let header = div(
  titlebar,
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

body.append(header,
  page
)

let current_module = db.get("current_module", Schema.string)

current_module.get().then(m=>{
  if (m) show_module(m as string)
})

current_module.onupdate(async ()=>{
  let mod = await current_module.get()
  if (mod) show_module(mod as string)
})


const show_module = (mod:string) => {

  let mod_db = <T extends JsonData> (key:string, schema:Schema) => db.get<T>(mod+":"+key, schema)

  let taxonomy = mod_db("taxonomy", TaxonomySchema)
  const Taxonomy = viewer(taxonomy)

  let documents = mod_db("documents", Schema.record(Schema.string))
  const Documents = div(viewer(documents), button("+add", {
    onclick:()=>{
      documents.get().then((docs)=>{
        let title = prompt("doc title")
        if (title) documents.set({...docs as {[key:string]:JsonData}, [title] : ""})
      })
    }
  }))

  let prompt_ = mod_db("prompt", Schema.string)
  const Prompt = viewer(prompt_)




  const Agent = div()

  {
    let model = mod_db<string>("model", Schema.string)
    let model_picker = div()
    let setmodel = (m:string)=>{
      model_picker.replaceChildren("Model: ", button(m || "none", {onclick:()=>{
        let mkpop = ()=>popup(
          h2("choose a model"),
          models.get()!.map(m=>
          p(
            mkbutton(m, ()=> {
              model.set(m);
              pop.remove()
            })
          )),
          button("+add", {onclick:()=>{
            let name = prompt("choose model")
            if (!name)return 
            models.set([...models.get()!, name])
            model.set(name)
            pop.remove()
          }})
        )
        let pop = mkpop()
      }}))
    };
    setmodel(models.get()![0]!)
    model.get().then(setmodel)
    model.onupdate(()=>model.get().then(setmodel))


    let msgs = mod_db<Message[]>("agent_msgs", Schema.array(Schema.object({
      role: Schema.string,
      content: Schema.string
    }, ['role', 'content'])))

    let msgs_view = div()

    let show_msgs = ()=>{
      msgs.get().then(m=>{
        msgs_view.replaceChildren(...(m as {role:string, content:string}[]).map(msg=>
          div(
            style({
              padding:".2em",
              width:"fit-content",
              fontWeight: msg.role == "user" ? "bold" : "normal",
              paddingLeft: msg.role == "user" ? "0" : "1em",
            }),
            msg.content
          )
        ))
      })
    }

    show_msgs()
    msgs.onupdate(show_msgs)

    let intake = input({placeholder:"message",
      style:{
        width:"40vw",
        position: "absolute",
        bottom:"1em",
      },
      onkeydown: e=>{
        if (e.key == "Enter"){
          msgs.get().then(m=>{
            let nm:Message[] = [...m, {role:"user", content: intake.value}]
            msgs.set(nm)
            .then(()=>{
              intake.value = ""
              model.get().then(mod=>{
                chat(nm, mod)
                .then(res=>{
                  msgs.set([...nm, res])
                })
              })
            })
          })
        }
      }
    })
    Agent.append(
      model_picker,
      msgs_view,
      intake
    )
  }

  
  const sections : {[key:string]: HTMLElement} = {
    Taxonomy,
    Documents,
    Prompt,
    Agent
  }

  let defaultSection = "Agent"

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
      height:"80vh",
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


  titlebar.textContent = "lexxtract : " + mod

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
