export type JsonData = string | null | number | boolean | { [key: string]: JsonData } | JsonData[]

export type JSONSchema = { [key: string]: JsonData }

export type Taxonomy = {
  categories: {
    [name: string]: {
      description: string,
      subCategories: {
        [name: string]: {
          description: string,
          itemSchema: JSONSchema
        }
      }
    }
  }
}

export const parse = (s: string) => JSON.parse(s)
export const stringify = (d: JsonData) => JSON.stringify(d, null, 2)
