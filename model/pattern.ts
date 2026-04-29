import { stringify, type JsonData, type JSONSchema } from "./json"

type ConstPattern = string | number | boolean | null
type PrimitivePattern = StringConstructor | NumberConstructor | BooleanConstructor
type ArrayPattern = [Pattern]
type AnyPattern = {"$any": true}

type ObjectPattern = { [key:string]: Pattern }
type OpPattern = {"$ref": string} | {"$const": JsonData} | {"$defs": { [key: string]: Pattern}, pattern: Pattern } | AnyPattern | Pattern[]

export const ANY = {"$any": true} as const


export type Pattern = ConstPattern | PrimitivePattern | ArrayPattern | ObjectPattern | Pattern[] | OpPattern

const isObject = (pattern: Pattern): pattern is ObjectPattern => typeof pattern == "object" && pattern != null && !Array.isArray(pattern)
const isRefPattern = (pattern: Pattern): pattern is {"$ref": string} => isObject(pattern) && "$ref" in pattern && typeof pattern.$ref == "string"
const isDefsPattern = (pattern: Pattern): pattern is {"$defs": { [key: string]: Pattern}, pattern: Pattern } => isObject(pattern) && "$defs" in pattern && isObject(pattern.$defs) && "pattern" in pattern
const hasStringId = (pattern: Pattern): pattern is ObjectPattern & {"$id": string} => isObject(pattern) && typeof (pattern as any).$id == "string"
const isKeywordKey = (key: string) => key.startsWith("$") && !key.startsWith("$$")
const literalKey = (key: string) => key.startsWith("$$") ? key.slice(1) : key
const patternKey = (key: string) => key.startsWith("$") ? "$" + key : key
const propKey = (key: string) => {
  key = literalKey(key)
  return {key: key.endsWith("?") ? key.slice(0, -1) : key, optional: key.endsWith("?")}
}
const normalProps = (pattern: ObjectPattern) => Object.entries(pattern)
  .filter(([k])=>k != "[key:string]" && !isKeywordKey(k))
  .map(([k, pattern])=>({ ...propKey(k), pattern }))
const eachChild = (pattern: Pattern, fn: (child: Pattern)=>void) => {
  if (pattern instanceof Array) return pattern.forEach(fn)
  if (!isObject(pattern) || isRefPattern(pattern) || "$const" in pattern) return
  if (isDefsPattern(pattern)){
    Object.values(pattern.$defs).forEach(fn)
    fn(pattern.pattern)
    return
  }
  Object.entries(pattern).forEach(([k, v])=>{
    if (!isKeywordKey(k)) fn(v)
  })
}

export const toSchema = (pattern: Pattern): JSONSchema => {
  
  const _toSchema = (pattern: Pattern): JSONSchema => {
    if (typeof pattern == "object" && pattern != null && "$any" in pattern) return {}
    if (pattern == String) return {type: "string"}
    if (pattern == Number) return {type: "number"}
    if (pattern == Boolean) return {type: "boolean"}
    if (typeof pattern == "string" || typeof pattern == "number" || typeof pattern == "boolean" || pattern === null) return {const: pattern}
    if (pattern instanceof Array && pattern.length == 1) return {type: "array", items: _toSchema(pattern[0])}
    if (pattern instanceof Array) return {anyOf: pattern.map(_toSchema)}
    if (isObject(pattern)){
      if (pattern == null) return {type: "null"}
      if ("$const" in pattern) return {const: pattern["$const"] as JsonData}
      if (isRefPattern(pattern)) return pattern as JSONSchema
      let props:{[key:string]: JSONSchema} = {}
      let required:string[] = []
      let additionalProperties: JSONSchema | undefined = undefined
      Object.entries(pattern).forEach(([k,v])=>{
        if (k == "[key:string]") additionalProperties = _toSchema(v)
      })
      normalProps(pattern).forEach(prop=>{
        if (!prop.optional) required.push(prop.key)
        props[prop.key] = _toSchema(prop.pattern)
      })
      let res: JSONSchema = {type: "object"}
      if (Object.keys(props).length > 0) res.properties = props
      if (required.length > 0) res.required = required
      if (hasStringId(pattern)) res.$id = pattern.$id
      if (additionalProperties) res.additionalProperties = additionalProperties
      return res
    }
    throw new Error("Invalid pattern: "+String(pattern))
  }


  if (isDefsPattern(pattern)){
    return {
      $defs: Object.fromEntries(Object.entries(pattern.$defs as any).map(([k,v])=>[k, _toSchema(v as Pattern)])),
      ..._toSchema(pattern.pattern)
    }
  }
  return _toSchema(pattern)
}



