import { button, div, errorpopup, h2, h3, p, popup, pre, style } from "./html";
import { jsonView, viewer } from "./viewer";
import type { Stored } from "../src/db";
import { fillSchema, Schema, SchemaSchema, type JsonData } from "../src/struct";
import type { Module } from "../src/types";


export type FunctionDef = {
  parameters: Record<string, Schema>,
  description?: string,
  reads?: string[],
  writes?: string[],
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

export const mkRunner = (module:Module, v: FunctionDef): (args:{[key:string]:JsonData})=>Promise<JsonData> =>{

  return  async (args:{[key:string]:JsonData})=>{
    let reads = v.reads || []
    let writes = v.writes || []

    new Set(reads.concat(writes)).forEach(cap=>{
      let section = module[cap as keyof Module] as Stored<any>
      console.log(cap, section)
      args[cap] = {
        ...(reads.includes(cap) ? {get: section.get as any} : {}),
        ...(writes.includes(cap) ? {set: section.set} as any : {}),
        ...(reads.includes(cap) && writes.includes(cap) ? {update: section.update} as any : {})
      }
    })
    console.log("Executing function with args", args)
    let func = new Function(...Object.keys(args), v.code)
    return await func(...Object.values(args)) || "OK" as JsonData
  }


}

export const mkFunctions = async (module:Module)=>{

  const functions = module.db<{[key:string]: FunctionDef}>("functions", Schema.record(FunctionSchema))

  const view = viewer(functions, d=>{
    return div(Object.entries(d as {[key:string]: FunctionDef}).map(([k,v])=>
    {
      let details = div(style({
        paddingLeft: "1em",
      }))
      return div(
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
                    let res = await mkRunner(module, v)(args)
                    pop.remove()
                    if (res !== undefined) popup(
                      h2("result"),
                      jsonView(res)
                    )
                  }catch(e){
                    errorpopup(e as Error)
                  }
                }
              })
            )
          }
        })),
        p(v.description || "", button("details", {onclick:()=>{
          if (details.childElementCount == 0){
            details.append(viewer({
              get: async ()=>v,
              set: async (a:FunctionDef)=>functions.update(fs=>({...fs, [k]: a})),
              schema: FunctionSchema
            }))
          }else{
            details.replaceChildren()
          }
        }})),
        details,
      )
    }
  ))

  })

  return view;

}
