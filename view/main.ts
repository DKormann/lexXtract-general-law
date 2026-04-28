import { FunctionDefPattern, mkRunner } from "../controller/agent_functions";
import { createModule, db  } from "../controller/app";
import { randUser, type Stored } from "../model/db";
import { hash } from "../model/db";
import { LocalStored } from "../model/helpers";
import { chat, localApiKey } from "../controller/request";
import type { JsonData, JSONSchema, Taxonomy } from "../model/struct";
import { ModPath, type FunctionDef, type Module } from "../model/types";
import { background, body, button, color, div, errorpopup, h2, h3, height, input, margin, p, padding, popup, pre, span, style, table, td, textarea, tr, type HTMLArg } from "./html";
import { jsonView, viewer } from "./viewer";
import { cost_tracker, mkAgent } from "./agent";
import { fill, fromSchema, SchemaPattern, type Pattern } from "../model/pattern";

let locstring = location.href.split("?")[0] || ""


const objectMap = <T, U>(obj: {[key:string]: T}, fn: (t:T, k:string)=>U): {[key:string]: U} =>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k, fn(v, k)]))


let urlrequest:ModPath | null = null

location.search.split("&").forEach(param=>{
  if (param.startsWith("?")) param = param.slice(1)
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
  getItem: (key:string, pattern:Pattern, owner?:string)=>{
    owner ||= db.userid
    return db.get(key, pattern, owner)
  }
}


let loadUser = async ()=>{
  console.log("Loading user...")

  let module_list = await db.get<ModPath[]>("modules", [ModPath])
  console.log("Module list:", module_list.get())
  let current_module = await db.get<ModPath>("current_module", ModPath)
  console.log(current_module.get())

  if (urlrequest) current_module.set(urlrequest)
  
  const show_module = async (mod:ModPath) => {
    console.log("Loading module", mod)

    let module = await createModule(mod, show_module);

    const Taxonomy = viewer(module.taxonomy)

    module.taxonomy.onupdate(()=>{
      console.log("taxonomy updated", module.taxonomy.get())
    })


    const Documents = div(viewer(module.documents), button("+add", {
      onclick:()=>{
          let title = prompt("doc title")
          if (title) module.documents.set({...module.documents.get() , [title] : ""})
      }
    }))
  
  
    // let Functions = await mkFunctions(module)
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



    let Functions = viewer(module.functions, d=>{
      return div(Object.entries(d as {[key:string]: FunctionDef}).map(([k,v])=>
      {
        let details = div(style({
          paddingLeft: "1em",
        }))
        return div(
          h3(k,
            button("call", {
              onclick:()=>{

                let argsSchema = {type: "object", properties: v.parameters, required: Object.keys(v.parameters)} as JSONSchema
                let args = fill(fromSchema(argsSchema)) as {[par:string]: JsonData}
                
                let pop = popup(
                  h2("call "+ k),
                  v.description? p(v.description) : [],
                  h3("arguments"),
                  viewer({
                    get: ()=>args,
                    set: async (a:{[par:string]:JsonData})=>{args = a},
                    pattern: fromSchema(argsSchema)
                  }),
                  button("execute", {
                    onclick:async ()=>{
                      
                      try{
                        let res = await mkRunner(module, v)(args)
                        pop.remove()
                        if (res !== undefined) popup(
                          h2("result"),
                          jsonView(res)
                        )
                      }catch(e){
                        errorpopup(e as Error)
                      }
                    }
                  })
                )
              }
            }),
            button("details", {onclick:()=>{
              if (details.childElementCount == 0){
                details.append(viewer({
                  get: ()=>v,
                  set: async (a:FunctionDef)=>module.functions.update(fs=>({...fs, [k]: a})),
                  pattern: FunctionDefPattern
                }))
              }else{
                details.replaceChildren()
              }
            }})
          ),
          p(v.description || ""),
          details,
        )
      }
    ))
    })

    
    const sections : {[key:string]: HTMLElement} = {
      Taxonomy,
      Documents,
      Extract: viewer(module.extraction),
      Agent,
      Functions,
      Settings,
    }
  
    let defaultSection = LocalStored<string>("default_section", String, "Agent")
  
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
    
  
    let storedisplay = div(style({
      position: "fixed",
      background: color.gray,
      color: color.green
    }))
    setInterval(() => {
      if (db.saving!=0){
        storedisplay.style.display = "block"
        storedisplay.textContent = "saving "+db.saving+" items"
      }
    },100)
    body.replaceChildren(
      div(
        storedisplay,
        h2("lexxtract : " + (mod.owner == db.userid ? "" : mod.owner + " / ") + (mod.name || "unnamed module"),share),
        button("+add module", {onclick:()=>{
          let name = prompt("Module name")
          if (!name) return
          // module_list.get().then(mods=>{
            module_list.set([...module_list.get(), {name, owner: db.userid}])
            current_module.set({name, owner: db.userid})
          // })
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

  show_module(current_module.get())
  current_module.onupdate(()=>show_module(current_module.get()))
}

if (typeof window !== "undefined"){

  loadUser()
}

