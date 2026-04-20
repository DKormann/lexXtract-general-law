import { request } from "./request"
import type { Schema } from "./struct";

export const extraction = (article:string, item:Schema) =>{


  const prompt = `You are an expert Legal advisor. Please extract a list of datapoints of the type ${item.name}.
  
  ${article}
  
  Please extract the relevant Items following this Schema:
  
  ${item}
  
  Use the respond function to create the Items.`

  return request(
    prompt,
    // "openai/gpt-oss-120b",
    // "anthropic/claude-opus-4.5",
    "anthropic/claude-haiku-4.5",
    {
      name:'respond',
      description:'use this to create the Role Items',
      argname:'items',
      argschema: {type:"array", items:item}
    },
    1
  )
}