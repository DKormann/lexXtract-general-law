import { stringify, type JsonData } from "../src/struct"

type ConstPattern = string | number | boolean | null
type PrimitivePattern = StringConstructor | NumberConstructor | BooleanConstructor
type ArrayPattern = [Pattern]

type ObjectPattern = { [key:string]: Pattern }
type OpPattern = {"$ref": string} | {"$const": JsonData} | {"$defs": { [key: string]: Pattern}, pattern: Pattern } | Pattern[]


export type Pattern = ConstPattern | PrimitivePattern | ArrayPattern | ObjectPattern | Pattern[] | OpPattern

export type Schema = {[key:string] : JsonData}

export const toSchema = (pattern: Pattern): Schema => {
  
  const _toSchema = (pattern: Pattern): Schema => {
    if (pattern == String) return {type: "string"}
    if (pattern == Number) return {type: "number"}
    if (pattern == Boolean) return {type: "boolean"}
    if (typeof pattern == "string" || typeof pattern == "number" || typeof pattern == "boolean" || pattern === null) return {const: pattern}
    if (pattern instanceof Array && pattern.length == 1) return {type: "array", items: _toSchema(pattern[0])}
    if (pattern instanceof Array) return {anyOf: pattern.map(_toSchema)}
    if (typeof pattern == "object"){
      if (pattern == null) return {type: "null"}
      if ("$const" in pattern) return {const: pattern["$const"] as JsonData}
      if ("$ref" in pattern) return pattern as Schema
      let props:{[key:string]: Schema} = {}
      let required:string[] = []
      let additionalProperties: Schema | undefined = undefined
      Object.entries(pattern).forEach(([k,v])=>{
        if (k == "[key:string]") {
          additionalProperties = _toSchema(v)
          return
        }
        if (k.startsWith("$")) k = k.slice(1)
        if (k.endsWith("?")) k = k.slice(0,-1)
        else required.push(k)
        props[k] = _toSchema(v)
      })
      let res: Schema = {type: "object", properties: props, required}
      if (additionalProperties) res.additionalProperties = additionalProperties
      return res
    }
    throw new Error("Invalid pattern: "+String(pattern))
  }


  if ( pattern && typeof pattern == "object"  && "$defs" in pattern ){
    return {
      $defs: Object.fromEntries(Object.entries(pattern.$defs as any).map(([k,v])=>[k, _toSchema(v as Pattern)])),
      ..._toSchema(pattern.pattern)
    }
  }
  return _toSchema(pattern)
}

export const format = (pattern: Pattern): string => {

  let defs = new Map<string, string>()

  let go = (p:Pattern): string=>{
    let register = (ref:string):string=>{
      let name = ref.split("/").slice(1).join("_") || "T"
      if (defs.has(name)) return name
      defs.set(name, "")
      defs.set(name, go(resolve(pattern, ref)))
      return name
    }

    if (p == String) return "string"
    if (p == Number) return "number"
    if (p == Boolean) return "boolean"
    if (typeof p == "string" || typeof p == "number" || typeof p == "boolean" || p === null) return JSON.stringify(p)
    if (p instanceof Array && p.length == 1) return `${go(p[0])}[]`
    if (p instanceof Array) return `(${p.map(go).join(" | ")})`
    if (typeof p == "object"){
      if (p == null) return "null"
      if ("$const" in p) return JSON.stringify(p["$const"])
      if ("$ref" in p) return register(p["$ref"] as string)
      let props = Object.entries(p).map(([k,v])=>{
        if (k.startsWith("$")) k = k.slice(1)
        return `${k}: ${go(v)}`
      })
      return `{${('\n'+props.join(",\n")).replaceAll("\n", "\n  ")}\n}`
    }
    throw new Error("Invalid pattern: "+String(p))
  }
  let end = go(pattern)
  return Array.from(defs.keys()).map(k=>`type ${k} = ${defs.get(k)}`).join("\n") + "\n" +end
}

