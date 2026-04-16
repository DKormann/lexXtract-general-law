import { Database } from "bun:sqlite"
import { hash } from "bun"
import { Role, type ExtractionItem, type Schema } from "./schemas"
import gdpr from "./gdpr.json"

let browser = typeof Bun == undefined

const assert = (condition:boolean, message?:string)=>{if (!condition)throw new Error("Assertion failed" + message?(":"+message) :"")}

const raise = (msg:string) => {throw new Error(msg)}

export const storage = browser ?
  localStorage:
  (()=>{
    let db = new Database("storage.db")
    db.run(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY,value TEXT)`)
    return {
      setItem:(key: string, value: string)=> {db.run("INSERT OR REPLACE INTO kv VALUES (?, ?)", [key, value])},
      getItem:(key: string): string |undefined => {
        const row = db.query("SELECT value FROM kv WHERE key = ?").get(key) as string
        return row ? (row as unknown as {value:string}).value : undefined
      },
      clear:()=> {db.run("DELETE FROM kv")}
    }
  })()


const validate = (schema:Schema, object: any)=>{
  if (object instanceof String)assert (schema.type == "string")
  else if (object instanceof Array){
    if (schema.type != "array") return raise("array expected")
    object.forEach(x=>validate(schema.items, x))
  }else if (object instanceof Object){
    if (schema.type != "object") return raise("not expected object but:" +schema.type)
    Object.entries(object).forEach(([k,v])=>{
      let props = schema.properties ?? {}
      if (k in props) validate(props[k]!, v)
      else assert (schema.additionalProperties != false)
    })
    if (schema.required) schema.required.forEach(s=>assert(s in object))
  }
}

let api_key = storage.getItem("api_key") as string;

while (!api_key){
  api_key = prompt("provide openrouter key")!
  storage.setItem("api_key", api_key)
}

type Tool = {
  name:string,
  description:string,
  argname:string
  argschema:Schema
}

type ModelResponse = {
  usage:{cost:number},
  output:({type:'function_call', name:string, arguments:string} | {type:'reasoning', content: any})[]
}


const cache_func = <T extends Function>  (f:T ):T =>{
  let fnhash = hash(f.toString())
  return (((...args:any[])=>{
    let key = String(hash(fnhash+JSON.stringify(args)))
    let res = storage.getItem(key)
    if (res) {
      let p = JSON.parse(res) as {async:boolean, value:any}
      if (p.async) return Promise.resolve(p.value)
      else return p.value
    }
    
    let dat = f(...args)
    if (dat instanceof Promise){
      return dat.then(value=>{
        storage.setItem(key, JSON.stringify({async:true, value}))
        return value
      })
    }
    storage.setItem(key, JSON.stringify({async:false, value:dat}))
    return dat
  }) as unknown as T)
}

export const  request = cache_func((prompt:string, MODEL:string, tool:Tool, _seed:number) =>{
  let outp =  fetch(
    'https://openrouter.ai/api/v1/responses',
    {
      method: "POST",
      headers:{
        "Content-Type": "application/json",
        "Authorization": `Bearer ${api_key}`
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        reasoning: {effort:'low'},
        tools:[{
          type:'function',
          name:tool.name,
          description:tool.description,
          parameters:{
            type:'object',
            properties:{[tool.argname]:tool.argschema},
            required: [tool.argname]
          }
        }],
        tool_choice:{type:'function', name:tool.name}
      })
    }
  ).then(res => res.json())
  .then((dat)=>{
    let res = dat as ModelResponse
    return {
      cost: res.usage.cost,
      output: JSON.parse(res.output.filter(x=>x.type == "function_call")[0]!.arguments)
    }
  })
  return outp
})

export const extraction = (article:string, item:ExtractionItem) =>{


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


// console.log(JSON.stringify(await extraction(gdpr[0]!, Role),null,2))