

export type JsonData = string | number | boolean | null | JsonData[] | {[key:string]:JsonData}

export type Schema =
{description?:string} &
( {type: "string"}
| {
  type: "object",
  properties?:{[key:string]:Schema},
  required?: string[],
  additionalProperties?:boolean
}
| {type: "array", items: Schema })

export const String:Schema = {type:"string"}


export type ExtractionItem = Schema & {name:string}


export const Role :ExtractionItem = {
  type:"object",
  name: "Role",
  description: "A legal Role is a Actor or Recipient, having a set of obligations and rights.",
  properties:{
    title:String,
    definition:String,
    summary:String,
  },
  required:["title"]
}

// console.log(JSON.stringify(Role, null,2))