export const resolve = (pattern: Pattern, ref: string): Pattern =>{
  if (typeof ref != "string" || !ref.startsWith("#")) throw new Error(`Invalid reference ${ref}`)
  let parts = (ref as string).split("/").slice(1)
  let target: Pattern = pattern
  for (let part of parts){
    if (typeof target != "object" || target == null || !(part in target)) throw new Error(`Invalid reference ${ref}`)
    target = (target as any)[part]
  }
  return target
}

export const validate = (pattern: Pattern, data: JsonData): JsonData => {

  let go = (p:Pattern, d:JsonData, path: string[]) =>{

    const raise = (msg:string) => {throw new Error(`Validation error at ${path.join(".")}:\n${format(p)}\nvs data: ${stringify(d)}\n${msg}`)}
    const assert = (condition:any, msg?:string) => {if (!condition) raise(msg || "assertion failed")}

    if (p == String) return assert(typeof d == "string")
    if (p == Number) return assert(typeof d == "number")
    if (p == Boolean) return assert(typeof d == "boolean")
    if (typeof p == "string" || typeof p == "number" || typeof p == "boolean" || p === null) return assert(d === p, `expected constant ${String(p)}`)
    if (p instanceof Array && p.length == 1){
      assert(d instanceof Array, `expected array`);
      (d as JsonData[]).forEach((x,i)=>go(p[0]!, x, [...path, String(i)]))
      return
    }
    if (p instanceof Array){
      if (p.length == 1){
        assert(d instanceof Array, `expected array`);
        (d as JsonData[]).forEach((x,i)=>go(p[0]!, x, [...path, String(i)]))
        return
      }
      for (let option of p){
        try{
          go(option, d, path)
          return
        }catch(e){}
      }
      raise(`expected to match one of the options`)
    }
    if (typeof p == "object"){
      if (p == null) return assert(d === null, "expected null")
      if ("$const" in p) return assert(JSON.stringify(d) === JSON.stringify(p["$const"]), `expected constant ${JSON.stringify(p["$const"])}`)
      if ("$ref" in p){
        let ref = p["$ref"]
        return go(resolve(pattern, ref as string), d, path)
      }
      if ("$defs" in p) return go(p.pattern, d, path)

      if (typeof d != "object" || d == null || Array.isArray(d)) raise(`expected object`)
      Object.entries(d as {[key:string]: JsonData}).forEach(([k,v])=>{
        if (k in p) return go((p as any )[k]!, v, [...path, k])
        if (k + "?" in p) return go((p as any)[k+"?"]!, v, [...path, k])
        assert ("[key:string]" in p, `unexpected property ${k}`)
        return go((p as any)["[key:string]"], v, [...path, k])
      })
      Object.keys(p).forEach(k=>assert(k == "[key:string]" || k.endsWith("?") || k in (d as object), `missing required property ${k}`))
    }
  }
  go(pattern, data, [])
  return data
}

export const fromSchema = (schema: Schema): Pattern => {
  if ("const" in schema) return schema.const as ConstPattern
  if (schema.type == "string") return String
  if (schema.type == "number") return Number
  if (schema.type == "boolean") return Boolean
  if (schema.type == "null") return null
  if (schema.type == "array" && "items" in schema) return [fromSchema(schema.items as Schema)]
  if ("anyOf" in schema && schema.anyOf instanceof Array) return schema.anyOf.map(s=>fromSchema(s as Schema))
  if (schema.type == "object"){
    let res: ObjectPattern = {}
    if ("properties" in schema){
      Object.entries(schema.properties as {[key:string]: Schema}).forEach(([k,v])=>{
        res[(schema.required instanceof Array && schema.required.includes(k)) ? k : k+"?"] = fromSchema(v)
      })
    }
    if ("additionalProperties" in schema) res["[key:string]"] = fromSchema(schema.additionalProperties as Schema)
    return res
  }
  throw new Error("Unsupported schema: "+JSON.stringify(schema))

}

