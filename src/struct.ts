
import { hash } from "./hash"
import { storage } from "./helpers"

export type Schema =
{ [key:string]: JsonData} & 
({
  type?: undefined,
  $ref: `#/${string}`
} | {
  type?: undefined,
  anyOf: Schema[]
} | {
  type?: undefined,
  const: JsonData
} | {
  type: "string"
} | {
  type: "array",
  items: Schema
} | {
  type: "object",
  properties? :{[key:string]:Schema},
  required?: string[],
  additionalProperties?: Schema
} | {
  type?: undefined
})


const assert = (condition:boolean, message?:string)=>{if (!condition)throw new Error("Assertion failed" + message?(":"+message) :"")}

const raise = (msg:string) => {throw new Error(msg)}


export const validate = (schema:Schema, object: any)=>{

  let deref = (s:Schema):Schema=>{
    if ("$ref" in s) {
      let ref = s["$ref"] as string
      if (!ref.startsWith("#/")) throw new Error("Only local references supported")
      let parts = ref.split("/").slice(1)
      let current: Schema = schema
      for (let part of parts){
        if (typeof current != "object" || current == null || !(part in current)) throw new Error(`Invalid reference ${ref}`)
        current = (current as any)[part]
      }
      return current as Schema
    }
    return s
  }

  let go = (s:Schema, object:any)=>{
    s = deref(s)
    if (s.type == undefined){
      if ("anyOf" in s){
        let ok = false;
        (s.anyOf as Schema[]).forEach(p=>{
          try{
            go(p, object)
            ok = true
          }catch(e){}
        })
        assert(ok, "No matching schema in anyOf")
      }else if ("const" in s){
        assert(JSON.stringify(object) == JSON.stringify(s.const), "const mismatch")
      }
    } else if (typeof object == "string") {assert (s.type == "string")
    } else if (object instanceof Array){
      if (s.type != "array") return raise("array expected")
      object.forEach(x=>go(s.items, x))
    } else if (object instanceof Object){
      if (s.type != "object") return raise("not expected object but:" +s.type)
      Object.entries(object).forEach(([k,v])=>{
        let props = s.properties ?? {}
        if (k in props) go(props[k]!, v)
        else assert (Boolean(s.additionalProperties))
      })
      if (s.required) s.required.forEach(s=>assert(s in object))
    } else raise ("unexpeced type: "+typeof object)
  }
}

export const fillSchema = (schema:Schema):JsonData=>{
  if (schema.type == "string") return ""
  if (schema.type == "array") return []
  if (schema.type == "object"){
    return Object.fromEntries((schema.required ?? []).map(k=> [k, fillSchema(schema.properties![k]!)]))
  }
  throw new Error("Invalid schema")
}

export type JsonData = string | {[ key: string ]: JsonData} | JsonData[]

export type Stored = {
  owner: string,
  key: string,
  schema: Schema,
  get: ()=>Promise<JsonData>,
  set: (data:JsonData)=>Promise<void>
  onupdate: (listener:()=>void)=>void
}

export type DB = {
  signup(username:string, password:string):Promise<void>
  get(owner:string, key:string, schema:Schema): Stored
}

export const localDB: DB = {
  async signup(username: string, password: string) {
    let users = JSON.parse(storage.getItem("users") ?? "{}") as {[username:string]: string}
    if (username in users) throw new Error("User already exists")
    users[username] = hash(password)
    storage.setItem("users", JSON.stringify(users))
  },
  
  get(owner: string, key: string, schema: Schema): Stored {
    let data = storage.getItem(owner+"."+key)
    if (!data) {
      data = JSON.stringify(fillSchema(schema))
      storage.setItem(owner+"."+key, data)
    }
    let parsed = JSON.parse(data)
    
    validate(schema, parsed)
    let listeners: (()=>void)[] = []
    return {
      owner,
      key,
      schema,
      get: async ()=> {
        return parsed
      },
      set: async (data: JsonData)=>{
        validate(schema, data)
        parsed = data
        listeners.forEach(l=>l())
        storage.setItem(owner+"."+key, JSON.stringify(data))
      },
      onupdate: (listener: ()=>void)=>{
        listeners.push(listener)
      }
    }
  }
}

await localDB.signup("admin", "admin").catch(()=>{})


export const Schema = {
  string: {type:"string"} as Schema,
  object: (properties:{[key:string]:Schema}, required?:string[], additionalProperties?:Schema) =>({type:"object", properties, required, additionalProperties} as Schema),
  record: (valueSchema:Schema)=>({type:"object", additionalProperties:valueSchema} as Schema),
  array: (items:Schema)=>({type:"array", items} as Schema),
  anyOf: (anyOf:Schema[])=>({type:undefined, anyOf} as Schema),
  const: (value:JsonData)=>({type:undefined, const:value} as Schema),
  ref: ($ref:string)=>({type:undefined, $ref } as Schema),
  any: {} as Schema
}



export const SchemaSchema : Schema = {
  Schema: Schema.anyOf([
    Schema.object({
      type: Schema.const("string")
    }, ['type']),
    Schema.object({
      type: Schema.const("array"),
      items: Schema.ref("#/Schema")
    }, ['type', 'items']),
    Schema.object({
      type: Schema.const("object"),
      properties: Schema.record(Schema.ref("#/Schema")),
      required: Schema.array(Schema.string),
    }, ['type']),
    Schema.object({
      "$ref": Schema.string
    }, ['$ref']),
    Schema.object({
      anyOf: Schema.array(Schema.ref("#/Schema"))
    }, ['anyOf']),
    Schema.object({
      const: Schema.any
    }, ['const'])
  ]),
  "$ref" : "#/Schema"
}


export const TaxonomySchema:Schema = Schema.object({
  categories: Schema.record(Schema.object({
    description: Schema.string,
    subCategories: Schema.record(Schema.object({
      description: Schema.string,
      itemSchema: Schema.any,
    }, ['description', 'itemSchema']))
  }, ['description']))
}, ['categories'])




console.log(TaxonomySchema)