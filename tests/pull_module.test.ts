import { buildExportPlan, queryFor } from "../scripts/pull_module.js";
import { assert, assertEqualJSON, runTests } from "./test";

await runTests(
  function testQueryFor() {
    assertEqualJSON(
      queryFor("dkormann", "create_taxonomy"),
      "select * from storage where owner_key >= 'dkormann:create_taxonomy:' and owner_key < 'dkormann:create_taxonomy;'",
    );
  },

  function testBuildExportPlan() {
    const plan = buildExportPlan("dkormann", "create_taxonomy", [
      ["dkormann:create_taxonomy:taxonomypurlvv", "{\"categories\":{\"Technology\":{\"description\":\"A role\",\"subCategories\":{\"Artificial Intelligence\":{\"description\":\"AI desc\",\"itemSchema\":{\"type\":\"object\"}}}}}}"],
      ["dkormann:create_taxonomy:extractionxyz", "{\"Technology\":{\"Artificial Intelligence\":{\"Introduction to Machine Learning\":{\"depiction\":\"diagram\",\"content\":\"text body\"}}}}"],
    ], {
      outputRoot: "tmp_modules",
      host: "https://maincloud.spacetimedb.com",
      database: "lexxtract",
      pulledAt: "2026-04-30T00:00:00.000Z",
    });

    assert(plan.moduleDir === "tmp_modules/dkormann/create_taxonomy/en");
    assert(plan.files.some((x) => x.path.endsWith("/taxonomy.json")));
    assert(plan.files.some((x) => x.path.endsWith("/data/technology/technology_artificial_intelligence/Introduction_to_Machine_Learning.json")));

    const taxonomy = JSON.parse(String(plan.files.find((x) => x.path.endsWith("/taxonomy.json"))?.content));
    assertEqualJSON(taxonomy, {
      taxonomy: {
        title: "create_taxonomy",
        version: "",
        description: "",
        categories: [
          {
            id: "technology",
            name: "Technology",
            description: "A role",
            subcategories: [
              {
                id: "technology_artificial_intelligence",
                name: "Artificial Intelligence",
                description: "AI desc",
                schema: {
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
                      properties: {
                        name: { type: "string" },
                        job_id: { type: "string" },
                        schema_id: { type: "string" },
                      },
                      required: ["name"],
                      additionalProperties: false,
                    },
                    modified_by: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        job_id: { type: "string" },
                        schema_id: { type: "string" },
                      },
                      required: ["name"],
                      additionalProperties: false,
                    },
                    sort_order: { type: ["integer", "null"] },
                    links: { type: "array", items: { type: "object" } },
                  },
                  required: ["id", "name", "depiction", "content", "taxonomy", "created_at", "created_by"],
                  additionalProperties: true,
                },
              },
            ],
          },
        ],
      },
    });

    const item = JSON.parse(String(plan.files.find((x) => x.path.endsWith("/Introduction_to_Machine_Learning.json"))?.content));
    assertEqualJSON(item.name, "Introduction to Machine Learning");
    assertEqualJSON(item.taxonomy, {
      category: "technology",
      subcategory: "technology_artificial_intelligence",
    });
  },
);
