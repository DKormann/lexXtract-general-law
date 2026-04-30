// import { hash as crypto } from "crypto"
import { LocalStored, storage } from "./helpers"
import { stringify, type JsonData } from "./json"
import { DbConnection, type ErrorContext, type SubscriptionEventContext } from "./module_bindings"
import { fill, format, toSchema, validate, type Pattern } from "./pattern"

// export const hash = (s:string) => crypto("sha1", s)

export const hash = (str:string)=> {

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36); // Convert to base36 string
}



export type Stored <T extends JsonData> = {
  key:string,
  pattern: Pattern,
  get: ()=> T,
  set: (data:T)=>Promise<void>,
  onupdate: (listener:()=>void)=>void
  update: (updater: (data:T)=>T | Promise<T> | void) => Promise<void>
}

export type DB = {
  signup(arg: {userid:string, passhash:string}):Promise<void>
  userid: string,
  changePassword(newPassword:string):Promise<void>
  disconnect(): void
  get<T extends JsonData>(key:string, pattern:Pattern, owner?:string): Promise<Stored<T>>
  saving: number,
}

let rand = (digits:number) => Math.floor(Math.random()*10**digits).toString().padStart(digits, "0")
const mkkey = (owner:string, key:string) => owner.replaceAll(":", "_:") + ":" + key

export type User = {userid: string, passhash: string}
export const User:Pattern = {
  userid: String,
  passhash: String,
}

export const randUser = ()=>({userid: 'u' + rand(4), passhash: hash(rand(6))})



export const RemoteDB = async ():Promise<DB> => new Promise((res,err)=>{
  DbConnection.builder()
  .withUri("wss://maincloud.spacetimedb.com/lexxtract")
  .withDatabaseName("lexxtract")
  .onConnect((c)=>{
    let localUser = LocalStored<User>("current_user_remote_hashed", User, randUser())
    let pwd = ()=> localUser.get().passhash

    const signup = async (args:{userid:string, passhash:string}) => {
      let res = await c.procedures.signup(args)
      if (res.tag == "Success"){
        localUser.set(args)
        db.userid = args.userid
      }else throw new Error("error signing up")
    }

    const hot_cache = new Map<string, Stored<JsonData>>()
    


    let db:DB = {
      userid: localUser.get().userid,
      saving:0,
      
      signup,
      disconnect() {
        c.disconnect()
      },
      async changePassword(newPassword: string) {
        let newhash = hash(newPassword)
        let res = await c.procedures.changePassword({userid: db.userid, passhash:pwd(), newPasshash: newhash})
        if (res.tag != "Success") throw new Error("Failed to change password")
        signup({userid: db.userid, passhash: newhash})
      },

      async get<T extends JsonData>  (key: string, pattern: Pattern, owner?: string) {
        // let schema_key = key + hash(stringify(toSchema(pattern)))
        owner ||= db.userid
        let owner_key = mkkey(owner, key)
        if (!hot_cache.has(owner_key)){
          let cache:T = await new Promise<T>((rs, rj)=>{
            let sub = c.subscriptionBuilder()
            .onApplied((c: SubscriptionEventContext)=>{
              let r= c.db.storage.owner_key.find(owner_key)
              if (!r) return rs(fill(pattern) as T)
              let val = JSON.parse(r.value) as T
              try{validate(pattern, val)
              }catch(e){
                val = fill(pattern) as T
              }
              sub.unsubscribe()
              rs(val)
            })
            .onError((e: ErrorContext)=>{
              console.error("DB subscription error", e.event ?? e)
              sub.unsubscribe()
              rj(e.event ?? new Error("Unknown DB subscription error"))
            })
            .subscribe(`select * from storage where owner_key = '${owner_key}'`)
          })

          let cacheS = JSON.stringify(cache)

          const listeners: (()=>void)[] = []
          const set = async (data:T) =>{
            let newS = JSON.stringify(data)
            if (cacheS== newS){return}
            validate(pattern, data)
            cache = data as T
            cacheS = newS
            listeners.forEach(l=>l())
            db.saving++;
            await c.procedures.setitem({owner, passhash: pwd(), key, value: JSON.stringify(data)})
            .then((r)=>{
              db.saving--;
              if (r.tag != "Success"){throw new Error("Failed to set item in DB: " + JSON.stringify(r))}
            })
          }

          let stored : Stored<T> =  {
            key, pattern, get: ()=>cache, set,
            update: async x=> {
              let p = await x(cache)
              if (p!=undefined) set(p)
            },onupdate: f=>{
              console.log("added listener", owner_key)
              listeners.push(f)}
          }
          hot_cache.set(owner_key, stored as any as Stored<JsonData>)
        }
        return hot_cache.get(owner_key) as any as Stored<T>
      }
    }
    db.signup(localUser.get()).then(()=>res(db))
    .catch(()=>{
      db.signup(randUser())
    })
  })
  .onConnectError((_ctx: ErrorContext, e: Error)=>{
    console.error("Failed to connect to DB", e)
    err(e)
  })
  .build()
})
