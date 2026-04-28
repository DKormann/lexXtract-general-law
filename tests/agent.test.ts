import { mkRunner } from "../controller/agent_functions";
import { createModule, db } from "../controller/app";

console.log("Running agent tests")

let module = await createModule({name: "test", owner: db.userid}, mod=>{
  console.log("Module updated", mod)
})


module.taxonomy.set({categories: {}})
console.log("Functions in module:", Object.keys(module.functions.get()));

let getfunc = (f:string) => mkRunner(module, module.functions.get()[f]!)
let viewTaxonomy = getfunc("viewTaxonomy")
let addCategory = getfunc("addCategory")
let addSubcategory = getfunc("addSubcategory")

console.log("Initial taxonomy", await viewTaxonomy({}))

let categories = [
  "Legal",
  "Financial",
  "Technical",
  "Personal",
  "Investment",
  "Health",
  "Education",
  "Entertainment",
  "Travel",
  "Food"
]

for (let cat of categories) {
  await addCategory({categoryName: cat})
}

console.log("After all categories added", await viewTaxonomy({}))



db.disconnect()