export const format = (pattern: Pattern, root = pattern): string => {
  let defs = new Map<string, string>()
  let go = (p:Pattern, base = ""): string=>{
    let nextBase = scopeBase(base, p)
    let register = (ref:string):string=>{
      let uri = resolveUri(nextBase, ref)
      let name = uri.split("#").join("_").split("/").filter(Boolean).join("_") || "T"
      if (defs.has(name)) return name
      defs.set(name, "")
      defs.set(name, go(resolve(root, ref, nextBase), uri))
      return name
    }

    if (p == String) return "string"
    if (p == Number) return "number"
    if (p == Boolean) return "boolean"
    if (typeof p == "object" && p != null && "$any" in p) return "any"
    if (typeof p == "string" || typeof p == "number" || typeof p == "boolean" || p === null) return JSON.stringify(p)
    if (p instanceof Array && p.length == 1) return `${go(p[0], nextBase)}[]`
    if (p instanceof Array) return `(${p.map(x=>go(x, nextBase)).join(" | ")})`
    if (isObject(p)){
      if ("$const" in p) return JSON.stringify(p["$const"])
      if (isRefPattern(p)) return register(p.$ref)
      let props = normalProps(p).map(prop => `${literalKey(prop.optional ? prop.key + "?" : prop.key)}: ${go(prop.pattern, nextBase)}`)
      return `{${('\n'+props.join(",\n")).replaceAll("\n", "\n  ")}\n}`
    }
    throw new Error("Invalid pattern: "+String(p))
  }
  let end = go(pattern)
  return Array.from(defs.keys()).map(k=>`type ${k} = ${defs.get(k)}`).join("\n") + "\n" +end
}

const rootBase = "pattern:/"

const stripFragment = (uri: string) => uri.split("#")[0] || ""
const fragmentOf = (uri: string) => uri.includes("#") ? "#" + uri.split("#").slice(1).join("#") : ""
const decodePointer = (part: string) => part.replaceAll("~1", "/").replaceAll("~0", "~")
const resolveUri = (base: string, ref: string) => {
  if (!base) base = rootBase
  return new URL(ref, base).toString()
}
const scopeBase = (base: string, pattern: Pattern) => {
  if (hasStringId(pattern)){
    return resolveUri(base, pattern.$id)
  }
  return base || rootBase
}
const hasId = (pattern: Pattern) => hasStringId(pattern)
const deref = (target: Pattern, ref: string, err: Error) => {
  let parts = ref.split("/").slice(1).map(decodePointer)
  for (let part of parts){
    if (!isObject(target) || !(part in target)) throw err
    target = (target as any)[part]
  }
  return target
}

export const resolve = (pattern: Pattern, ref: string, base = ""): Pattern =>{
  let err = new Error(`Invalid reference ${ref} in pattern:\n${JSON.stringify(pattern, null, 2)}`)
  if (typeof ref != "string") throw err
  let uri = resolveUri(base, ref)
  let fragment = fragmentOf(uri)
  let targetBase = stripFragment(uri)
  let go = (current: Pattern, base: string, scopeRoot: boolean): Pattern | undefined => {
    let nextBase = scopeBase(base, current)
    if (scopeRoot && stripFragment(nextBase) == targetBase) {
      if (!fragment || fragment == "#") return current
      if (!fragment.startsWith("#/")) throw err
      return deref(current, fragment, err)
    }
    let found: Pattern | undefined = undefined
    eachChild(current, child => {
      if (found) return
      found = go(child, nextBase, hasId(child))
    })
    return found
  }
  let found = go(pattern, rootBase, true)
  if (found == undefined) throw err
  return found
}

export const validate = (pattern: Pattern, data: JsonData): JsonData => {

  let go = (p:Pattern, d:JsonData, path: string[], base = "") =>{
    let nextBase = scopeBase(base, p)

    const raise = (msg:string) => {throw new Error(`Validation error at ${path.join(".")}:\n${format(p, pattern)}\nvs data: ${stringify(d)}\n${msg}`)}
    const assert = (condition:any, msg?:string) => {if (!condition) raise(msg || "assertion failed")}

    if (isObject(p) && "$any" in p) return
    if (p == String) return assert(typeof d == "string")
    if (p == Number) return assert(typeof d == "number")
    if (p == Boolean) return assert(typeof d == "boolean")
    if (typeof p == "string" || typeof p == "number" || typeof p == "boolean" || p === null) return assert(d === p, `expected constant ${String(p)}`)
    if (p instanceof Array && p.length == 1){
      assert(d instanceof Array, `expected array`);
      (d as JsonData[]).forEach((x,i)=>go(p[0]!, x, [...path, String(i)], nextBase))
      return
    }
    if (p instanceof Array){
      if (p.length == 1){
        assert(d instanceof Array, `expected array`);
        (d as JsonData[]).forEach((x,i)=>go(p[0]!, x, [...path, String(i)], nextBase))
        return
      }
      for (let option of p){
        try{
          go(option, d, path, nextBase)
          return
        }catch(e){}
      }
      raise(`expected to match one of the options`)
    }
    if (isObject(p)){
      if ("$const" in p) return assert(JSON.stringify(d) === JSON.stringify(p["$const"]), `expected constant ${JSON.stringify(p["$const"])}`)
      if (isRefPattern(p)){
        let ref :Pattern = null
        try{
          ref = resolve(pattern, p.$ref, base)
        }catch(e){
          raise(`invalid reference ${p.$ref}: ${(e as Error).message}`)
        }
        return go(ref, d, path, resolveUri(base, p.$ref))
      }
      if (isDefsPattern(p)) return go(p.pattern, d, path, nextBase)

      if (typeof d != "object" || d == null || Array.isArray(d)) raise(`expected object`)
      let props = Object.fromEntries(normalProps(p).map(prop=>[prop.key, prop]))
      Object.entries(d as {[key:string]: JsonData}).forEach(([k,v])=>{
        if (k in props) return go((props as any)[k].pattern, v, [...path, k], nextBase)
        assert ("[key:string]" in p, `unexpected property ${k}`)
        return go((p as any)["[key:string]"], v, [...path, k], nextBase)
      })
      Object.entries(props).forEach(([k,v])=>assert((v as any).optional || k in (d as object), `missing required property ${k}`))
    }
  }
  go(pattern, data, [])
  return data
}

