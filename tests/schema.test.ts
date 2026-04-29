import { assert, assertEqualJSON, expectError, runTests } from "./test";
import { format, fromSchema, validate, type Pattern } from "../model/pattern";
import type { JSONSchema } from "../model/json";

runTests(

  function testPatternValidate(){

    let tryValidate = (pattern:Pattern, data:any, shouldPass=true)=>{

      try{
        validate(pattern, data)
      }catch(e){
        if (shouldPass) throw e
        return 
      }
      if (!shouldPass) throw new Error(`Expected validation to fail for object ${JSON.stringify(data)} against pattern ${JSON.stringify(pattern)}`)
    }

    ([
      [String, "hello", true],
      [String, 123, false],
      [{tag: String}, {tag: "test"}, true],
      [{tag: String}, {tag: "test", extra: "value"}, false],
      [{tag: String, "[key:string]": Number}, {tag: "test", extra: 123}, true],
      [{tag: String}, 22, false],
      [{tag: String, "info?": String}, {tag: "test"}, true],
      [{tag: String, "info": String}, {tag: "test"}, false],
      [{tag: String, "info?": String}, {tag: "test", info: "..."}, true],
      [{tag: String, "[key:string]": Number}, {tag: "test", extra: "value"}, false],
      [{tag: String, "[key:string]": Number}, {tag: "test", extra: 123, another: 456}, true],
    ] as [Pattern, any, boolean][])
    .forEach(([pattern, data, shouldPass])=> tryValidate(pattern as Pattern, data, shouldPass));

    tryValidate({"$$ref": String}, {"$ref": "x"}, true)
    tryValidate({"$$ref": String}, {ref: "x"}, false)

    let string_number = [String, Number]
    tryValidate(string_number, "hello", true)
    tryValidate(string_number, 123, true)
    tryValidate(string_number, true, false)

    tryValidate(
      {
        $defs: {
          T: Number
        },
        pattern: {
          $ref: "#/$defs/T"
        }
      },
      123, true
    );

    let recPattern: Pattern = {
      $defs: {
        T: [[{$ref: "#/$defs/T"}], String]
      },
      pattern: {$ref: "#/$defs/T"}
    }

    tryValidate(recPattern, "hello", true)
    tryValidate(recPattern, [[[[["hello"]]]]], true)
    tryValidate(recPattern, [[[[[1]]]]], false)
    tryValidate(recPattern, 123, false)
    tryValidate(recPattern, ["a", ["b", "c"]], true)


    let rec2 : Pattern = [Number, [{$ref: "#"}]];

    console.log(format(rec2))

    tryValidate(rec2, 123, true)
    tryValidate(rec2, [123], true)

    tryValidate(rec2, [[123], 456], true)
    tryValidate(rec2, [[[[123]]], 456], true)
    tryValidate(rec2, "hello", false)
    tryValidate(rec2, [123, "hello"], false)

    let constPattern: Pattern = {$const: {a: 1, b: "test"}}

    tryValidate(constPattern, {a: 1, b: "test"}, true)
    tryValidate(constPattern, {a: 1, b: "test", extra: "value"}, false)
    tryValidate(constPattern, {a: 1}, false)
    tryValidate(constPattern, {b: "test"}, false)
    tryValidate(constPattern, {a: 2, b: "test"}, false)



    console.log(format({ee:33, "oo?":String}))

    tryValidate(
      {
        $defs: {
          Outer: {
            $id: "outer",
            value: String,
            inner: {
              $id: "inner",
              value: Number
            }
          }
        },
        pattern: {
          outer: {"$ref": "#/$defs/Outer"},
          fromOuter: {"$ref": "outer#/value"},
          fromInner: {"$ref": "inner#/value"}
        }
      },
      {
        outer: {value: "ok", inner: {value: 3}},
        fromOuter: "ok",
        fromInner: 3
      },
      true
    )

    tryValidate({$style:"color: red", tag: String}, {tag: "test"}, true)
    tryValidate({$$type: String}, {$type: "test"}, true)
    tryValidate({type: String}, {type: "test"}, true)
    tryValidate({type: String}, {}, false)
    
  },
  function testPatternFormat(){
    let pat = [
      String,
      Number,
      Boolean,
    ]
    assertEqualJSON(format(pat).trim(), `(string | number | boolean)`, "Failed to format simple union pattern`")
  },

  function testPatternFromSchema(){
    let assertEqual = (a: Pattern, b: Pattern, msg?: string)=>{
      let aStr = format(a).trim()
      let bStr = format(b).trim()
      if (aStr !== bStr) throw new Error(`Assertion failed: expected \n${aStr}\nto equal \n${bStr}` + (msg?(": "+msg):""))
    }

    let assertFromSchema = (schema: JSONSchema, expected: Pattern, msg?: string)=>{
      let res = format(fromSchema(schema)).trim()
      let exp = format(expected).trim()
      if (res !== exp) throw new Error(`Assertion failed: expected \n${res}\nto equal \n${exp}` + (msg?(": "+msg):""))
    }

    assertFromSchema({type: "string"}, String, "Failed to convert string schema")
    assertFromSchema({type: "number"}, Number, "Failed to convert number schema")

    assertFromSchema(
      {
        type: "object",
        properties: {
          "$ref": {type: "string"},
          name: {type: "string"},
          age: {type: "number"},
        },
        required: ["$ref", "name"]
      },
      {
        "$$ref": String,
        name: String,
        "age?": Number
       },
       "Failed to convert object schema with required and optional properties"
    )

  },

)
