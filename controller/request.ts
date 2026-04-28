
import { LocalStored } from "../model/helpers";
import { parse, stringify, type JsonData, type JSONSchema } from "../model/struct";


type ModelResponse = {
  usage: { cost: number };
  output:
    ( { type: "function_call"; id: string, call_id:string, name: string; arguments: string }
    | { type: "reasoning"; content: unknown }
    | { type: "message"; content: {type:"output_text", text:string} []})[];
};

export type ModelTool = 
{
  type: "function",
  name: string;
  description: string;
  parameters: JSONSchema;
}


export type ModelMessage = {role: "user" | "assistant" | "system", content: string}
| {type: "function_call", id: string, call_id: string, name:string, arguments: string}
| {type: "function_call_output", call_id: string, output: string}



export const localApiKey = LocalStored<string>("openrouter_api_key", String, "")

function getApiKey(): string {
  let key = localApiKey.get()
  if (!key) {
    localApiKey.set(prompt("provide openrouter key") || "")
    key = localApiKey.get()
  }
  if (!key) throw new Error("Missing OpenRouter API key")
  return key
}


export const chat = async (input: ModelMessage[], model: string, tools:ModelTool[]): Promise<{messages:ModelMessage[], cost:number}> =>{

  let body = stringify({model, input, tools}) 
  console.log("Sending request to model with body", body)

  let response = await fetch("https://openrouter.ai/api/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body
  })
  .catch(e=>{
    console.error(e.message)
    throw(e)
  })

  if (!response.ok) {
    let errorText = await response.text()
    console.error(parse(errorText))
    // errorpopup(`API Error: Status: ${response.status}\nResponse: ${errorText}`)
    throw new Error(`API Error: Status: ${response.status}\nResponse: ${errorText}`)
  }

  let data: ModelResponse = await response.json()

  console.log("Model response", data)

  return {
    messages: data.output.map(items=>{
      let ret : ModelMessage | ModelMessage[] = 
        items.type == "message" ? {role: "assistant", content: items.content.map(c=>c.text).join("\n")} :
        items.type == "function_call" ? [
          {type: "function_call", id: items.id, call_id: items.call_id, name: items.name, arguments: items.arguments},
          {type: "function_call_output", call_id: items.call_id, output: ""}
        ] :[]
      
      return ret
    }).flat(),
    cost: data.usage.cost
  }
}
