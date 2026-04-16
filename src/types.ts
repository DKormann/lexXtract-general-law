import type { JsonData, Schema } from "./schemas"

export type Prompt = string

export type Document = {
  type: "txt",
  content:string
} | {
  type: "pdf",
  content: ArrayBuffer
}


export type Taxonomy = {
  name:string,
  description:string,
  constraint?: string,
  style?: string
} & ({itemSchema: Schema} | {children: Taxonomy[]})


export type Module = {
  prompt: Prompt
  taxonomy: Taxonomy
  source: Document[]
  extraction? : JsonData
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