export const fill = (pattern: Pattern): JsonData => {
  const go = (p: Pattern, root: Pattern, base = ""): JsonData => {
    let nextBase = scopeBase(base, p)
    if (isObject(p) && "$any" in p) return null
    if (p == String) return ""
    if (p == Number) return 0
    if (p == Boolean) return false
    if (typeof p == "string" || typeof p == "number" || typeof p == "boolean" || p === null) return p
    if (p instanceof Array) return p.length == 1 ? [] : go(p[0]!, root, nextBase)
    if (isObject(p)){
      if ("$const" in p) return p.$const as JsonData
      if (isRefPattern(p)) return go(resolve(root, p.$ref, base), root, resolveUri(base, p.$ref))
      if (isDefsPattern(p)) return go(p.pattern, p, nextBase)
      return Object.fromEntries(normalProps(p)
        .flatMap(prop=> prop.optional ? [] : [[prop.key, go(prop.pattern, root, nextBase)]]))
    }
    throw new Error("Invalid pattern: "+String(p))
  }
  return go(pattern, pattern)
}

export const fromSchema = (schema: JSONSchema): Pattern => {
  if (!Object.keys(schema).length) return {$any: true}
  if ("const" in schema) return schema.const as ConstPattern
  if (schema.type == "string") return String
  if (schema.type == "number") return Number
  if (schema.type == "boolean") return Boolean
  if (schema.type == "null") return null
  if (schema.type == "array" && "items" in schema) return [fromSchema(schema.items as JSONSchema)]
  if ("anyOf" in schema && schema.anyOf instanceof Array) return schema.anyOf.map(s=>fromSchema(s as JSONSchema))
  if (schema.type == "object"){
    let res: ObjectPattern = {}
    if (typeof schema.$id == "string") res.$id = schema.$id
    let required = new Set(schema.required as string[] | undefined)
    if ("properties" in schema){
      Object.entries(schema.properties as {[key:string]: JSONSchema}).forEach(([k,v])=>{
        let name = patternKey(k)
        res[required.has(k) ? name : name+"?"] = fromSchema(v)
      })
    }
    if ("additionalProperties" in schema) res["[key:string]"] = fromSchema(schema.additionalProperties as JSONSchema)
    return res
  }
  throw new Error("Unsupported schema: "+JSON.stringify(schema))

}

export const validateSchema = (schema: JSONSchema, data: JsonData): JsonData => validate(fromSchema(schema), data)

export const SchemaPattern: Pattern = {
  $id: "Schema",
  $defs: {
    Json: [String, Number, Boolean, null, [{"$ref": "#/$defs/Json"}], {"[key:string]": {"$ref": "#/$defs/Json"}}],
    Schema: [
      {},
      {"$$id?": String},
      {type: "string"},
      {type: "number"},
      {type: "boolean"},
      {type: "null"},
      {type: "array", items: {"$ref": "#/$defs/Schema"}},
      {
        type: "object",
        "$$id?": String,
        "properties?": {"[key:string]": {"$ref": "#/$defs/Schema"}},
        "required?": [String],
        "additionalProperties?": {"$ref": "#/$defs/Schema"}
      },
      {"$$ref": String, "$$id?": String},
      {anyOf: [{"$ref": "#/$defs/Schema"}]},
      {const: {"$ref": "#/$defs/Json"}}
    ]
  },
  pattern: {"$ref": "#/$defs/Schema"}
}



export const TaxonomyPattern: Pattern = {
  categories: {
    "[key:string]": {
      description: String,
      subCategories: {
        "[key:string]": {
          description: String,
          // itemSchema: SchemaPattern
        }
      }
    }
  }
}