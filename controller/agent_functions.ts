import { button, div, errorpopup, h2, h3, p, popup, pre, style } from "../view/html";
// import { jsonView, viewer } from "../web/viewer";
import type { Stored } from "../model/db";
import { stringify, type JsonData, type JSONSchema } from "../model/json";
import type { FunctionDef, Module } from "../model/types";
import { fill, fromSchema, SchemaPattern, toSchema, validateSchema, type Pattern } from "../model/pattern";


const CapabilityPattern: Pattern = ["taxonomy", "documents", "prompt", "functions", "extraction"]



export const FunctionDefPattern: Pattern = {
  "description?": String,
  "reads?": [CapabilityPattern],
  "writes?": [CapabilityPattern],
  parameters: {"[key:string]": SchemaPattern},
  code: String
}

export const mkRunner = (module:Module, v: FunctionDef): (args:{[key:string]:JsonData})=>Promise<JsonData> =>{

  return  async (args:{[key:string]:JsonData})=>{
    validateSchema({type: "object", properties: v.parameters, required: Object.keys(v.parameters)}, args)
    let reads = v.reads || []
    let writes = v.writes || []

    new Set(reads.concat(writes)).forEach(cap=>{
      let section = module[cap as keyof Module] as Stored<any>
      args[cap] = {
        ...(reads.includes(cap) ? {get: section.get as any} : {}),
        ...(writes.includes(cap) ? {set: section.set} as any : {}),
        ...(reads.includes(cap) && writes.includes(cap) ? {update: section.update} as any : {})
      }
    })
    let func = new Function(...Object.keys(args), v.code)
    return await func(...Object.values(args)) || "OK" as JsonData
  }


}



export const default_functions: {[key:string]: FunctionDef} = {
  viewTaxonomy: {
    description: "a function that returns the taxonomy",
    parameters: {},
    reads: ["taxonomy"],
    code: `return taxonomy.get()`
  },
  addCategory: {
    description: "add a category to the taxonomy",
    parameters: {
      categoryName: {type: "string"},
    },
    reads: ["taxonomy"],
    writes: ["taxonomy"],
    code: `
      taxonomy.update((t)=>{
        categoryName ||= "newCat"
        console.log("adding category", categoryName)
        if (t.categories[categoryName]) return t
        t.categories[categoryName] = {description: "a category", subCategories:{}}
        return t
      })
      `
  },
  removeCategory: {
    description: "remove any Category from the taxonomy",
    parameters: {
      catName: {
        type: "string"
      }
    },
    reads: [
      "taxonomy"
    ],
    writes: [
      "taxonomy"
    ],
    code: "taxonomy.update(t=>{delete t.categories[catName];console.log(t);return t})",
  },
  addSubcategory: {
    description: "a function that adds a subcategory to the taxonomy",
    parameters: {
      categoryName: {type: "string"},
      subcategoryName: {type: "string"},
    },
    reads: ["taxonomy"],
    writes: ["taxonomy"],
    code: `
      taxonomy.update((t)=>{
        if (!t.categories[categoryName]) throw new Error("invalid category")
        subcategoryName ||= "newSubcat"
        if (t.categories[categoryName].subCategories[subcategoryName]) return t
        t.categories[categoryName].subCategories[subcategoryName] = {description: "a subcategory"}
        return t
      })
      `
  },
  removeSubCategory: {
    description: "remove any SubCategory from the taxonomy",
    parameters: {
      catName: {
        type: "string"
      },
      subCatName: {
        type: "string"
      }
    },
    reads: [
      "taxonomy"
    ],
    writes: [
      "taxonomy"
    ],
    code: "taxonomy.update(t=>{delete t.categories[catName].subCategories[subCatName];console.log(t);return t})",
  },
  addExtraction: {
    description: "a function that adds an extraction to the extraction db",
    parameters: {
      categoryName: {type: "string"},
      subcategoryName: {type: "string"},
      title: {type: "string"},
      depiction: {type: "string"},
      content: {type: "string"},
    },
    reads: ["taxonomy", "extraction"],
    writes: ["extraction"],
    code: `
      extraction.update(e=>{
        if (!e[categoryName]) e[categoryName] = {}
        if (!e[categoryName][subcategoryName]) e[categoryName][subcategoryName] = {}
        e[categoryName][subcategoryName][title] = {depiction, content}
        return e
      })
    `
  },
  viewDocuments:{
    description: "view all documents",
    parameters: {},
    reads: ["documents"],
    code: `
      return documents.get()
      `
  },
  viewExtractions: {
    description: "a function that views extractions for a given category and subcategory",
    parameters: {
      categoryName: toSchema(["ALL", String]),
      subcategoryName: toSchema(["ALL", String])
    },
    reads: ["extraction"],
    code: `
      return extraction.get().then(e=>{
        if (categoryName == "ALL") return e
        if (!e[categoryName]) throw new Error("invalid category")
        if (subcategoryName == "ALL") return e[categoryName]
        return e[categoryName][subcategoryName]
      })
      `
  }
}


