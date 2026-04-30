import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const HOST = "https://maincloud.spacetimedb.com";
const DB = "lexxtract";
const OUT = "pulled_modules";
const KEYS = ["taxonomy", "extraction"];
const ITEM_SCHEMA = {
  $schema: "https://json-schema.org/draft/2019-09/schema",
  $id: "https://enterprisetransformationcircle.com/lexXtract/generated/item.schema.json",
  title: "item",
  description: "Generated extraction item schema.",
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[A-Z0-9]{8}$" },
    parent_id: { type: ["string", "null"] },
    name: { type: "string" },
    depiction: { type: "string" },
    content: { type: "string" },
    taxonomy: {
      type: "object",
      properties: {
        category: { type: "string" },
        subcategory: { type: "string" },
      },
      required: ["category", "subcategory"],
      additionalProperties: false,
    },
    source: { type: "array", items: { type: "object" } },
    created_at: { type: "string", format: "date-time" },
    modified_at: { type: "string", format: "date-time" },
    created_by: {
      type: "object",
      properties: { name: { type: "string" }, job_id: { type: "string" }, schema_id: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
    modified_by: {
      type: "object",
      properties: { name: { type: "string" }, job_id: { type: "string" }, schema_id: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
    sort_order: { type: ["integer", "null"] },
    links: { type: "array", items: { type: "object" } },
  },
  required: ["id", "name", "depiction", "content", "taxonomy", "created_at", "created_by"],
  additionalProperties: true,
};

export const queryFor = (owner, name) => {
  const prefix = `${owner.replaceAll(":", "_:")}:${name}:`;
  return `select * from storage where owner_key >= '${prefix}' and owner_key < '${prefix.slice(0, -1)};'`;
};


export const buildExportPlan = (owner, name, rows, { outputRoot = OUT, host = HOST, database = DB, pulledAt = new Date().toISOString() } = {}) => {
  const safe = (x) => x.replaceAll(/[^a-zA-Z0-9._-]+/g, "_");
  const mkId = (x) => safe(x).toLowerCase();
  const itemId = (categoryName, subcategoryName, itemTitle) => {
    const source = `${categoryName}\0${subcategoryName}\0${itemTitle}`;
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase().padStart(8, "0").slice(-8);
  };
  const dir = `${outputRoot}/${safe(owner)}/${safe(name)}/en`;
  const files = [];
  const picked = {};

  for (const row of rows) {
    const [dbKey, raw] = Array.isArray(row) ? row : [row.owner_key, row.value];
    const suffix = String(dbKey).slice(`${owner.replaceAll(":", "_:")}:${name}:`.length);
    const key = KEYS.find((x) => suffix.startsWith(x));
    const entry = { dbKey: String(dbKey), suffix, raw: String(raw), value: (() => { try { return JSON.parse(String(raw)); } catch { return String(raw); } })() };
    if (key && (!picked[key] || entry.raw.length >= picked[key].raw.length)) picked[key] = entry;
  }

  const add = (path, content) => {
    files.push({ path: `${dir}/${path}`, content: typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n` });
  };
  const toTaxonomy = (taxonomy) => ({
    taxonomy: {
      title: name,
      version: "",
      description: "",
      categories: Object.entries(taxonomy?.categories || {}).map(([categoryName, category]) => ({
        id: mkId(categoryName),
        name: categoryName,
        description: category?.description || "",
        subcategories: Object.entries(category?.subCategories || {}).map(([subcategoryName, subcategory]) => ({
          id: mkId(`${categoryName}_${subcategoryName}`),
          name: subcategoryName,
          description: subcategory?.description || "",
          schema: ITEM_SCHEMA,
        })),
      })),
    },
  });

  if (picked.taxonomy) add("taxonomy.json", toTaxonomy(picked.taxonomy.value));

  if (picked.extraction?.value && typeof picked.extraction.value === "object") {
    for (const [categoryName, category] of Object.entries(picked.extraction.value)) {
      if (!category || typeof category !== "object") continue;
      for (const [subcategoryName, subcategory] of Object.entries(category)) {
        if (!subcategory || typeof subcategory !== "object") continue;
        const used = new Set();
        for (const [itemTitle, item] of Object.entries(subcategory)) {
          let file = `${safe(itemTitle) || "item"}.json`, n = 2;
          while (used.has(file)) file = `${safe(itemTitle) || "item"}_${n++}.json`;
          used.add(file);
          add(`data/${mkId(categoryName)}/${mkId(`${categoryName}_${subcategoryName}`)}/${file}`, {
            id: itemId(categoryName, subcategoryName, itemTitle),
            parent_id: null,
            name: itemTitle,
            depiction: item?.depiction || "",
            content: item?.content || "",
            taxonomy: {
              category: mkId(categoryName),
              subcategory: mkId(`${categoryName}_${subcategoryName}`),
            },
            source: [],
            created_at: pulledAt,
            modified_at: pulledAt,
            created_by: {
              name: "lexXtract pull_module",
              schema_id: "Item",
            },
            modified_by: {
              name: "lexXtract pull_module",
              schema_id: "Item",
            },
            sort_order: null,
            links: [],
          });
        }
      }
    }
  }

  return { moduleDir: dir, files };
};

export const pullModule = async (owner, name, { outputRoot = OUT, host = HOST, database = DB } = {}) => {
  const response = await fetch(`${host}/v1/database/${database}/sql`, { method: "POST", body: queryFor(owner, name) });
  if (!response.ok) throw new Error(`SQL request failed with ${response.status} ${response.statusText}`);
  const rows = (await response.json())?.[0]?.rows;
  if (!Array.isArray(rows)) throw new Error("Unexpected SQL response");
  const plan = buildExportPlan(owner, name, rows, { outputRoot, host, database });
  for (const dir of new Set([plan.moduleDir, ...plan.files.map((x) => x.path.split("/").slice(0, -1).join("/"))])) await mkdir(dir, { recursive: true });
  for (const file of plan.files) await writeFile(file.path, file.content);
  return plan;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [owner, name, outputRoot = OUT, host = HOST, database = DB] = process.argv.slice(2);
  if (!owner || !name) {
    console.error("Usage: node scripts/pull_module.js <owner> <module_name> [output_dir] [host] [database]");
    process.exitCode = 1;
  } else {
    const plan = await pullModule(owner, name, { outputRoot, host, database });
    console.log(`Pulled ${owner}/${name} into ${plan.moduleDir}`);
  }
}
