import { hash } from "./hash"
import { validate } from "./helpers"

// export type JsonData = string | number | boolean | null | JsonData[] | {[key:string]:JsonData}
export type JsonData = string | {[ key: string ]: JsonData}

export type Schema =
({
  type: "string"
} | {
  type: "object",
  properties :{[key:string]:Schema},
  required?: string[],
  additionalProperties?: Schema
}) & {
  description?: string
  style: string
}

type Hash = string
type Uname = string

type Secret = {name:Uname, secret:string}

type Path = {
  owner: Uname
  schema: Schema,
  location: (string|number)[]
}

type Ref = {$:"hash", val:Hash} | {$:"ref", val:Path}

type DB = {
  setConst : (d:JsonData)=>Promise<void>
  getConst : (key:Hash)=>Promise<JsonData|undefined>
  signup: (user: Secret)=>Promise<boolean>
  store: (user: Secret, key: Path, val: Hash)=>Promise<boolean>
  request:(key:Path)=>Promise<JsonData|undefined>
}



const localDB:DB= {
  setConst: async (d:JsonData)=>{
    let s = JSON.stringify(d)
    localStorage.setItem(hash(s), s)
  },
  getConst: async (key:Hash)=>{
    let d = localStorage.getItem(key)
    return d ? JSON.parse(d) : d
  },
  signup: async(user)=>{
    let ukey = "USER:"+user.name
    if (localStorage.getItem(ukey)) return false
    localStorage.setItem(ukey, hash(user.secret))
    return true
  },
  store: async(user, key, val)=>{
    let ukey = "USER:"+user.name
    let us = localStorage.getItem(ukey)
    if (!us || us != hash(user.secret)) return false
    localStorage.setItem(hash(JSON.stringify(key)), val)
    return true
  },
  request: async(key)=>{
    let r = localStorage.getItem(hash(JSON.stringify(key)))
    return r ? JSON.parse(r) : r
  }
}

type WString = {
  $: "string",
  get: ()=>string,
  set: (s:string)=>void,
}

type WObj = {
  $:"object",
  properties:()=>{[key:string]:Schema},
  required:()=>string[],
  additionalProperties?: Schema,

  keys:()=>string[],
  get: (key:string)=>Writable | undefined,
  set:(key:string, val?:JsonData)=>void,
  del:(key:string)=>void
}

type Writable = (WString | WObj) & {
  path: Path,
  onupdate: (f:()=>void)=>void
}

let user:Secret = {
  name:"local",
  secret:"123"
}


const mkWritable = (path: Path, schema: Schema, value?:JsonData): Writable =>{
  let subscribers: (()=>void)[] = []
  let broadcast = ()=> subscribers.forEach(f=>f())
  if (schema.type == "string"){
    if (value && typeof value != "string") throw new Error("Initial value should be string")
    let val  = value ?? ""
    return {
      $:"string",
      path,
      get: () => val,
      set: (s:string)=>{
        val = s
        broadcast()
      },
      onupdate: (f)=> subscribers.push(f)
    }
  }else if (schema.type == "object"){

    let val : {[key:string]:Writable} = {}

    let set = (key:string, v?:JsonData) => {
      let sc = (schema.properties && schema.properties[key]) ?? schema.additionalProperties
      if (!sc) throw new Error(`Key ${key} not allowed in schema`)
      val[key] = mkWritable({...path, location:[...path.location, key]}, sc, v)
      broadcast()
    }
    if (typeof value != "object") throw new Error("Initial value should be object")
    Object.entries(value).forEach(([k,v])=>set(k,v))

    return {
      $:"object",
      path,
      properties: () => schema.properties || {},
      required: () => schema.required || [],
      additionalProperties: schema.additionalProperties,
      keys: () => Object.keys(val),
      get: (key:string)=> val[key],
      set,
      del:(key:string)=>{
        delete val[key]
        broadcast()
      },
      onupdate: subscribers.push
    }
  }
  throw new Error("Unsupported schema type")
}


export const modules : Writable[] = []


export type Module = {
  prompt:string,
  taxonomy: Schema,
  source: {[title:string]:string},
  extraction: Writable
}

