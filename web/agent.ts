import { LocalStored } from "../src/helpers";
import { chat, type ModelMessage, type ModelTool } from "../src/request";
import { Schema, schemaType, stringify, validate, type JsonData } from "../src/struct";
import type { Module } from "../src/types";
import { mkRunner } from "./agent_functions";
import { button, color, div, errorpopup, h2, input, p, popup, pre, style } from "./html";
import { jsonView, viewer } from "./viewer";


type Tool = ModelTool & {runner: (args:JsonData)=>Promise<JsonData>}



type Message = {role: "user" | "assistant" | "system", content: string}
| {type: "function_call", id: string, call_id: string, name:string, arguments: string}
| {type: "function_call_output", call_id: string, output: string}

export const Message = Schema.from([
  {
    role: ["system", "user", "assistant"],
    content: Schema.string
  },
  {
    _type: "function_call",
    id: String,
    call_id: String,
    name: String,
    arguments: String
  },
  {
    _type: "function_call_output",
    call_id: String,
    output: String
  }
])

console.log(stringify(Message))


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


export let cost_tracker = LocalStored<{total:string}>("cost_tracker", Schema.object({total: Schema.string}))




export const mkAgent = async (module:Module)=>{

  let models = LocalStored<string[]>("models", Schema.array(Schema.string), [
    "openai/gpt-oss-120b",
    "anthropic/claude-opus-4.5",
    "moonshotai/kimi-k2.5",
  ])


  let model = module.db<string>("current_model", Schema.string)

  let agent_msgs = module.db<ModelMessage[]>("agent_msgs", Schema.array(Message))
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
          let msg = await module.prompt.get()
          agent_msgs.set([{role:"system", content:msg}])
          console.log(await agent_msgs.get())
        }
      })
    )
  };
  setmodel(models.get()![0]!)
  model.get().then(setmodel)
  model.onupdate(()=>model.get().then(setmodel))

  let msgs_view = div(style({marginBottom:"3em"}))

  let show_msgs = ()=>{
    agent_msgs.get().then(m=>{
      console.log("Updating messages view with", m)
      msgs_view.replaceChildren(...(m).map((msg:ModelMessage)=>{
        let role = "role" in msg ? msg.role : msg.type;
        let content = "content" in msg ? msg.content : "name" in msg ? `[function call: ${msg.name}]` : `[function output: ${msg.output}]`
        return pre(
          {onclick:()=>{
            let pop = popup(
              h2("message content"),
              jsonView(msg)
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
      }
      ))
    })
  }

  show_msgs()
  agent_msgs.onupdate(show_msgs)

  let possibleTools:Tool[] = await module.functions.get().then(fs=>Object.entries(fs).map(([name,v])=>{
    let tool:Tool = 
    {
      type: "function",
      name,
      description: v.description || "",
      parameters: Schema.object(v.parameters),
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

  // let cost_tracker = module.db<{total:number}>("cost_tracker", Schema.object({total: Schema.number}), {total:0})



  let runagent = (nm:ModelMessage[])=>{
    intake.value = ""
    model.get().then(mod=>{
      let hint = pre("...")
      msgs_view.append(hint)
      chat(nm, mod, possibleTools)
      .then(async r=>{
        hint.remove()
        console.log("Model response", r)
        
        await agent_msgs.update(ms=>[...ms, ...r.messages])

        cost_tracker.set({total: String(Number(cost_tracker.get()!.total || "0") + r.cost)})
        
        let proms = r.messages.map(msg=>{
          if ("type" in msg && msg.type == "function_call"){
            return runtool(msg.name, msg.arguments).then(out=>
              agent_msgs.update(ms=>ms.map(mm=>{
                console.log("Checking message for update", stringify(mm))
                if ("type" in mm && mm. type == "function_call_output" && mm.call_id == msg.call_id){
                  return {...mm, output: JSON.stringify(out)}
                }
                return mm
              }))
            )
          }
        })
        await Promise.all(proms)
        if (proms.some(p=>p!=undefined)) agent_msgs.get().then(runagent)
        
      })
    })
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
        agent_msgs.get().then(m=>{
          let nm = m.concat({role:"user", content: intake.value})
          agent_msgs.set(nm).then(()=>runagent(nm))
        })
      }
    }
  })

  let res = div(
    model_picker,
    msgs_view,
    intake
)

  return res;

}

