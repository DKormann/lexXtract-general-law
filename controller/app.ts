import { default_functions, FunctionDefPattern } from "./agent_functions";
import { RemoteDB, type Stored } from "../model/db";
import { TaxonomyPattern, type Pattern } from "../model/pattern";
import type { JsonData, Taxonomy } from "../model/json";
import { ModPath, type FunctionDef, type Module } from "../model/types";


export const db = await RemoteDB()


export const createModule = async (mod: ModPath, show_module: (mod:ModPath)=>void ): Promise<Module> => {
  let module_list = await db.get<ModPath[]>("modules", [ModPath])
  if (!module_list.get().map(x=>JSON.stringify(x)).includes(JSON.stringify(mod))) module_list.set([...module_list.get(), mod])
  let modState: Stored<any>[] = []
  let mod_db = async  <T extends JsonData> (key:string, pattern:Pattern) => {
    let st = await db.get<T>(mod.name+":"+key, pattern, mod.owner)
    if (mod.owner != db.userid) st.set = async (val:T)=>{
      throw new Error ("You cannot edit this module.")
    }
    modState.push(st as any as Stored<JsonData>)
    return st
  }

  const [taxonomy, extraction, documents, functions, prompt] = await Promise.all([
    mod_db<Taxonomy>("taxonomy", TaxonomyPattern),
    mod_db<JsonData>("extraction", {"[key:string]": {"[key:string]": {"[key:string]": {depiction: String, content: String}}}}),
    mod_db<{[key:string]: string}>("documents", {"[key:string]": String}),
    mod_db<{[key:string]: FunctionDef}>("functions", {"[key:string]": FunctionDefPattern}),
    mod_db<string>("prompt", String)
  ])

  const module: Module ={db: mod_db,functions,taxonomy,extraction,documents,prompt}
  if (mod.owner == db.userid) await module.functions.set(default_functions)
  return module
}



