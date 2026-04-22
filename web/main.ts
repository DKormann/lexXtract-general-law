
import { db  } from "../src/app";
import { randUser, type Stored } from "../src/db";
import { hash } from "../src/hash";
import { LocalStored } from "../src/helpers";
import { chat, localApiKey, type Message, request } from "../src/request";
import { Schema, SchemaSchema, type JsonData } from "../src/struct";
import { fillSchema, TaxonomySchema } from "../src/struct";
import { background, body, border, button, color, div, errorpopup, h2, h3, height, input, margin, p, padding, popup, pre, span, style, table, td, textarea, tr, type HTMLArg } from "./html";
import { viewer } from "./viewer";

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

let locstring = location.href.split("?")[0] || ""


type Model = string

const models = LocalStored<Model[]>("models", Schema.array(Schema.string), [
  "openai/gpt-oss-120b",
  "anthropic/claude-opus-4.5",
])


export type ModPath = {
  owner: string,
  name: string
}

export const ModPath:Schema = Schema.object({
  owner: Schema.string,
  name: Schema.string,
}, ["owner", "name"])

let urlrequest:ModPath | null = null

location.search.split("&").forEach(param=>{
  if (param.startsWith("?")) param = param.slice(1)
  console.log("URL param", param)
  let [key, value] = param.split("=")
  if (key == "module" && value){
    try {
      urlrequest = JSON.parse(decodeURIComponent(value)) as ModPath;
      location.search = ""
    }
    catch(e) {console.error("Failed to parse module from URL", e)}
  }
})


let accountsettings = {
  changePassword : db.changePassword,
  signup : (args:{userid:string, passhash:string})=>db.signup(args).then(loadUser),
  getItem: (key:string, schema:Schema, owner?:string)=>{
    owner ||= db.userid
    return db.get(key, schema, owner)
  }
}

let loadUser = ()=>{

  let module_list = db.get<ModPath[]>("modules", Schema.array(ModPath))
  let current_module = db.get<ModPath>("current_module", ModPath)

  if (urlrequest) current_module.set(urlrequest)
  
  const show_module = (mod:ModPath) => {
    module_list.get().then(mods=>{if (!mods.map(x=>JSON.stringify(x)).includes(JSON.stringify(mod))) module_list.set([...mods, mod])})

    
    let mod_db = <T extends JsonData> (key:string, schema:Schema) => {
      let st = db.get<T>(mod.name+":"+key, schema, mod.owner)
      if (mod.owner != db.userid) st.set = async (val:T)=>{
        let pop = popup(
          h2(`You cannot edit this module`),
          p(`it is owned by ${mod.owner}`),
          p('do you need to make a copy of this module to edit?'),
          button(`copy ${mod.name}`, {onclick: async ()=>{
            await Promise.all(Object.values(modState).map(s=>s.get().then(d=>db.get(s.key, s.schema, db.userid).set(d).then(()=>{
              console.log("copied", s.key, d)
            }))))

            await current_module.set({name:mod.name, owner: db.userid})
          }})
        )
      }
      return st
    }

    let modState = {
      taxonomy: mod_db("taxonomy", TaxonomySchema),
      documents: mod_db("documents", Schema.record(Schema.string)),
      prompt: mod_db<string>("prompt", Schema.string),
      agent_msgs: mod_db<Message[]>("agent_msgs", Schema.array(Schema.object({
        role: Schema.string,
        content: Schema.string
      }, ['role', 'content']))),
      model: mod_db<string>("model/provider", Schema.string)
    };


    const Taxonomy = viewer(modState.taxonomy)
  
    const Documents = div(viewer(modState.documents), button("+add", {
      onclick:()=>{
        modState.documents.get().then((docs)=>{
          let title = prompt("doc title")
          if (title) modState.documents.set({...docs as {[key:string]:JsonData}, [title] : ""})
        })
      }
    }))
  
    const Prompt = viewer(modState.prompt)

  
    const Agent = div()
    {
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
                  modState.model.set(m);
                  pop.remove()
                })
              )),
              button("+add", {onclick:()=>{
                let name = prompt("choose model")
                if (!name)return 
                models.set([...models.get()!, name])
                modState.model.set(name)
                pop.remove()
              }})
            )
            let pop = mkpop()
          }}),
          button("reset chat", {
            onclick:async ()=>{
              let msg = await modState.prompt.get()
              modState.agent_msgs.set([{role:"system", content:msg}])
              console.log(await modState.agent_msgs.get())
            }
          })
        )
      };
      setmodel(models.get()![0]!)
      modState.model.get().then(setmodel)
      modState.model.onupdate(()=>modState.model.get().then(setmodel))
  
      let msgs_view = div(style({marginBottom:"3em"}))
  
      let show_msgs = ()=>{
        modState.agent_msgs.get().then(m=>{
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
      modState.agent_msgs.onupdate(show_msgs)
  
      let intake = input({placeholder:"message",
        style:{
          width:"40vw",
          position: "fixed",
          bottom:"1em",
          fontSize:"1.1em",
          padding:"0.5em 1em",
          borderRadius:".4em",
          border:`4px solid ${color.gray}`,
          background: color.lightgray,
          color: color.color,
        },
        onkeydown: e=>{
          if (e.key == "Enter"){
            modState.agent_msgs.get().then(m=>{
              let nm:Message[] = [...m, {role:"user", content: intake.value}]
              modState.agent_msgs.set(nm)
              .then(()=>{
                intake.value = ""
                modState.model.get().then(mod=>{
                  let hint = pre("...")
                  msgs_view.append(hint)
                  chat(nm, mod).then(res=>{
                    hint.remove()
                    modState.agent_msgs.set([...nm, res])
                  }).catch(e=>{
                    hint.remove()
                    errorpopup(e)
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
              button("logout", {onclick:()=>accountsettings.signup(randUser())}),
              button("switch account", {
                style:{marginLeft:"0.5em"},
                onclick:()=>{
                  let userid = input({placeholder:"user id"})
                  let pwd = input({type:"password", placeholder:"password"})
                  let pop = popup(
                    h3("switch account"),
                    table(
                      style({borderSpacing: "0.5em",}),
                      tr(td("user id: "),td(userid),),
                      tr(td("password: "),td(pwd),),
                      tr(td(),td(button("login", {onclick:()=>{accountsettings.signup({userid: userid.value, passhash: hash(pwd.value)})}}))),
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
  
    let share = span("🔗share", {
      style:{
        cursor:"pointer",
        marginLeft:"1em",
        fontSize:"0.8em",
        color:color.gray,
        border:`1px solid ${color.gray}`,
        padding:"0.2em",
        borderRadius:".3em"
      },
      onclick:()=>{
        navigator.clipboard.writeText(locstring+"?module="+encodeURIComponent(JSON.stringify(mod)))
        share.textContent = "✅copied!"
        setTimeout(() => {share.textContent = "🔗share"}, 1000);
      }})
    
  
    body.replaceChildren(
      div(
        h2("lexxtract : " + (mod.owner == db.userid ? "" : mod.owner + " / ") + (mod.name || "unnamed module"),share),
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
              let pp =  p(
                  button('-', {onclick:()=>{
                    module_list.update(l=>l.filter(x=>JSON.stringify(x)!=JSON.stringify(m)))
                    pp.remove()
                  }}),
                  button(m.owner,"/", m.name, {onclick:()=>{
                  current_module.set(m)
                  pop.remove()
                }})
              )
              return pp
            })
          )
        }
      })),
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

  current_module.get().then(mod=>{show_module(mod)})
  current_module.onupdate(()=>current_module.get().then(mod=>{show_module(mod)}))

}

loadUser()

