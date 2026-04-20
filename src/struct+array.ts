
import { hash } from "./hash"
import { validate } from "./helpers"



export type Schema =
({
  type: "string"
} | {
  type: "array",
  items: Schema
} | {
  type: "object",
  properties :{[key:string]:Schema},
  required?: string[],
  additionalProperties?: Schema
}) & {
  description?: string
  style: string
}

export type JsonData = string | {[ key: string ]: JsonData} | JsonData[]




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



type Write< $ extends string, T> = {
  $: $,
  get:()=>T,
  set:(v:T)=>void,
  onupdate:(f:()=>void)=>void
}


