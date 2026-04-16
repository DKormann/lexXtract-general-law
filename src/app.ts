import { Stored, validate } from "./helpers";
import type { JsonData, Schema } from "./schemas";
import type { App, Document, Module, Prompt, Taxonomy } from "./types";


const module_list = Stored<string[]>("module_list", []) 

const treeSchema = (tax:Taxonomy):Schema=>{
  if ("itemSchema" in tax){
    return { type:"array", items: tax.itemSchema}
  }
  return {
    type:"object",
    properties: Object.fromEntries(tax.children.map(x=>[x.name, treeSchema(x)])),
    required: tax.children.map(x=>x.name)
  }
}

const check = (module:Module):void =>{
  console.log(JSON.stringify(module, null, 2))
  let schema = treeSchema(module.taxonomy)
  if (module.extraction) validate(schema, module.extraction)
  let go = (tax:Taxonomy, data:{[key:string]: JsonData}) =>{
    if (tax.constraint){
      let cfun = Function("data", tax.constraint)
      cfun(data)
    }
    if ("children" in tax){
      tax.children.forEach(x=>{
        let dc = data[x.name]
        if (dc == undefined) throw new Error(`Missing required field ${x.name} in taxonomy ${tax.name}`)
        go(x, dc as any)
      })
    }
  }
  if (module.extraction) go(module.taxonomy, module.extraction as any)
}

export const list_module = () => module_list.get()!

console.log("modules", list_module())

export const create_module = (
  name:string,
  taxonomy: Taxonomy,
  prompt: Prompt,
  source: Document[],
  extraction? : JsonData
) =>{
  if (list_module().includes(name)) throw new Error("Module with this name already exists")
  module_list.set([...list_module(), name])
  Stored<Module>(name, {prompt, taxonomy, source, extraction})
}

export const get_module = (name:string): Stored<Module> =>{
  if (!list_module().includes(name)) throw new Error("Module with this name does not exist")
  let st = Stored<Module>(name, {} as Module)
  return {
    get:()=>{
      let val = st.get()
      return val
    },
    set:(val:Module)=>{ 
      check(val)
      st.set(val)
    },
    del:()=>{
      st.del()
      let modules = list_module().filter(x=>x!==name)
      module_list.set(modules)
    }
  }
}

