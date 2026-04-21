
export const body = document.body;

const colorPalette = {
  light:{
    color:             "#000",
    background:        "#fff",
    red:               "rgb(242, 55, 55)",
    green:             "rgb(57, 214, 39)",
    blue:              "rgb(48, 82, 255)",
    gray:              "#888",
    lightgray:         "#e5e5e5",
  },
  dark:{
    color:             "#fff",
    background:        "#222",
    red:               "rgb(198, 20, 0)",
    blue:              "rgb(41, 48, 255)",
    green:             "rgb(0, 185, 19)",
    gray:              "#565656",
    lightgray:         "#414141",
  }
}



export const color = {
  color: "var(--color)",
  background: "var(--background)",
  blue: "var(--blue)",
  red: "var(--red)",
  green: "var(--green)",
  gray: "var(--gray)",
  lightgray: "var(--lightgray)"
}


let styl = document.createElement("style")
styl.innerHTML = `
:root {
  --color: ${colorPalette.dark.color};
  --background: ${colorPalette.dark.background};
  --red: ${colorPalette.dark.red};
  --green: ${colorPalette.dark.green};
  --blue: ${colorPalette.dark.blue};
  --gray: ${colorPalette.dark.gray};
  --lightgray: ${colorPalette.dark.lightgray};
  color: var(--color);
  background: var(--background);
  font-family: sans-serif;
}
@media (prefers-color-scheme: light) {
  :root {
    --color: ${colorPalette.light.color};
    --background: ${colorPalette.light.background};
    --red: ${colorPalette.light.red};
    --green: ${colorPalette.light.green};
    --blue: ${colorPalette.light.blue};
    --gray: ${colorPalette.light.gray};
    --lightgray: ${colorPalette.light.lightgray};
  }
}
`
document.head.appendChild(styl)





export type htmlKey = 'innerText'|'onclick' | 'oninput' | 'onkeydown' |'children'|'class'|'id'|'contentEditable'|'eventListeners'|'color'|'background' | 'style' | 'placeholder' | 'tabIndex' | 'colSpan' | 'type'

export const htmlElement = (tag:string, text:string, cls:string = "", args?:Partial<Record<htmlKey, any>>):HTMLElement =>{

  const _element = document.createElement(tag)
  _element.textContent = text
  let st = _element.style
  if (tag == "button"){
    _element.innerText = text
    st.color = color.color
    st.backgroundColor = color.lightgray
    st.border = "1px solid "+color.color
    st.borderRadius = ".2em"
    st.boxShadow = "0 2px 1px "+color.lightgray
  }
  if (args) Object.entries(args).forEach(([key, value])=>{
    if (key === 'parent'){
      (value as HTMLElement).appendChild(_element)
    }
    if (key==='children'){
      (value as HTMLElement[]).forEach(c=>_element.appendChild(c))
    }else if (key==='eventListeners'){
      Object.entries(value as Record<string, (e:Event)=>void>).forEach(([event, listener])=>{
        _element.addEventListener(event, listener)
      })
    }else if (key === 'style'){

      Object.entries(value as Record<string, string>).forEach(([key, value])=>{
        key = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        _element.style.setProperty(key, value)
      })
    }else if (key === 'class'){
      _element.classList.add(...(value as string).split('.').filter(x=>x))
    }else{
      _element[(key as 'innerText' | 'onclick' | 'oninput' | 'id' | 'contentEditable')] = value
    }
  })
  return _element
}




export type HTMLArg = string | number | HTMLElement | Partial<Record<htmlKey, any>>  | Promise<HTMLArg> | HTMLArg[]


export const html = (tag:string, ...cs:HTMLArg[]):HTMLElement=>{
  let children: HTMLElement[] = []
  let args: Partial<Record<htmlKey, any>> = {}

  const add_arg = (arg:HTMLArg)=>{
    if (typeof arg === 'string') children.push(htmlElement("span", arg))
    else if (typeof arg === 'number') children.push(htmlElement("span", arg.toString()))
    else if (arg instanceof Promise){
      const el = span()
      arg.then((value)=>{
        el.innerHTML = ""
        el.appendChild(span(value))
      })
      children.push(el)
    }
    else if (arg instanceof HTMLElement) children.push(arg)
    else if (arg instanceof Array) arg.forEach(add_arg)
    else args = {...args, ...arg}
  }
  for (let arg of cs){
    add_arg(arg)
  }
  return htmlElement(tag, "", "", {...args, children})
}

