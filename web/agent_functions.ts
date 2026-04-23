import { button, div, errorpopup, h2, h3, p, popup } from "./html";
import { jsonView, viewer } from "./viewer";
import type { Stored } from "../src/db";
import { fillSchema, Schema, SchemaSchema, type JsonData } from "../src/struct";
import type { Module } from "../src/types";


export type FunctionDef = {
  parameters: Record<string, Schema>,
  description?: string,
  reads: string[],
  writes: string[],
  code: string
}


const CapabilitiesSchema = Schema.anyOf(
  ...["taxonomy", "documents", "prompt", "functions"].map(Schema.const),
)

export const FunctionSchema = Schema.object({
  description: Schema.string,
  reads: Schema.array(CapabilitiesSchema),
  writes: Schema.array(CapabilitiesSchema),
  parameters: Schema.record(Schema.any),
  code: Schema.string
}, ["parameters", "code"])

export const mkFunctions = async (module:Module)=>{

  const functions = module.db<{[key:string]: FunctionDef}>("functions", Schema.record(FunctionSchema))

  let funName = "addCategory"

  await functions.update(s=>{
  
    if (funName in s) return s
    let fun = fillSchema(FunctionSchema) as FunctionDef
    fun.reads = ["documents", "taxonomy"]
    fun.parameters = {catName: Schema.string}
    fun.writes = ["taxonomy"]
    fun.code = `return taxonomy.update(t=>{
  console.log("Current taxonomy:", t)
  t.categories[catName || "newCategory"] = {
    description: "A new category", subCategories: {}
  }
  return t
})`

    return {...(s as {[key:string]: FunctionDef}), "newCategory": fun}
  })


  const view = viewer(functions, d=>{
    return div(Object.entries(d as {[key:string]: FunctionDef}).map(([k,v])=>div(
      h3(k, button("call", {
        onclick:()=>{

          let argsSchema = Schema.object(v.parameters, Object.keys(v.parameters))
          let args = fillSchema(argsSchema) as {[par:string]: JsonData}
          
          let pop = popup(
            h2("call "+ k),
            v.description? p(v.description) : [],
            h3("arguments"),
            viewer({
              get: async ()=>args,
              set: async (a:{[par:string]:JsonData})=>{args = a},
              schema: argsSchema
            }),
            button("execute", {
              onclick:async ()=>{
                
                try{

                  new Set(v.reads.concat(v.writes)).forEach(cap=>{
                    let section = module[cap as keyof Module] as Stored<any>
                    console.log(cap, section)
                    args[cap] = {
                      ...(v.reads.includes(cap) ? {get: section.get as any} : {}),
                      ...(v.writes.includes(cap) ? {set: section.set} as any : {}),
                      ...(v.reads.includes(cap) && v.writes.includes(cap) ? {update: section.update} as any : {})
                    }
                  })
                  console.log("Executing function with args", args)
                  let func = new Function(...Object.keys(args), v.code)
                  let res = await func(...Object.values(args))
                  pop.remove()
                  popup(
                    div(
                      h2(k," result"),
                      jsonView(res)
                    )
                  )
                }catch(e){
                  errorpopup(e as Error)
                }
              }
            })
          )
        }
      })),
      jsonView(v)
    )))
  })

  return view;

}
