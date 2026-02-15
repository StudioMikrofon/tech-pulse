/**
 * validate-content.ts — Validate all existing MDX articles
 *
 * Usage: npx tsx scripts/validate-content.ts
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Ajv from "ajv";

const CONTENT_DIR = path.join(process.cwd(), "content");
const SCHEMA_PATH = path.join(__dirname, "content-schema.json");

const CATEGORIES = ["ai", "gaming", "space", "technology", "medicine", "society", "robotics"];

function loadSchema() {
  const raw = fs.readFileSync(SCHEMA_PATH, "utf-8");
  return JSON.parse(raw);
}

function main() {
  const schema = loadSchema();
  const ajv = new Ajv({ allErrors: true });

  ajv.addFormat("date-time", {
    type: "string",
    validate: (s: string) => !isNaN(Date.parse(s)),
  });
  ajv.addFormat("uri", {
    type: "string",
    validate: (s: string) => {
      try { new URL(s); return true; } catch { return false; }
    },
  });

  const validateFn = ajv.compile(schema);

  let total = 0;
  let passed = 0;
  let failed = 0;
  const errors: { file: string; issues: string[] }[] = [];

  for (const category of CATEGORIES) {
    const categoryDir = path.join(CONTENT_DIR, category);
    if (!fs.existsSync(categoryDir)) continue;

    const files = fs.readdirSync(categoryDir).filter((f) => f.endsWith(".mdx"));

    for (const file of files) {
      total++;
      const filePath = path.join(categoryDir, file);
      const raw = fs.readFileSync(filePath, "utf-8");

      try {
        const { data, content } = matter(raw);
        const valid = validateFn(data);

        if (!valid) {
          failed++;
          const issues = (validateFn.errors || []).map(
            (e) => `${e.instancePath || "/"}: ${e.message}`
          );
          errors.push({ file: `${category}/${file}`, issues });
        } else if (!content || content.trim().length < 10) {
          failed++;
          errors.push({ file: `${category}/${file}`, issues: ["Content body is too short (min 10 chars)"] });
        } else {
          passed++;
        }
      } catch (err) {
        failed++;
        errors.push({ file: `${category}/${file}`, issues: [(err as Error).message] });
      }
    }
  }

  console.log(`\nContent Validation Report`);
  console.log(`========================`);
  console.log(`Total:  ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (errors.length > 0) {
    console.log(`\nErrors:`);
    for (const err of errors) {
      console.log(`\n  ${err.file}:`);
      err.issues.forEach((issue) => console.log(`    - ${issue}`));
    }
    process.exit(1);
  }

  console.log(`\nAll articles are valid!`);
}

main();
