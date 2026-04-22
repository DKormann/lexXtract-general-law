// import { Role, type ExtractionItem, type Schema } from "./schemas"
import type { Schema } from "./struct"
import gdpr from "./gdpr.json"

let browser = typeof window !== "undefined"


let format = (template:string, data:{[key:string]: string}):string=>{
  Object.entries(data).forEach(([k,v])=>{
    if (!template.includes(`{${k}}`)) throw new Error(`Placeholder {${k}} not found in template`)
    template = template.replaceAll(`{${k}}`, v)
  })
  return template
}


export const storage = browser ?
  localStorage:
  (()=>{
    const db = new Map<string, string>()
    return {
      setItem:(key: string, value: string)=> {db.set(key, value)},
      getItem:(key: string): string | null => db.get(key) ?? null,
      clear:()=> {db.clear()}
    }
  })()

const cache_func = <T extends Function>  (f:T ):T =>{
  let fnhash = f.toString()
  return (((...args:any[])=>{
    let key = JSON.stringify([fnhash, args])
    let res = storage.getItem(key)
    if (res) {
      let p = JSON.parse(res) as {async:boolean, value:any}
      if (p.async) return Promise.resolve(p.value)
      else return p.value
    }
    
    let dat = f(...args)
    if (dat instanceof Promise){
      return dat.then(value=>{
        storage.setItem(key, JSON.stringify({async:true, value}))
        return value
      })
    }
    storage.setItem(key, JSON.stringify({async:false, value:dat}))
    return dat
  }) as unknown as T)
}


export type LocalStored<T> = {
  get:()=>T,
  set:(val:T)=>void,
  // del:()=>void
}
export const LocalStored = <T>(key:string, default_value:T):LocalStored<T> =>{
  const set = (val:T)=> {
    console.log(key, JSON.stringify(val, null, 2))
    storage.setItem(key, JSON.stringify(val))
  }

  if (storage.getItem(key) == null || storage.getItem(key) == "null") set(default_value)
  return {
    get:()=>{
      let val = storage.getItem(key)
      if (val == undefined || val === "undefined") throw new Error("No value found for key " + key)
      if (val) return JSON.parse(val) as T
      return default_value
    },
    set,
  }
}

