// import { db } from "../src/app";
import { db } from "../controller/app";
import { assert, assertEqualJSON, runTests } from "./test";



await runTests(
  async function testStore(){
    let item = db.get("test", {content: String})

    await item.set({content:"hello"})
    let val = await item.get()
    assertEqualJSON(val, {content:"hello"})
  },

  async function testItemsSync(){
    let item = db.get<{synced: string}>("testSyncItem", {synced: String})
    
    let innerval = {synced: "sync0"}
    let updated = false
    item.onupdate(()=>{
      updated = true
    })
    await item.set(innerval)
    assert(updated, "Update callback was not called")
  },
  async function testItemsCrossSync(){
    let item1 = db.get<{synced: string}>("testCrossSyncItem", {synced: String})
    let item2 = db.get<{synced: string}>("testCrossSyncItem", {synced: String})

    let updated = false
    item2.onupdate(()=>{
      updated = true
    })
    await item1.set({synced: "crosssync"})
    assert(updated, "Update callback was not called on cross-sync")
    let val2 = await item2.get()
    assertEqualJSON(val2, {synced: "crosssync"}, "Cross-synced value did not match expected")
  }
)


db.disconnect()

