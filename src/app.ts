import { Stored, validate } from "./helpers";
import type { JsonData, Schema } from "./schemas";
import type { App, Document, Module, Prompt, Taxonomy } from "./types";

// const app = {} as {[name:string]: Stored<Module>}

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
  go(module.taxonomy, module.extraction as any)
}


export const list_module = () => module_list.get()!
export const create_module = (
  name:string,
  taxonomy: Taxonomy,
  prompt: Prompt,
  source: Document[],
  extraction? : JsonData
):Stored<Module> =>{
  if (list_module().includes(name)) throw new Error("Module with this name already exists")
  let st = Stored<Module>(name, {prompt, taxonomy, source, extraction})

  let res:Stored<Module> = {
    get:st.get,
    set:(val:Module)=>{
      check(val)
      st.set(val)
    }
  }
  module_list.set([...list_module(), name])
  return res
}


