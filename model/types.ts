// import type { FunctionDef } from "../web/agent_functions"
import type { Stored } from "./db"
import type { JsonData, JSONSchema, Taxonomy } from "./struct"
import type { Pattern } from "./pattern"

export type Prompt = string

export type Document = {
  type: "txt",
  content:string
} | {
  type: "pdf",
  content: ArrayBuffer
}



export type ModPath = {
  owner: string,
  name: string
}

export const ModPath:Pattern = {
  owner: String,
  name: String,
}

export type FunctionDef = {
  parameters: Record<string, JSONSchema>,
  description?: string,
  reads?: string[],
  writes?: string[],
  code: string
}



export type Module = {
  db: <T extends JsonData>(key:string, pattern:Pattern)=>Promise<Stored<T>>,
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


