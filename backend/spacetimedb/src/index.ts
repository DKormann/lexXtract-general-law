import { schema, table, t } from 'spacetimedb/server';


const storage = table(
    { public: true },
    {
      owner_key: t.string().primaryKey(),
      value: t.string(),
    }
  )

const spacetimedb = schema({
  person: table(
    { public: false },
    {
      userid: t.string().primaryKey(),
      passhash: t.string(),
    },
  ),
  storage
});
export default spacetimedb;

export const init = spacetimedb.init(_ctx => {});
export const onConnect = spacetimedb.clientConnected(_ctx => {});
export const onDisconnect = spacetimedb.clientDisconnected(_ctx => {});

export const signup = spacetimedb.reducer(
  { userid: t.string(), passhash: t.string() },
  (ctx, { userid, passhash }) => {
    let prev = ctx.db.person.userid.find(userid)
    if (prev){
      if (prev.passhash != passhash) throw new Error("Incorrect password")
    }else{
      ctx.db.person.insert({ userid, passhash });
      console.log("New user signed up:", userid)
    }
  }
)

export const change_password = spacetimedb.reducer(
  { userid: t.string(), passhash: t.string(), new_passhash: t.string() },
  (ctx, { userid, passhash, new_passhash }) => {
    let prev = ctx.db.person.userid.find(userid)
    if (!prev || prev.passhash != passhash) throw new Error("Incorrect password")
    ctx.db.person.userid.update({userid, passhash})
  }
)

const mkkey = (owner:string, key:string) => owner.replaceAll(":", "_:") + ":" + key

export const setitem = spacetimedb.reducer(
  { owner: t.string(), passhash: t.string(), key: t.string(), value: t.string() },
  (ctx, { owner, passhash, key, value }) => {
    let prev = ctx.db.person.userid.find(owner)
    if (!prev) throw new Error("User not found:"+owner)
    if (prev.passhash != passhash) throw new Error("Incorrect password")
    let owner_key = mkkey(owner, key)
    let prev_item = ctx.db.storage.owner_key.find(owner_key)
    if (prev_item) ctx.db.storage.owner_key.update({owner_key, value})
    else ctx.db.storage.insert({ owner_key, value })
  }
)
