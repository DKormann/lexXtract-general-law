import { request } from "../src/request";
import { type ExtractionItem, type Schema } from "../src/schemas";
import { background, body, border, button, color, div, h1, h2, h3, input, p, padding, popup, pre, span, style, textarea } from "./html";




type document = {
  title:string,
  content:string,
}

let folderNames = ["schemas", "documents", "prompts"]

let folders = new Map<string, document[]>()
folderNames.forEach(folder =>{
  folders.set(folder, JSON.parse(localStorage.getItem(folder) || "[]"))
})
let save = (folderName:string)=>localStorage.setItem(folderName, JSON.stringify(folders.get(folderName)))

const setDocument = (folderName: string, title:string, content:string) => {
  console.log({folderName, title, content})
  let folder = folders.get(folderName)!
  for (let file of folder){
    if (file.title == title){
      file.content = content
      localStorage.setItem(folderName, JSON.stringify(folder))
      save(folderName)
      return
    }
  }
  folder.push({title, content})
  save(folderName)
}


const showFolder = (folderName:string):HTMLElement=>{

  let filename = "";
  let area = textarea(
    {
      style:{
        background:color.background,
        color:color.color,
        width:"80%",
        fontFamily:"monospace",
        padding:"1em",
        border: "unset",
        outline:"none"
      },
      oninput:()=>{
        setDocument(folderName,filename, area.value)
      }
    }
  )


  let filelist:HTMLElement = div()
  let folder = folders.get(folderName)!
  let loadfiles=()=>{
    filelist.innerHTML = ""
    folder.filter(fl=>fl.title)!.forEach(fl=>{
      
      filelist.append(
        p(
          span(fl.title, {style:{cursor:"pointer"},
          onclick:()=>{
          console.log(fl.title)
          filename = fl.title,
          area.value = fl.content
        }
        }),
        span("x",{style:{
          float:"right",
          padding:"0 1em",
        },
        onclick:()=>{
          if (confirm("delete "+fl.title+"?" )){
            folder = folder.filter(x=>x.title!=fl.title)
            folders.set(folderName, folder)
            save(folderName)
            loadfiles()
          }
        }
      })
      ))
    })
  }
  loadfiles()

  let res = div(
    h2(folderName),
    div({
        style:{
          display:"flex",
          flexDirection:"row",

        }
      },
      div(

        {
          style:{
            width:"20%",
            height:"100vh",
            borderRight: "1px solid "+color.color
          }
        },
        button(
          `+ new file`,
          {
            onclick:()=>{
              let title = prompt("title?")
              if (!title) return
              setDocument(folderName, title, "")
              loadfiles()
            }
          }
        ),
        filelist
      ),
      area
    )
  )
  return res
}

let main = div()

let chosen = new Map<string, string>()

let replace = (s:string, reps: Record<string, string>)=>Object.entries(reps).reduce((a, [k,v])=>a.replaceAll(k,v), s)

let result = div()

let runner = div(

  ["documents", "schemas","prompts",].map(foldername=>{
    let choose = (n:string)=>{
      filename.textContent = n
      chosen.set(foldername, n)
    }
    let filename = span()
    choose(folders.get(foldername)?.[0]?.title || "...")
    return p(foldername.slice(0,-1), ": ", span(filename,
      style({
        border:"1px solid "+color.color,
        padding:".2em",
        borderRadius:".4em",
        cursor:"pointer",
      })),
    {
      onclick:()=>{
        let pop = popup(
          div(
            {style:{
              background:color.background,
              padding:"2em",
              borderRadius:"1em",
            }},
            h2("choose from "+foldername),
            folders.get(foldername)!.map(fl=>p(fl.title, {onclick:()=>{
              choose(fl.title)
              pop.remove()
            }}))
          )
        )
      },

    })
  }),

  button("RUN",{
    onclick:async ()=>{
      let getchosen = (folder:string)=>folders.get(folder)?.find(x=>x.title == chosen.get(folder))!.content!
      let schemaraw = getchosen("schemas");
      console.log(schemaraw)
      let schema = JSON.parse(schemaraw) as ExtractionItem
      let prompt = replace(getchosen("prompts"), {
        "{schema}": schemaraw,
        "{document}":getchosen("documents"),
        "{type}": schema.name,
      })
      result.innerHTML = "running..."
      let response = await request(
        prompt,
        "anthropic/claude-haiku-4.5",
        {
          argname:"items",
          argschema: schema,
          description: "use this to create items",
          name:"extract",
        },
        0
      )
      let data = JSON.parse(response.output.items) as any[]
      result.innerHTML = "",
      result.append(
        h2(`response`),
        viewJsonResults(data)
      )
    }
  }),
  result
)

let viewJsonResults = (json:any[])=>{

  
  let go =(item:any):HTMLElement=>{
    let spaced =(x:HTMLElement)=>div({style:{paddingLeft:"2em"}}, x)
    if (typeof item == "string"){
      return span(item)
    }
    if (Array.isArray(item)){
      return div(
        item.map((x,i)=>div(
          p(i+": "),
          spaced(go(x))
        ))
      )
    }
    if (typeof item == "object"){
      return div(
        Object.entries(item).map(([k,v])=>div(
          p(k+": "),
          spaced(go(v))
        ))
      )
    }
    return span(String(item))
  }


  let res = span()

  let search =  input({
    style:{
      margin:".5em",
    },
    placeholder:"search",
    oninput:()=>{
      if (!search.value) return render(json)
      render(json.filter(x=>JSON.stringify(x).toLowerCase().includes(search.value.toLowerCase())))
    }
  })

  let render = (items:any[])=>{
    res.innerHTML = ""
    res.append(
      `${items.length} items found`,

      ...items.map((x,i)=>div(
      {style:{
        borderRadius:".4em",
        margin:"1em 0",
        padding:"1em",
      }},
      go(x)
    )))
  }
  render(json)
  return span(search, res)
}


let nav = div(
  {
    style:{
      background: color.blue,
      padding:".4em",
      borderRadius:".4em",
      width:"max-content",

    },
  },
  ([
    ...folderNames.map(fn=>{
      return [fn, showFolder(fn)]
    }),
    ["runner", runner,],
  ] as [string, HTMLElement][]).map(([title, el])=>{
    return span(
      {
        style:{
          color: color.color,
          fontWeight:"bolder",
          padding:".2em",
          cursor:"pointer",
        },
        onclick:()=>{
          main.innerHTML = '',
          main.appendChild(el)
        },
      },
      title,
    )
  })
)

body.appendChild(

  div(
    {
      style:{
        padding:"1em"
      }
    },
    h1("lexxtract"),
    nav,
    main,
  ),
);
