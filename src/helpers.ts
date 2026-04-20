// import { Role, type ExtractionItem, type Schema } from "./schemas"
import type { Schema } from "./struct"
import gdpr from "./gdpr.json"

let browser = typeof window !== "undefined"


export const storage = browser ?
  localStorage:
  (()=>{
    const db = new Map<string, string>()
    return {
      setItem:(key: string, value: string)=> {db.set(key, value)},
      getItem:(key: string): string |undefined => db.get(key),
      clear:()=> {db.clear()}
    }
  })()



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
  let fnhash = f.toString()
  return (((...args:any[])=>{
    let key = JSON.stringify([fnhash, args])
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


export type Stored<T> = {
  get:()=>T|undefined,
  set:(val:T)=>void,
  del:()=>void
}
export const Stored = <T>(key:string, default_value:T):Stored<T> =>{
  const set = (val:T)=> {
    console.log(key, JSON.stringify(val, null, 2))
    storage.setItem(key, JSON.stringify(val))}
  if (!storage.getItem(key) || storage.getItem(key) === "undefined") set(default_value)
  return {
    get:()=>{
      let val = storage.getItem(key)
      if (val == undefined || val === "undefined") throw new Error("No value found for key " + key)
      if (val) return JSON.parse(val) as T
    },
    set,
    del:()=>{storage.setItem(key, undefined as any)}
  }
}

