import { hash } from "./hash"
import { LocalStored, storage } from "./helpers"
import { fillSchema, validate, type JsonData, type Schema } from "./struct"


export type BaseStored = {
  get: ()=>Promise<JsonData | undefined>,
  set: (data:JsonData)=>Promise<void>
}

export type Stored <T extends JsonData> = {
  schema: Schema,
  get: ()=>Promise<T>,
  set: (data:T)=>Promise<void>
  onupdate: (listener:()=>void)=>void
  update: (updater: (data:T)=>T | Promise<T> | void) => Promise<void>
  default: (t:T)=>Stored<T>
}

const mkStored = <T extends JsonData>(base: BaseStored, schema: Schema): Stored<T> => {
  let listeners: (()=>void)[] = []
  let update = async (updater: (data:T)=>T | Promise<T> | void) => {
    let data = await base.get() as T
    let newData = await updater(data)
    if (newData) await base.set(newData)
  }
  let res : Stored<T> = {
    get: async ()=>{
      let res = await base.get() as T
      if (res == undefined) return res = fillSchema(schema) as T
      return res
    },
    set: async (data:T)=>{
      validate(schema, data)
      await base.set(data)
      listeners.forEach(l=>l())
    },
    schema,
    onupdate: listeners.push.bind(listeners),
    update,
    default: (t:T)=>{
      return {
        ...res,
        get: async ()=>{
          let data = await base.get() as T
          if (data == undefined){
            await res.set(t)
            return t
          }
          return data
        }
      }
    }
  }
  return res
}



export type DB = {
  signup(userid:string, password:string):Promise<void>
  logout():Promise<void>
  userid: string,
  changePassword(newPassword:string):Promise<void>
  get<T extends JsonData>(key:string, schema:Schema, owner?:string): Stored<T>
}

let rand = (digits:number) => Math.floor(Math.random()*10**digits).toString().padStart(digits, "0")

export const localDB: ()=>DB = ()=>{

  let randu = ()=>({userid: 'u' + rand(4), password: rand(6)})

  let localUser = LocalStored<{userid: string, password: string} >("current_user", randu() )

  let users = LocalStored<{[userid:string]: string}>("users", {})



  let db:DB = {
    userid : localUser.get().userid,

    async signup(userid: string, password: string) {
      let usersData = users.get()
      if (userid in usersData && usersData[userid] != hash(password)) throw new Error("user exists")
      localUser.set({userid, password})
      users.set({...usersData, [userid]: hash(password)})
      db.userid = userid
    },
    async logout(){
      localUser.set(randu())
      db.userid = localUser.get().userid
    },
    async changePassword(newPassword: string) {
      let local = localUser.get()
      if (!local) throw new Error("No user logged in")
      let usersData = users.get()
      if (!(local.userid in usersData) || usersData[local.userid] != hash(local.password)) throw new Error("Invalid password")
      users.set({...usersData, [local.userid]: hash(newPassword)})
      localUser.set({userid: local.userid, password: newPassword})
    },

    get<T extends JsonData>(key: string, schema: Schema, owner?: string) {
      let rkey = owner+"."+key+ hash(JSON.stringify(schema))
      let rowner = owner || db.userid
      let base:BaseStored = {
        async get(){
          let data = localStorage.getItem(rkey)
          if (!data) return undefined
          return JSON.parse(data) as JsonData
        },
        async set(data:JsonData){
          if (rowner != db.userid) throw new Error("Cannot set data for another user")
          localStorage.setItem(rkey, JSON.stringify(data))
        }
      };
      return mkStored<T>(base, schema)
    },
  }



  return db
}

