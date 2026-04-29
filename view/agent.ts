import { LocalStored } from "../model/helpers";
import { chat, type ModelMessage, type ModelTool } from "../controller/request";
import { stringify, type JsonData } from "../model/json";
import type { Module } from "../model/types";
import { mkRunner } from "../controller/agent_functions";
import { button, color, div, errorpopup, h2, input, p, popup, pre, style, textarea } from "./html";
import { jsonView, viewer } from "./viewer";
import { format, type Pattern } from "../model/pattern";


type Tool = ModelTool & {runner: (args:JsonData)=>Promise<JsonData>}

type Message = {role: "user" | "assistant" | "system", content: string}
| {type: "function_call", id: string, call_id: string, name:string, arguments: string}
| {type: "function_call_output", call_id: string, output: string}

export const Message: Pattern = [
  {
    role: ["system", "user", "assistant"],
    content: String
  },
  {
    type: "function_call",
    id: String,
    call_id: String,
    name: String,
    arguments: String
  },
  {
    type: "function_call_output",
    call_id: String,
    output: String
  }
]



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


export let cost_tracker = LocalStored<{total:string}>("cost_tracker", {total: String})

const load_messages = async(module:Module) => {

  let msg_display = div(style({marginBottom:"3em"}))

  let show_msg = (m:ModelMessage) =>{
    let role = "role" in m ? m.role : "system"
    let content = "content" in m ? m.content : "name" in m ? `[function call: ${m.name}]` : `[function output: ${m.output.slice(0,100)}]`
    let el = pre(
      {onclick:()=>{
        let pop = popup(
          h2("message content"),
          jsonView(m)
        )
      }},
      style({
        width:"fit-content",
        fontWeight: role == "user" ? "bold" : "normal",
        fontStyle: role == "system" ? "italic" : "none",
        padding: ".2em",
        margin: "0",
        paddingLeft: role == "user" ? "0" : "1em",
        textWrap: "wrap",
      }),
      content,
    )
    return el
  }


  let msgcount = await module.db<number>("msgcount", Number)

  let getmsg = async (id:number) => await module.db<ModelMessage>(`message_${id}`, Message)
  let add = async (msg:ModelMessage) => {
    let el = show_msg(msg)
    msg_display.append(el)
    let c =  msgcount.get() || 0
    let mm = await getmsg(c)
    mm.onupdate(async ()=>{
      let newel = show_msg((await mm).get())
      el.replaceWith(newel)
      el = newel
    })
    await Promise.all([
      mm.set(msg),
      msgcount.set(c+1)
    ])
    return mm
  }
  let reset = async ()=> {
    msgcount.set(0)
    msg_display.replaceChildren()
  }

  let get = async ()=>{return Promise.all(Array.from({length: msgcount.get() || 0}, async (_,i)=>(await getmsg(i)).get()))}

  get().then(msgs=>{
    msgs.forEach(m=>{
      let el = show_msg(m)
      msg_display.append(el)
    })
  })

  return {add, get, reset, el: msg_display}


}

export const mkAgent = async (module:Module)=>{


  let models = LocalStored<string[]>("models", [String], [
    "openai/gpt-oss-120b",
    "anthropic/claude-opus-4.5",
    "moonshotai/kimi-k2.5",
  ])


  let model = await module.db<string>("current_model", String)

  let agent_msgs = await load_messages(module)
  let model_picker = div(style({
    position:"fixed",
    background: color.background,
    padding:"0.5em",
    borderRadius:".3em",
    top:"5em",
  }))

  let reset_chat = async () => {
    await agent_msgs.reset()
    await agent_msgs.add({role:"system", content: await module.prompt.get() || ""})
  }
  
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
      button("reset chat", {onclick:reset_chat,}),
      button("prompt settings", {onclick:async ()=>{

        let ta = textarea()
        ta.cols = 40;
        ta.rows = 10;
        ta.value = await module.prompt.get() || ""
        let pop = popup(
          h2("prompt settings"),
          ta,
          button("save", {
            onclick:()=>{
              module.prompt.set(ta.value)
            }
          })
        )
      }})
    )
  };

  setmodel(model.get() || models.get()[0]!)
  model.onupdate(()=>setmodel(model.get()))

  let possibleTools:Tool[] = await (Object.entries(module.functions.get()).map(([name,v])=>{
    let tool:Tool = 
    {
      type: "function",
      name,
      description: v.description || "",
      parameters: {type: "object", properties: v.parameters, required: Object.keys(v.parameters)},
      runner: mkRunner(module, v) as (args:JsonData)=>Promise<JsonData>
    }
    return tool
  }))

  let runtool = async (name:string, args: string): Promise<JsonData>=>{
    console.log("Running tool", name, "with args", args)
    let tool = possibleTools.find(t=>t.name == name)
    if (!tool) return {error: "tool not found: "+name}
    try{
      let parsedArgs = JSON.parse(args)
      let res=await tool.runner(parsedArgs)
      console.log("Tool output", res)
      return res
    }catch(e){
      console.error("Error running tool", e)
      return {error: String(e)}
    }
  }

  const handle_reponse = (r:{messages:ModelMessage[], cost:number})=>{
  }

  let runagent = (nm:ModelMessage[])=>{
    intake.value = ""
    // model.get().then(mod=>{
      let hint = pre("...")
      chat(nm, model.get(), possibleTools)
      .then(async r=>{
        hint.remove()
        console.log("Model response", r)
        let proms: Promise<void>[] = [];
        let outputs = new Map<string, (m:ModelMessage)=>void>();
        for (let msg of r.messages){
          let s = await agent_msgs.add(msg)
          if ("type" in msg && msg.type == "function_call_output"){
            outputs.set(msg.call_id, s.set)
          }
        }
        for (let msg of r.messages){
          if ("type" in msg && msg.type == "function_call"){
            let p = runtool(msg.name, msg.arguments).then(out=>{
              let outmsg: ModelMessage = {type: "function_call_output", call_id: msg.call_id, output: stringify(out)}
              if (outputs.has(msg.call_id)){
                outputs.get(msg.call_id)!(outmsg)
              }else{
                agent_msgs.add(outmsg)
              }
            })
            proms.push(p)
          }
        }
        await Promise.all(proms)
        if (proms.length > 0) agent_msgs.get().then(runagent)
      })
    // })
  }


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
        agent_msgs.add({role:"user", content: intake.value}).then(s=>{
          agent_msgs.get().then(runagent)
        })
      }
    }
  })

  let res = div(
    model_picker,
    agent_msgs.el,
    intake
)

  return res;

}
