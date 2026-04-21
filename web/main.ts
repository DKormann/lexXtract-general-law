
import { db  } from "../src/app";
import { LocalStored } from "../src/helpers";
import { chat, localApiKey, type Message, request } from "../src/request";
import { Schema, type JsonData } from "../src/struct";
import { fillSchema, TaxonomySchema } from "../src/struct";
import { background, body, border, button, color, div, errorpopup, h2, h3, height, input, margin, p, padding, popup, pre, span, style, table, td, textarea, tr, type HTMLArg } from "./html";
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

const models = LocalStored<Model[]>("models", [
  "openai/gpt-oss-120b",
  "anthropic/claude-opus-4.5",
])


let titlebar = h2("lexxtract")

let module_list = db.get<ModPath[]>("modules", Schema.array(Schema.string))

let header = div(
  titlebar,
  button("+add module", {onclick:()=>{
    let name = prompt("Module name")
    if (!name) return
    module_list.get().then(mods=>{
      module_list.set([...mods, {name, owner: db.userid}])
      current_module.set({name, owner: db.userid})
    })
  }}),
  button("pick module", {
  onclick:async ()=>{

    let mods = await module_list.get()
    let pop = popup(
      h3("choose a module"),
      mods.map(m=>{
        return p(button(m.owner,"/", m.name, {onclick:()=>{
          console.log("Selected module", m)
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


type ModPath = {
  owner: string,
  name: string
}

let current_module = db.get<ModPath>("current_module", Schema.object({owner: Schema.string, name: Schema.string}, ["owner", "name"]))


current_module.get().then(m=>{
  show_module(m)
})

current_module.onupdate(async ()=>{
  console.log("Module updated")
  let mod = await current_module.get()
  if (mod) show_module(mod)
})


const show_module = (mod:ModPath) => {

  let mod_db = <T extends JsonData> (key:string, schema:Schema) => db.get<T>(mod.name+":"+key, schema)

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

  let prompt_ = mod_db<string>("prompt", Schema.string)
  const Prompt = viewer(prompt_)


  const Agent = div()
  {
    let model = mod_db<string>("model", Schema.string)
    let model_picker = div(style({
      position:"fixed",
      background: color.background,
      padding:"0.5em",
      borderRadius:".3em",
      top:"5em",
    }))
    
    let setmodel = (m:string)=>{
      model_picker.replaceChildren("Model: ",
        button(m || "none", {onclick:()=>{
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
        }}),
        button("reset chat", {
          onclick:async ()=>{
            let msg = await prompt_.get()
            msgs.set([{role:"system", content:msg}])
            console.log(await msgs.get())
          }
        })
      )
    };
    setmodel(models.get()![0]!)
    model.get().then(setmodel)
    model.onupdate(()=>model.get().then(setmodel))


    let msgs = mod_db<Message[]>("agent_msgs", Schema.array(Schema.object({
      role: Schema.string,
      content: Schema.string
    }, ['role', 'content'])))

    let msgs_view = div(style({marginBottom:"3em"}))

    let show_msgs = ()=>{
      msgs.get().then(m=>{
        msgs_view.replaceChildren(...(m as {role:string, content:string}[]).map(msg=>

          pre(
            style({
              width:"fit-content",
              fontWeight: msg.role == "user" ? "bold" : "normal",
              fontStyle: msg.role == "system" ? "italic" : "none",
              padding: ".2em",
              margin: "0",
              paddingLeft: msg.role == "user" ? "0" : "1em",
              textWrap: "wrap",
            }),
            msg.content,
          )
        ))
      })
    }

    show_msgs()
    msgs.onupdate(show_msgs)

    let intake = input({placeholder:"message",
      style:{
        width:"40vw",
        position: "fixed",
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

  let Settings =div()
  let mksettings =()=> {

    let pwd = input({type:"password", placeholder:"new password"})
    let apikey = input({ type:"password", placeholder:"new API key"})
    
    Settings.replaceChildren (div(
      table(
        style({borderSpacing: "0.5em",}),
        tr(
          td("user id: "),
          td(db.userid ?? "<none>"),
          td(
            button("logout", {onclick:()=>{db.logout();mksettings()}}),
            button("switch account", {onclick:()=>{
            let userid = input({placeholder:"user id"})
            let pwd = input({type:"password", placeholder:"password"})
            let pop = popup(
              h3("switch account"),
              table(
                style({borderSpacing: "0.5em",}),
                tr(td("user id: "),td(userid),),
                tr(td("password: "),td(pwd),),
                tr(td(),td(button("login", {onclick:()=>{
                  db.signup(userid.value,pwd.value).catch(errorpopup)
                  pop.remove()
                  mksettings()
                }}))),
              )
            )
          }}))
        ),
        tr(
          td("Add API Key: "),
          td(apikey),
          td(button("set", {onclick:()=>{localApiKey.set(apikey.value); apikey.value = ""}}))
        ),
        tr(
          td("Change Password: "),
          td(pwd),
          td(button("set", {onclick:()=>{
            db.changePassword(pwd.value).then(()=>{
              alert("password updated.")
              pwd.value = ''
            })
          }}))
        )
      )
    ))
  }
  mksettings()

  
  const sections : {[key:string]: HTMLElement} = {
    Taxonomy,
    Documents,
    Prompt,
    Agent,
    Settings,
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

  titlebar.textContent = "lexxtract : " + mod.owner + " / " + (mod.name || "unnamed module")

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
