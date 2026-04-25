
import { FunctionSchema, mkFunctions } from "./agent_functions";
import { db  } from "../src/app";
import { randUser, type Stored } from "../src/db";
import { hash } from "../src/hash";
import { LocalStored } from "../src/helpers";
import { chat, localApiKey } from "../src/request";
import { Schema, SchemaSchema, Taxonomy2Schema, type JsonData } from "../src/struct";
import { fillSchema, TaxonomySchema, type Taxonomy} from "../src/struct";
import type { Module } from "../src/types";
import { background, body, border, button, color, div, errorpopup, h2, h3, height, input, margin, p, padding, popup, pre, span, style, table, td, textarea, tr, type HTMLArg } from "./html";
import { viewer } from "./viewer";
import { cost_tracker, mkAgent } from "./agent";

let locstring = location.href.split("?")[0] || ""

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
  
  const show_module = async (mod:ModPath) => {



    module_list.get().then(mods=>{if (!mods.map(x=>JSON.stringify(x)).includes(JSON.stringify(mod))) module_list.set([...mods, mod])})
    let modState: Stored<any>[] = []

    let mod_db = <T extends JsonData> (key:string, schema:Schema) => {
      let st = db.get<T>(mod.name+":"+key, schema, mod.owner)
      if (mod.owner != db.userid) st.set = async (val:T)=>{
        let pop = popup(
          h2(`You cannot edit this module`),
          p(`it is owned by ${mod.owner}`),
          p('do you need to make a copy of this module to edit?'),
          button(`copy ${mod.name}`, {onclick: async ()=>{
            await Promise.all(modState.map(s=>s.get().then(d=>db.get(s.key, s.schema, db.userid).set(d).then(()=>{console.log("copied", s.key, d)}))))
            await current_module.set({name:mod.name, owner: db.userid})
          }})
        )
      }
      modState.push(st as any as Stored<JsonData>)
      return st
    }

    const taxonomy = mod_db<Taxonomy>("taxonomy", TaxonomySchema)

    taxonomy.onupdate(()=>{
      show_module(mod)
    })
    const extraction = mod_db<JsonData>("extraction", await taxonomy.get().then(Taxonomy2Schema))

    let module: Module = {
      db: mod_db,
      functions: mod_db("functions", Schema.record(FunctionSchema)),
      taxonomy,
      extraction,
      documents: mod_db<{[key:string]: string}>("documents", Schema.record(Schema.string)),
      prompt: mod_db<string>("prompt", Schema.string)
    }


    const Taxonomy = viewer(taxonomy)

    const Documents = div(viewer(module.documents), button("+add", {
      onclick:()=>{
        module.documents.get().then((docs)=>{
          let title = prompt("doc title")
          if (title) module.documents.set({...docs as {[key:string]:string}, [title] : ""})
        })
      }
    }))
  
    const Prompt = viewer(module.prompt)

  
    let Functions = await mkFunctions(module)
    let Agent = await mkAgent(module)
  
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
          ),
        ),
        p("usage:", cost_tracker.get().total)
      ))
    }
    mksettings()

    
    const sections : {[key:string]: HTMLElement} = {
      Taxonomy,
      Documents,
      Extract: viewer(module.extraction),
      Agent,
      Functions,
      Settings,
    }
  
    let defaultSection = LocalStored<string>("default_section", Schema.string, "Agent")
  
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
    let renderSideBar = (item:string) =>{
      defaultSection.set(item)
      return sidebar.replaceChildren(div(

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
    ))}
    if (defaultSection.get() in sections) renderSideBar(defaultSection.get()!)
  
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

