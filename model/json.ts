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

export type Path = (string | number)[]
export const get_path = (d:JsonData, path:Path): JsonData=>{

  let cur: JsonData = d
  for (let p of path){
    if (typeof cur == "object" && cur != null && p in cur){
      cur = (cur as any)[p]
    }else{
      throw new Error ("Invalid path")
    }
  }
  return cur
}

export const set_path = (d:JsonData, path:Path, value: JsonData): JsonData=>{
  if (path.length == 0) return value
  return (
    Array.isArray(d)
      ?[...d.slice(0, path[0] as number), set_path((d as any)[path[0] as number], path.slice(1), value), ...d.slice((path[0] as number)+1)] 
      : {...d as any, [path[0] as string]: set_path((d as any)[path[0] as string], path.slice(1), value)})
}

