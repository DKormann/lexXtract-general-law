import { errorpopup } from "../web/html";
import { LocalStored } from "./helpers";
import { Schema } from "./struct";
import { Message } from "../web/agent";

export type Tool = {
  name: string;
  description: string;
  parameters: Schema;
};

type ModelResponse = {
  usage: { cost: number };
  output:
    ({ type: "function_call"; name: string; arguments: string }
    | { type: "reasoning"; content: unknown }
    | { type: "message"; content: {type:"output_text", text:string} []})[];
};


export const localApiKey = LocalStored<string>("openrouter_api_key", Schema.string, "")

function getApiKey(): string {
  let key = localApiKey.get()
  if (!key) {
    localApiKey.set(prompt("provide openrouter key") || "")
    key = localApiKey.get()
  }
  if (!key) throw new Error("Missing OpenRouter API key")
  return key
}

function cacheKey(parts: unknown[]): string {
  return JSON.stringify(parts);
}

export async function request(promptText: string, model: string, tool: Tool, seed: number) {


  const response = await fetch("https://openrouter.ai/api/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      input: promptText,
      reasoning: { effort: "low" },
      tools: [
        {
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      ],
      tool_choice: { type: "function", name: tool.name },
    }),
  });

  const data = (await response.json()) as ModelResponse;
  const functionCall = data.output.find((item) => item.type === "function_call");
  if (!functionCall) {
    throw new Error("Model response did not include a function call");
  }

  const result = {
    cost: data.usage.cost,
    output: JSON.parse(functionCall.arguments),
  };

  return result;
}

export async function chat(history: Message[], model: string, tools: Tool[] = []):Promise<Message[]>{

  const response = await fetch("https://openrouter.ai/api/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      input: history.map(m=>({role:m.role, content:m.content})),
      reasoning: { effort: "low" },
      tools: tools.map(tool=>({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    }),
  })


  if (response.status != 200){
    throw new Error("Model request failed with status " + response.status + ". maybe you need to provide an API key in the settings?")
  }

  const data = (await response.json()) as ModelResponse;
  console.log("Model response:", data);

  console.log("Full model response:", data);

  let resp: Message[] = data.output.map(item=>{
    if (item.type == "message" && item.content[0]?.type == "output_text"){
      return {role:"assistant", content: item.content[0].text} as Message
    }
    if (item.type == "function_call"){
      console.log("Function call in model response:", item)
      // return {role:"assistant", content:"", toolcall:{tool: item.name, args: JSON.parse(item.arguments)}} as Message
      let fname = item.name
      let args = JSON.parse(item.arguments)
      return {role:"assistant", content:"", toolcall:{tool: fname, args}} as Message
    }
  })
  .filter(x=>x != undefined)

  return resp


}