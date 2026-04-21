import type { Schema } from "./struct";

type Tool = {
  name: string;
  description: string;
  argname: string;
  argschema: Schema;
};

type ModelResponse = {
  usage: { cost: number };
  output:
    ({ type: "function_call"; name: string; arguments: string }
    | { type: "reasoning"; content: unknown }
    | { type: "message"; content: {type:"output_text", text:string} []})[];
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const storage: StorageLike =
  typeof localStorage !== "undefined"
    ? localStorage
    : {
        getItem() {
          return null;
        },
        setItem() {},
      };

function getApiKey(): string {
  const existing = storage.getItem("api_key");
  if (existing) {
    return existing;
  }

  const entered = prompt("provide openrouter key");
  if (!entered) {
    throw new Error("Missing OpenRouter API key");
  }

  storage.setItem("api_key", entered);
  return entered;
}

function cacheKey(parts: unknown[]): string {
  return JSON.stringify(parts);
}

export async function request(promptText: string, model: string, tool: Tool, seed: number) {
  const key = cacheKey([promptText, model, tool, seed]);

  const cached = storage.getItem(key);
  if (cached) {
    return JSON.parse(cached) as { cost: number; output: unknown };
  }

  const response = await fetch("https://openrouter.ai/api/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      input: promptText,
      reasoning: { effort: "low" },
      tools: [
        {
          type: "function",
          name: tool.name,
          description: tool.description,
          parameters: {
            type: "object",
            properties: { [tool.argname]: tool.argschema },
            required: [tool.argname],
          },
        },
      ],
      tool_choice: { type: "function", name: tool.name },
    }),
  });

  const data = (await response.json()) as ModelResponse;
  const functionCall = data.output.find((item) => item.type === "function_call");
  if (!functionCall) {
    throw new Error("Model response did not include a function call");
  }

  const result = {
    cost: data.usage.cost,
    output: JSON.parse(functionCall.arguments),
  };

  storage.setItem(key, JSON.stringify(result));
  return result;
}

export type Message = {
  role: "user" | "assistant";
  content: string;
}

export async function chat(messages: Message[], model: string):Promise<Message>{
  const key = cacheKey([messages, model])
  const cached = storage.getItem(key);
  if (cached) {
    return JSON.parse(cached) as Message;
  }

  const response = await fetch("https://openrouter.ai/api/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      input: messages.map(m=>({role:m.role, content:m.content})),
      reasoning: { effort: "low" },
    }),
  });

  const data = (await response.json()) as ModelResponse;
  console.log("Model response:", data);
  
  const responseMessage = data.output.find((item) => item.type == "message");
  if (!responseMessage) throw new Error("Model response did not include a text message");

  const result = {
    role: "assistant",
    content: responseMessage.content[0]!.text,
  } as Message;

  storage.setItem(key, JSON.stringify(result));

  return result;

}