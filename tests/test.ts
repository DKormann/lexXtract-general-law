

export const expectError = (fn:()=>void,msg = "Expected error, but function succeeded" )=>{
  try{
    fn()
    throw new Error(msg)
  }catch(e){}
}

export const raise = (msg: string)=> {throw new Error(msg)}
export const assert = (condition:boolean, msg?:string)=>{if (!condition) raise("Assertion failed" + (msg?(": "+msg):""))}
export const assertEqualJSON = (a:any, b:any, msg?:string)=>{
  if (JSON.stringify(a) === JSON.stringify(b)) return
  let aStr = JSON.stringify(a, null, 2)
  let bStr = JSON.stringify(b, null, 2)
  raise(`Assertion failed: expected \n${aStr}\nto equal \n${bStr}` + (msg?(": "+msg):""))
}

export const runTests = async (
  ...tests: (()=>(Promise<void> | void))[]
)=>{

  console.info(`Running ${tests.length} tests`)
  let fails = 0;

  await Promise.all(tests.map(async (test,i)=>{
    let logs : any[][] = []
    try{ 
      await test()
      console.info(`✅ Test ${i+1}: ${test.name || "anonymous test"} passed`)
    }catch (e){
      fails++
      let err = e instanceof Error ? e.message : String(e)
      console.error(`Test ${test.name} failed with error`, err)
      if (logs.length > 0){
        console.error("Logs from failed test:")
        logs.forEach(l=>console.error(...l))
      }
    }
  }))
  console.info(`${fails == 0  ? '✅' : '❌'} Tests ran: ${tests.length}, ${fails} failed`)
}
