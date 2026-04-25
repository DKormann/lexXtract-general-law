import type { FunctionDef } from "./agent_functions"

const f: {[k:string]:FunctionDef} = {
  "newCategory": {
    "parameters": {
      "catName": {
        "type": "string"
      }
    },
    "code": "return taxonomy.update(t=>{\n  console.log(\"Current taxonomy:\", t)\n  t.categories[catName || \"newCategory\"] = {\n    description: \"A new category\", subCategories: {}\n  }\n  return t\n})",
    "reads": [
      "documents",
      "taxonomy"
    ],
    "writes": [
      "taxonomy"
    ]
  },
  "removeCategory": {
    "description": "remove any Category from the taxonomy",
    "parameters": {
      "catName": {
        "type": "string"
      }
    },
    "code": "return taxonomy.update(t=>{delete t.categories[catName];console.log(t);return t})",
    "reads": [
      "taxonomy"
    ],
    "writes": [
      "taxonomy"
    ]
  },

  "addSubCategory": {
    "parameters": {
      "catName": {
        "type": "string",
      },
      "subCatName":{"type": "string"},
    },
    "description": "add a new subcategory to any category in the taxonomy",
    "code": "return taxonomy.update(t=>{\n  console.log(\"Current taxonomy:\", t)\n  if (!t.categories[catName]) t.categories[catName] = {description: \"\", subCategories:{}}\n  t.categories[catName].subCategories[subCatName || \"newSubCategory\"] = {description: \"A new subcategory\", itemSchema:{type:\"object\", properties:{}}}\n  return t\n})",
    "reads": [
      "documents",
      "taxonomy"
    ],
    "writes": [
      "taxonomy"
    ]

  },

  "listCategories": {
    "description": "list all available Categories int the current Taxonomy",
    "parameters": {},
    "code": "return taxonomy.get()",
    "reads": [
      "taxonomy"
    ]
  }
}