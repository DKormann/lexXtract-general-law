import { errorpopup } from "../web/html";
import { Stored } from "./helpers";
import { localDB, Schema } from "./struct";


let rand = (d:number) => String(Math.random()).slice(-d)

export const userid = Stored<{userid:string, password:string}>("userid",  {userid: "u"+rand(4), password: rand(8)}).get()!
export const db = localDB


db.signup(userid.userid, userid.password).catch(e=>{
  errorpopup("Error signing up: "+String(e))
})

export const userName = db.get("username", Schema.string)

export const ModuleList = db.get("modules", Schema.array(Schema.string))


