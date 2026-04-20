
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
  style?: string
}

export const fillSchema = (schema:Schema):JsonData=>{
  if (schema.type == "string") return ""
  if (schema.type == "array") return []
  if (schema.type == "object"){
    return Object.fromEntries((schema.required ?? []).map(k=> [k, fillSchema(schema.properties[k]!)]))
  }
  throw new Error("Invalid schema")
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


type Write< $ extends string, T, S> = {
  $: $,
  get:()=>T,
  set:(v:S)=>void,
  onupdate:(f:()=>void)=>void,
  schema: Schema
}


type Wstring = Write<"string", string, string>
type Warray = Write<"array", Witem[], JsonData[]> & {del:(i:number)=>void, add:()=>void}
type Wobject = Write<"object", {[key:string]: Witem}, {[key:string]: JsonData}> & {delkey:(key:string)=>void, addkey:(key:string)=>void}
export type Witem = Warray | Wstring | Wobject




export const Mod = (location:(string|number)[], schema:Schema, content:JsonData):Witem => {
  validate(schema, content)
  let subs :(WeakRef<()=>void>)[] = []
  let onupdate = (f:()=>void)=> subs.push(new WeakRef(f))
  let update = ()=>{

    subs = subs.filter(s=>{
      let f = s.deref()
      if (f) f()
      return f
    })
  }
  if (schema.type == "string") return { $: "string", onupdate, set:c=>{content = c; update()}, get:()=>content as string, schema }
  if (schema.type == "array"){
    let children:Witem[] = []
    let write = (c:JsonData)=>{
      content = c
      children = (content as JsonData[]).map((c, i)=> Mod([...location, i], schema.items, c))
    }
    write(content)

    return {$:"array", onupdate, set: c=>{write(c); update()}, get:()=>children, schema, del:(i)=>{children.splice(i, 1); update()}, add:()=>{children.push(Mod([...location, children.length], schema.items, fillSchema(schema.items))); update()}}
  }
  if (schema.type == "object"){
    let children:{[key:string]: Witem} = {}
    let write = (c:{[key:string]: JsonData})=>{
      Object.entries(c).forEach(([k,v])=>{
        if (schema.properties[k]) children[k] = Mod([...location, k], schema.properties[k], v)
      })
    }
    write(content as {[key:string]: JsonData})
    return {$:"object", onupdate, set:(c)=>{write(c); update()}, get:()=>children, schema, delkey:(key)=>{
      if (schema.required?.includes(key)) throw new Error("cannot delete required key "+key)
      children = Object.fromEntries(Object.entries(children).filter(e=>e[0]!=key))
      update()
      },
      addkey:(key)=>{
        let s = schema.properties[key] ?? schema.additionalProperties
        if (s==undefined) throw new Error("cannot add "+key)
        let d = fillSchema(s)
        children[key] = Mod([...location, key],s,d)
        update()
      }
    }
  }
  throw new Error("Invalid schema")
}



let test = false
if (test){

  let Mod0 = Mod(["test"], {type:"array", items:{type:"string"}}, ["hello", "world"])

  console.log(Mod0.get())

  let l1 = (Mod0.get() as Witem[])[1] as Wstring
  let l2 = (Mod0.get() as Witem[])[1] as Wstring

  l2.onupdate(()=>{
    console.log("l2 updated to ", l2.get())
  })
  l1.set("there")

}
