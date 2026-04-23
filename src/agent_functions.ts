import { button, div, errorpopup, h2, h3, p, popup } from "../web/html";
import { jsonView, viewer } from "../web/viewer";
import type { Stored } from "./db";
import { fillSchema, Schema, SchemaSchema, type JsonData } from "./struct";
import type { Module } from "./types";


type FunctionDef = {
  parameters: Record<string, Schema>,
  description?: string,
  reads: string[],
  writes: string[],
  code: string
}


const CapabilitiesSchema = Schema.anyOf(
  ...["taxonomy", "documents", "prompt"].map(Schema.const),
)

const FunctionSchema = Schema.object({
  description: Schema.string,
  reads: Schema.array(CapabilitiesSchema),
  writes: Schema.array(CapabilitiesSchema),
  
  parameters: Schema.record(Schema.any),
  code: Schema.string
}, ["parameters", "code"])

export const mkFunctions = (module:Module)=>{

  const functions = module.db("functions", Schema.record(FunctionSchema))

  functions.update(s=>{
    let fun = fillSchema(FunctionSchema) as FunctionDef
    fun.reads = ["documents"]
    fun.writes = ["taxonomy"]
    fun.code = `taxonomy.set()`
    return {...(s as {[key:string]: FunctionDef}), "example": fun}
  })


  const view = viewer(functions, d=>{
    return div(Object.entries(d as {[key:string]: FunctionDef}).map(([k,v])=>div(
      h3(k, button("call", {
        onclick:()=>{
          let args: Record<string, JsonData> = {}
          let pop = popup(
            h2("call "+ k),
            v.description? p(v.description) : [],
            h3("arguments"),
            Object.entries(v.parameters).map(([param, type])=>div(
              p(param),
              viewer({
                get: async ()=>fillSchema(type),
                set: async (d:JsonData)=>{args[param] = d},
                schema: type
              })
            )),
            button("execute", {
              onclick:()=>{
                try{
                  let func = new Function(...Object.keys(v.parameters), v.code)
                  let res = func(...Object.entries(v.parameters).map(([k,v])=>args[k]??fillSchema(v)))
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
