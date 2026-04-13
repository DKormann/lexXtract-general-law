import type { JsonData, Schema } from "./src/schemas"

type Prompt = string

type Document = {
  type: "txt",
  content:string
} | {
  type: "pdf",
  content: ArrayBuffer
}

type Taxonomy = {
  name:string,
  description:string,
  itemSchema?:Schema
  children?:Taxonomy[]
  style?: string
}


type Content = {
  taxonomy: Taxonomy,
  data: JsonData
}

type Domain = {
  prompt: Prompt
  taxonomy: Taxonomy
  source: Document[]
  extraction? : Content
}



