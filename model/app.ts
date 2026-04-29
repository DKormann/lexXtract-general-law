import { default_functions, FunctionDefPattern } from "./agent_functions";
import { RemoteDB, type Stored } from "./db";
import { TaxonomyPattern, type Pattern } from "./pattern";
import type { JsonData, Taxonomy } from "./json";
import { ModPath, type Module } from "./types";


export const db = await RemoteDB()


export const createModule = async (mod: ModPath, show_module: (mod:ModPath)=>void ): Promise<Module> => {

  let module_list = db.get<ModPath[]>("modules", [ModPath])
  // let current_module = db.get<ModPath>("current_module", ModPath)

  module_list.get().then(mods=>{if (!mods.map(x=>JSON.stringify(x)).includes(JSON.stringify(mod))) module_list.set([...mods, mod])})
  let modState: Stored<any>[] = []

  let mod_db = <T extends JsonData> (key:string, pattern:Pattern) => {
    let st = db.get<T>(mod.name+":"+key, pattern, mod.owner)
    if (mod.owner != db.userid) st.set = async (val:T)=>{
      // let pop = popup(
      //   h2(`You cannot edit this module`),
      //   p(`it is owned by ${mod.owner}`),
      //   p('do you need to make a copy of this module to edit?'),
      //   button(`copy ${mod.name}`, {onclick: async ()=>{
      //     await Promise.all(modState.map(s=>s.get().then(d=>db.get(s.key, s.pattern, db.userid).set(d).then(()=>{console.log("copied", s.key, d)}))))
      //     await current_module.set({name:mod.name, owner: db.userid})
      //   }})
      // )
      throw new Error ("You cannot edit this module.")
    }
    modState.push(st as any as Stored<JsonData>)
    return st
  }

  const taxonomy = mod_db<Taxonomy>("taxonomy", TaxonomyPattern)

  taxonomy.onupdate(()=>{
    show_module(mod)
  })
  const extraction = mod_db<JsonData>("extraction", {"[key:string]": {"[key:string]": {"[key:string]": {depiction: String, content: String}}}})

  const module: Module ={
    db: mod_db,
    functions: mod_db("functions", {"[key:string]": FunctionDefPattern}),
    taxonomy,
    extraction,
    documents: mod_db<{[key:string]: string}>("documents", {"[key:string]": String}),
    prompt: mod_db<string>("prompt", String)
  }


  await module.functions.set(default_functions)

  return module
}



