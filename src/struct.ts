
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


let resolve = (ref:string, root:Schema):Schema=>{
  if (!ref.startsWith("#/")) throw new Error("Only local references supported")
  let parts = ref.split("/").slice(1)
  let current: Schema = root
  for (let part of parts){
    if (typeof current != "object" || current == null || !(part in current)) throw new Error(`Invalid reference ${ref}`)
    current = (current as any)[part]
  }
  return current as Schema
}



export const schemaType = (s:Schema):string=>{

  if (s.type) {
    if (s.type == "array") return schemaType(s.items) + "[]"
    if (s.type == "object") {
      let props = s.properties ? Object.entries(s.properties).map(([k,v])=> `${k}${s.required?.includes(k) ? "" : "?"}: ${schemaType(v)}`) : []
      if (s.additionalProperties) props.push(`[key:string]: ${schemaType(s.additionalProperties)}`)
      return `{\n  ${props.join(",\n").replaceAll("\n", "\n  ")}\n}`
    }
    if (s.type == "string") return "string"
  }

  if ("$ref" in s) return `ref(${s["$ref"]})`
  if ("anyOf" in s) return "(" + (s.anyOf as Schema[]).map(schemaType).join(" | ") + ")"
  if ("const" in s) return stringify(s.const)
  return "any"
}

export const validate = (schema:Schema, object: any)=>{

  let deref = (s:Schema):Schema=>{
    if ("$ref" in s) {
      let ref = s["$ref"] as string
      return resolve(ref, schema)
    }
    return s
  }

  let go = (s:Schema, object:any, path:string[])=>{
    let raise = (msg:string)=>{throw new Error(`Validation error at ${path.join("/")} : ${msg}\nSchema: ${schemaType(s)}\n\nObject: ${stringify(object)}`)}
    let assert = (condition:boolean, msg?:string)=>{if (!condition) raise(msg || "Assertion failed")}
    if (object == undefined) raise("undefined value")
    s = deref(s)
    if (s.type == undefined){
      if ("anyOf" in s){
        let ok = false;
        (s.anyOf as Schema[]).forEach((p, i)=>{
          try{
            go(p, object, [...path, `anyOf[${i}]`])
            ok = true
          }catch(e){}
        })
        assert(ok, "No matching schema in anyOf")
      }else if ("const" in s){
        assert(JSON.stringify(object) == JSON.stringify(s.const), "const mismatch")
      }
    } else if (typeof object == "string") {assert (s.type == "string")
    } else if (object instanceof Array){
      if (s.type != "array") return raise("unexpected array")
      object.forEach((x, i)=>go(s.items, x, [...path, String(i)]))
    } else if (typeof object == "object" && object != null){
      if (s.type != "object") return raise("not expected object but:" +s.type)
      Object.entries(object).forEach(([k,v])=>{
        let props = s.properties ?? {}
        if (k in props) go(props[k]!, v, [...path, k])
        else go(s.additionalProperties ?? raise("unexpected property "+k), v, [...path, k])
      })
      if (s.required) s.required.forEach(s=>assert(s in object))
    } else raise ("unexpeced type: "+typeof object)
  }



  go(schema, object, ["#"])
}

export const fillSchema = (schema:Schema):JsonData=>{
  if (schema.type == "string") return ""
  if (schema.type == "array") return []
  if (schema.type == "object"){
    return Object.fromEntries((schema.required ?? []).map(k=> [k, fillSchema(schema.properties![k]!)]))
  }
  if (schema.type == undefined){
    if ("anyOf" in schema && schema.anyOf instanceof Array) return fillSchema(schema.anyOf[0] as Schema)
    if ("const" in schema) return schema.const
  }
  throw new Error("Invalid schema" + JSON.stringify(schema))

}

export type JsonData = string | {[ key: string ]: JsonData} | JsonData[]


export const Schema = {
  from: (s:any):Schema=>{
    if (s == String) return Schema.string 
    if (typeof s == "string") return Schema.const(s)
    if (s instanceof Array){
      if (s.length == 1) return Schema.array(Schema.from(s[0]!))
      if (s.length > 1) return Schema.anyOf(...s.map(x=>Schema.from(x)))
    }
    if (typeof s == "object" && s != null){
      if ("type" in s || "anyOf" in s || "const" in s || "$ref" in s) return s as Schema
      let props:{[key:string]:Schema} = {}
      let required:string[] = []
      Object.entries(s).forEach(([k,v])=>{
        if (k.startsWith("_")) k = k.slice(1)
        if (k.endsWith("?")){
          props[k.slice(0,-1)] = Schema.from(v)
        }else{
          props[k] = Schema.from(v)
          required.push(k)
        }
      })
      return Schema.object(props, required)
    }
    throw new Error("Invalid schema data: " + JSON.stringify(s))
  },
  string: {type:"string"} as Schema,
  object: (properties:{[key:string]:Schema}, required?:string[], additionalProperties?:Schema) =>({type:"object", properties, required, additionalProperties} as Schema),
  record: (valueSchema:Schema)=>({type:"object", additionalProperties:valueSchema} as Schema),
  array: (items:Schema)=>({type:"array", items} as Schema),
  anyOf: (...anyOf:Schema[])=>({type:undefined, anyOf} as Schema),
  const: (value:JsonData)=>({type:undefined, const:value} as Schema),
  ref: ($ref:string)=>({type:undefined, $ref } as Schema),
  any: {} as Schema
}

export const SchemaSchema : Schema = {
  Schema: Schema.anyOf(
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
  ),
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

export type Taxonomy = {
  categories: {
    [name:string]: {
      description: string,
      subCategories: {
        [name:string]: {
          description: string,
          itemSchema: Schema
        }
      }
    }
  }
}


const objectMap = <T, U>(obj: {[key:string]: T}, fn: (t:T, k:string)=>U): {[key:string]: U}=> Object.fromEntries(Object.entries(obj).map(([k,v])=>[k, fn(v, k)]))

export const Taxonomy2Schema = (t:Taxonomy):Schema=>Schema.object(objectMap(t.categories, cat=> Schema.object(objectMap(cat.subCategories, subcat=>Schema.record(subcat.itemSchema)))))


export const parse = (s:string)=>JSON.parse(s)
export const stringify = (d:JsonData)=>JSON.stringify(d, null, 2)





console.log(TaxonomySchema)