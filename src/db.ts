// import spacetimedb from "../backend/spacetimedb/src"
import { hash } from "./hash"
import { LocalStored, storage } from "./helpers"
import { fillSchema, Schema, validate, type JsonData } from "./struct"
import { DbConnection } from "./module_bindings"
import { errorpopup } from "../web/html"


export type BaseStored = {
  key:string,
  get: ()=>Promise<JsonData | undefined>,
  set: (data:JsonData)=>Promise<void>
}

export type Stored <T extends JsonData> = {
  key:string,
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
    key:base.key,
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
  signup(arg: {userid:string, passhash:string}):Promise<void>
  userid: string,
  changePassword(newPassword:string):Promise<void>
  get<T extends JsonData>(key:string, schema:Schema, owner?:string): Stored<T>
}

let rand = (digits:number) => Math.floor(Math.random()*10**digits).toString().padStart(digits, "0")


const mkkey = (owner:string, key:string) => owner.replaceAll(":", "_:") + ":" + key


export type User = {userid: string, passhash: string}
export const User:Schema = Schema.object({
  userid: Schema.string,
  passhash: Schema.string,
}, ['userid', 'passhash'])

export const randUser = ()=>({userid: 'u' + rand(4), passhash: hash(rand(6))})

export const RemoteDB = async ():Promise<DB> => new Promise((res,err)=>{
  DbConnection.builder()
  .withUri("wss://maincloud.spacetimedb.com/lexxtract")
  .withDatabaseName("lexxtract")
  .onConnect(c=>{
    let localUser = LocalStored<User>("current_user_remote_hashed", User, randUser())
    console.log(localUser.get())
    let pwd = ()=> localUser.get().passhash

    const signup = async (args:{userid:string, passhash:string}) => {
      console.log("Signing up user", args.userid)
      let res = await c.procedures.signup(args)
      if (res.tag == "Success"){
        localUser.set(args)
        db.userid = args.userid
      }else errorpopup("error signing up")
    }

    console.log("make db")

    let db:DB = {
      userid: localUser.get().userid,
      
      signup,
      async changePassword(newPassword: string) {
        let newhash = hash(newPassword)
        let res = await c.procedures.changePassword({userid: db.userid, passhash:pwd(), newPasshash: newhash})
        if (res.tag != "Success") throw new Error("Failed to change password")
        signup({userid: db.userid, passhash: newhash})
      },

      get<T extends JsonData>(key: string, schema: Schema, owner?: string) {

        let schema_key = key + hash(JSON.stringify(schema))
        owner ||= db.userid
        let owner_key = mkkey(owner, schema_key)

        let base:BaseStored = {
          key,
          get: ()=> new Promise<JsonData | undefined>((rs, rj)=>{
            let sub = c.subscriptionBuilder()
            .onApplied(c=>{
              let r= c.db.storage.owner_key.find(owner_key)
              if (!r) return rs(undefined)
              rs(JSON.parse(r.value) as JsonData)
              sub.unsubscribe()
            })
            .onError(e=>{
              console.error("DB subscription error", e)
              sub.unsubscribe()
              rj(e)
            })
            .subscribe(`select * from storage where owner_key = '${owner_key}'`)
          }),
          async set(data:JsonData){
            let res = await c.procedures.setitem({owner, passhash: pwd(), key: schema_key, value: JSON.stringify(data)})
            if (res.tag != "Success") throw new Error("Failed to set item in DB")
          }
        };
        return mkStored<T>(base, schema)
      }
    }
    console.log("signin")
    db.signup(localUser.get()).then(()=>res(db))
    .catch(()=>{
      db.signup(randUser())
    })
  })
  .onConnectError(e=>{
    console.error("Failed to connect to DB", e)
    err(e)
  })
  .build()
})


let test = async ()=>{
  let db = await RemoteDB()
  let test_schema:Schema = {
    type: "object",
    properties: {
      name: {type: "string"},
    },
  }
  let item = db.get("test_item", test_schema)
  item.set({name: "Alice"})
  let data = await item.get()
  console.log("Got data", data)
}