import { LocalStored } from "../src/helpers";
import { chat, type Tool } from "../src/request";
import { Schema, type JsonData } from "../src/struct";
import type { Module } from "../src/types";
import { button, color, div, errorpopup, h2, input, p, popup, pre, style } from "./html";



export type Message = {
  role: "assistant" | "user" | "system",
  content: string
  toolcall?: {tool: string, args: JsonData}
}

export const Message = Schema.object({
  role: Schema.anyOf(Schema.const("assistant"), Schema.const("user"), Schema.const("system")),
  content: Schema.string,
  toolcall: Schema.object({
    tool: Schema.string,
    args: Schema.any
  }, ['tool', 'args'])
}, ["role", "content"])

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


export const mkAgent = async (module:Module)=>{

  let models = LocalStored<string[]>("models", Schema.array(Schema.string), [
    "openai/gpt-oss-120b",
    "anthropic/claude-opus-4.5",
  ])


  let model = module.db<string>("current_model", Schema.string)

  let agent_msgs = module.db<Message[]>("agent_msgs", Schema.array(Message))
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
      msgs_view.replaceChildren(...(m as Message[]).map(msg=>

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
          msg.toolcall ? "TOOLCALL: " +  msg.toolcall.tool + ": " + JSON.stringify(msg.toolcall.args) : [],
          // JSON.stringify(msg)
          
        )
      ))
    })
  }

  show_msgs()
  agent_msgs.onupdate(show_msgs)


  let possibleTools:Tool[] = await module.functions.get().then(fs=>Object.entries(fs).map(([name,v])=>{
    let tool:Tool = {
      name,
      description: v.description || "",
      parameters: Schema.object(v.parameters)
    } 
    return tool
  }))
  

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
          let nm:Message[] = [...m, {role:"user", content: intake.value}]
          agent_msgs.set(nm)
          .then(()=>{
            intake.value = ""
            model.get().then(mod=>{
              let hint = pre("...")
              msgs_view.append(hint)
              chat(nm, mod, possibleTools
              ).then(res=>{
                hint.remove()
                agent_msgs.set([...nm, ...res])
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

  let res = div(
    model_picker,
    msgs_view,
    intake
)

  return res;

}