export type HTMLGenerator<T extends HTMLElement = HTMLElement> = (...cs:HTMLArg[]) => T
const newHtmlGenerator = <T extends HTMLElement>(tag:string)=>(...cs:HTMLArg[]):T=>html(tag, ...cs) as T

export const p:HTMLGenerator<HTMLParagraphElement> = newHtmlGenerator("p")
export const h1:HTMLGenerator<HTMLHeadingElement> = newHtmlGenerator("h1")
export const h2:HTMLGenerator<HTMLHeadingElement> = newHtmlGenerator("h2")
export const h3:HTMLGenerator<HTMLHeadingElement> = newHtmlGenerator("h3")
export const h4:HTMLGenerator<HTMLHeadingElement> = newHtmlGenerator("h4")

export const div:HTMLGenerator<HTMLDivElement> = newHtmlGenerator("div")
export const pre:HTMLGenerator<HTMLPreElement> = newHtmlGenerator("pre")
export const button:HTMLGenerator<HTMLButtonElement> = newHtmlGenerator("button")
export const span:HTMLGenerator<HTMLSpanElement> = newHtmlGenerator("span")
export const textarea:HTMLGenerator<HTMLTextAreaElement> = newHtmlGenerator("textarea")

export const table:HTMLGenerator<HTMLTableElement> = newHtmlGenerator("table")
export const tr:HTMLGenerator<HTMLTableRowElement> = newHtmlGenerator("tr")
export const td:HTMLGenerator<HTMLTableCellElement> = newHtmlGenerator("td")
export const th:HTMLGenerator<HTMLTableCellElement> = newHtmlGenerator("th")
export const canvas:HTMLGenerator<HTMLCanvasElement> = newHtmlGenerator("canvas")

export const style = (...rules: Record<string, string>[]) => {
  return {style: Object.assign({}, ...rules)}
}

export const margin = (value: string) => style({margin: value})
export const padding = (value: string) => style({padding: value})
export const border = (value: string) => style({border: value})
export const borderRadius = (value: string) => style({borderRadius: value})
export const width = (value: string) => style({width: value})
export const height = (value: string) => style({height: value})
export const display = (value: string) => style({display: value})
export const background = (value: string = "var(--background)") => style({background: value})

export const input:HTMLGenerator<HTMLInputElement> = (...cs)=>{

  const content = cs.filter(c=>typeof c == 'string').join(' ')

  const el = html("input", ...cs) as HTMLInputElement

  el.value = content
  return el
}



export const popup = (...cs:HTMLArg[])=>{

  const dialogfield = div(
    {
      style: {
        background: color.background,
        color: color.color,
        padding: "1em",
        paddingBottom: "2em",
        borderRadius: "1em",
        zIndex: "2000",
        overflowY: "scroll",
      }
    },
    ...cs)

  const popupbackground = div(
    {style:{
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: "rgba(166, 166, 166, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: "2000",
    }}
  )

  popupbackground.appendChild(dialogfield);
  document.body.appendChild(popupbackground);
  popupbackground.onclick = () => {popupbackground.remove(); }

  dialogfield.onclick = (e) => {
    e.stopPropagation();
  }

  return popupbackground

}

export const errorpopup = (e:Error | string) =>{
  popup(div(
    style({
      background:color.background,
      border:"1px solid "+color.gray,
      padding:"1em",
      borderRadius:".4em",
      color:color.red,
    }),
    h2("Error"),
    p(String(e))
  ))
  throw (e instanceof Error) ? e : new Error(String(e))
}



export let string_editor = (content:string, update:(s:string)=>void, tag:(...cs: HTMLArg[])=> HTMLElement = pre , style:Partial<CSSStyleDeclaration> = {}):HTMLElement=>{
  let saver = button("save", {onclick: ()=>{
    let go = (c:Node):string=>{
      if (c instanceof HTMLBRElement) return "\n"
      else if (c instanceof Text) return c.textContent
      let t = Array.from(c.childNodes).map(go).join("")
      return c instanceof HTMLDivElement ? t + "\n" : t
    }
    let content = go(area)
    update(content);
    saver.style.display = "none";
  }, style:{display:"none", margin:"1em 0"}})
  let area = tag(
    content,
    {
      style:{
        padding:".2em",
        whiteSpace: "pre",
        ...style
      }
    },
    {contentEditable:true,
    oninput:()=>{saver.style.display = "block"}
  });
  return span(area, saver)
}
