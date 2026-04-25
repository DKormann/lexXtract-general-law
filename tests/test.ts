

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
  // const true_log = console.log

  tests.forEach(async (test,i)=>{
    let logs : any[][] = []
    console.info(`Running test ${i+1}: ${test.name}`)
    // console.log = (...args:any[])=>logs.push(args)
    try{ 
      await test()
      // console.log = true_log
    }catch (e){
      fails++
      let err = e instanceof Error ? e.message : String(e)
      // console.log = true_log
      console.error(`Test ${test.name} failed with error`, err)
      if (logs.length > 0){
        console.error("Logs from failed test:")
        logs.forEach(l=>console.error(...l))
      }
    }
  })
  console.info(`Tests ran: ${tests.length}, ${fails} failed.`)
}
