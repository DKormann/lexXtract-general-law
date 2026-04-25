import type { FunctionDef } from "../web/agent_functions"
import type { Stored } from "./db"
import type { JsonData, Taxonomy } from "./struct"
import type { Pattern } from "../web/pattern"

export type Prompt = string

export type Document = {
  type: "txt",
  content:string
} | {
  type: "pdf",
  content: ArrayBuffer
}



export type Module = {
  db: <T extends JsonData>(key:string, pattern:Pattern)=>Stored<T>,
  taxonomy: Stored<Taxonomy>
  documents: Stored<{[key:string]: string}>,
  extraction: Stored<JsonData>,
  functions: Stored<{[key:string]: FunctionDef}>,
  prompt: Stored<string>,
}


export type App = {
  [name:string]: Module
}

export type ETKOM = {
  modules: {
    name:string,
    extraction: JsonData
  }[]
}


