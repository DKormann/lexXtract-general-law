// import spacetimedb from "../backend/spacetimedb/src"
import { hash } from "./hash"
import { LocalStored, storage } from "./helpers"
import { fillSchema, validate, type JsonData, type Schema } from "./struct"
import { DbConnection } from "./module_bindings"


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

export const localDB= async():Promise<DB> =>{



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
      owner = owner || db.userid
      let rkey = owner+"."+key+ hash(JSON.stringify(schema))
      // console.log("Getting DB key", rkey)
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

{

  console.log("Connecting to DB...")

  DbConnection.builder()
  .withUri("wss://maincloud.spacetimedb.com/lexxtract")
  .withDatabaseName("lexxtract")
  .onConnect(c=>{

    let userid = "bob"
    let passhash = hash("password123")


    c.reducers.signup({userid, passhash}).then(()=>{
      console.log("Signed up")
    })

  })
  .onConnectError(e=>{
    console.error("Failed to connect to DB", e)
  })
  .build()
}

const mkkey = (owner:string, key:string) => owner.replaceAll(":", "_:") + ":" + key


export const RemoteDB = async ():Promise<DB> => new Promise((res,err)=>{
  DbConnection.builder()
  .withUri("wss://maincloud.spacetimedb.com/lexxtract")
  .withDatabaseName("lexxtract")
  .onConnect(c=>{
    console.log("Connected to DB")
    let randu = ()=>({userid: 'u' + rand(4), password: rand(6)})
    let localUser = LocalStored<{userid: string, password: string} >("current_user_remote", randu())
    let pwd = ()=>hash(localUser.get().password)

    let db:DB = {
      userid: localUser.get().userid,
      async signup(userid: string, password: string) {
        await c.reducers.signup({userid, passhash:pwd()})
        localUser.set({userid, password})
        db.userid = userid
      },
      async logout(){
        localUser.set(randu())
        db.userid = localUser.get().userid
      },
      async changePassword(newPassword: string) {
        let local = localUser.get()
        if (!local) throw new Error("No user logged in")
        await c.reducers.changePassword({userid: db.userid, passhash:pwd(), newPasshash: hash(newPassword)})
        localUser.set({userid: local.userid, password: newPassword})
      },

      get<T extends JsonData>(key: string, schema: Schema, owner?: string) {

        key += hash(JSON.stringify(schema))
        owner ||= db.userid
        let rkey = mkkey(owner, key)

        let base:BaseStored = {
          get: ()=> new Promise<JsonData | undefined>((rs, rj)=>{
            console.log("Subscribing to DB key", rkey)
            c.subscriptionBuilder()
            .onApplied(c=>{
              console.log("DB update applied, checking for key", rkey)
              let r= c.db.storage.owner_key.find(rkey)
              if (!r) return rs(undefined)
              rs(JSON.parse(r.value) as JsonData)
            })
            .onError(e=>{
              console.error("DB subscription error", e)
              rj(e)
            })
            .subscribe(`select * from storage where owner_key = '${rkey}'`)
            
          }),
          async set(data:JsonData){
            c.reducers.setitem({owner, passhash: pwd(), key, value: JSON.stringify(data)})
          }
        };
        return mkStored<T>(base, schema)
      }
    }

    db.signup(db.userid, localUser.get().password).then(()=>{
      console.log("Signed up to remote DB as", db.userid)
      res(db)
    })
  })
  .onConnectError(e=>{
    console.error("Failed to connect to DB", e)
    err(e)
  })
  .build()
})


{
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