// export const mkFunctions = async (module:Module):Promise<Stored<{
//     [key: string]: FunctionDef;
// }>> =>{

//   // const extraction = module.db<JsonData>("extraction", {"[category:string]": {"[subcategory:string]": {"[title:string]": {depiction: String, content: String}}}})


//   const functions = module.db<{[key:string]: FunctionDef}>("functions", {"[key:string]": FunctionDefPattern})

//   await functions.get().then(funcs=>{
//     // if (stringify(funcs) == "{}")
//     {
//       return functions.set({
//         viewTaxonomy: {
//           description: "a function that returns the taxonomy",
//           parameters: {},
//           reads: ["taxonomy"],
//           code: `return taxonomy.get()`
//         },
//         addCategory: {
//           description: "add a category to the taxonomy",
//           parameters: {
//             categoryName: {type: "string"},
//           },
//           reads: ["taxonomy"],
//           writes: ["taxonomy"],
//           code: `
//             return taxonomy.update((t)=>{
//               categoryName ||= "newCat"

//               if (t.categories[categoryName]) return t
//               t.categories[categoryName] = {description: "a category", subCategories:{}}
//               return t
//             })
//            `
//         },
//         addSubcategory: {
//           description: "a function that adds a subcategory to the taxonomy",
//           parameters: {
//             categoryName: {type: "string"},
//             subcategoryName: {type: "string"},
//           },
//           reads: ["taxonomy"],
//           writes: ["taxonomy"],
//           code: `
//             return taxonomy.update((t)=>{
//               if (!t.categories[categoryName]) throw new Error("invalid category")
//               subcategoryName ||= "newSubcat"
//               if (t.categories[categoryName].subCategories[subcategoryName]) return t
//               t.categories[categoryName].subCategories[subcategoryName] = {description: "a subcategory"}
//               return t
//             })
//            `
//         },
//         addExtraction: {
//           description: "a function that adds an extraction to the extraction db",
//           parameters: {
//             categoryName: {type: "string"},
//             subcategoryName: {type: "string"},
//             title: {type: "string"},
//             depiction: {type: "string"},
//             content: {type: "string"},
//           },
//           reads: ["taxonomy", "extraction"],
//           writes: ["extraction"],
//           code: `
//             return taxonomy.get().then(t=>{
//               if (!t.categories[categoryName] || !t.categories[categoryName].subCategories[subcategoryName]) throw new Error("invalid category or subcategory")
//               return extraction.update(e=>{
//                 if (!e[categoryName]) e[categoryName] = {}
//                 if (!e[categoryName][subcategoryName]) e[categoryName][subcategoryName] = {}
//                 e[categoryName][subcategoryName][title] = {depiction, content}
//                 return e
//               })
//             })
//           `
//         },
//         viewDocuments:{
//           description: "view all documents",
//           parameters: {},
//           reads: ["documents"],
//           code: `
//             return documents.get()
//            `
//         },
//         viewExtractions: {
//           description: "a function that views extractions for a given category and subcategory",
//           parameters: {
//             categoryName: toSchema(["ALL", String]),
//             subcategoryName: toSchema(["ALL", String])
//           },
//           reads: ["extraction"],
//           code: `
//             return extraction.get().then(e=>{
//               if (categoryName == "ALL") return e
//               if (!e[categoryName]) throw new Error("invalid category")
//               if (subcategoryName == "ALL") return e[categoryName]
//               return e[categoryName][subcategoryName]
//             })
//            `
//         }
//       })
//     }
//   })

//   return functions;


// }
