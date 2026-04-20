import type { JsonData, Schema } from "./struct"

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
  style?: string,
  children: Taxonomy[]
  itemSchema?: Schema
}

export type Module = {
  prompt: Prompt
  taxonomy: Taxonomy
  source: {[title:string]:Document}
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



