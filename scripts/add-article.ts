/**
 * add-article.ts — Add a new article to TECH AND SPACE
 *
 * Usage:
 *   npx tsx scripts/add-article.ts --input article.json
 *   echo '{ ... }' | npx tsx scripts/add-article.ts --stdin
 *
 * The JSON payload must contain:
 *   - All frontmatter fields (id, title, category, date, excerpt, source, image, tags, geo)
 *   - A "content" field with the article body in Markdown
 */

import fs from "fs";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv/dist/2020";

const CONTENT_DIR = path.join(process.cwd(), "content");
const SCHEMA_PATH = path.join(__dirname, "content-schema.json");

interface ArticlePayload {
  id: string;
  title: string;
  category: string;
  date: string;
  excerpt: string;
  source: { name: string; url: string };
  image: { url: string; alt: string };
  tags: string[];
  geo: { name: string; lat: number; lon: number; countryCode: string };
  featured?: boolean;
  approved?: boolean;
  content: string;
}

function loadSchema() {
  const raw = fs.readFileSync(SCHEMA_PATH, "utf-8");
  return JSON.parse(raw);
}

function validate(data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const schema = loadSchema();
  const ajv = new Ajv({ allErrors: true });

  // Add format validators manually
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

  // Validate frontmatter (everything except content)
  const { content, ...frontmatter } = data;
  const valid = validateFn(frontmatter);

  if (!valid) {
    const errors = (validateFn.errors || []).map(
      (e) => `${e.instancePath || "/"}: ${e.message}`
    );
    return { valid: false, errors };
  }

  if (!content || typeof content !== "string" || (content as string).trim().length < 10) {
    return { valid: false, errors: ["content: must be a non-empty string (min 10 chars)"] };
  }

  return { valid: true, errors: [] };
}

function generateMdx(data: ArticlePayload): string {
  const { content, ...frontmatter } = data;

  // Set defaults
  if (frontmatter.approved === undefined) frontmatter.approved = true;
  if (frontmatter.featured === undefined) frontmatter.featured = false;

  // Build YAML frontmatter
  const yaml = [
    "---",
    `id: "${frontmatter.id}"`,
    `title: "${frontmatter.title.replace(/"/g, '\\"')}"`,
    `category: "${frontmatter.category}"`,
    `date: "${frontmatter.date}"`,
    `excerpt: "${frontmatter.excerpt.replace(/"/g, '\\"')}"`,
    `source:`,
    `  name: "${frontmatter.source.name}"`,
    `  url: "${frontmatter.source.url}"`,
    `image:`,
    `  url: "${frontmatter.image.url}"`,
    `  alt: "${frontmatter.image.alt.replace(/"/g, '\\"')}"`,
    `tags: [${frontmatter.tags.map((t) => `"${t}"`).join(", ")}]`,
    `geo:`,
    `  name: "${frontmatter.geo.name}"`,
    `  lat: ${frontmatter.geo.lat}`,
    `  lon: ${frontmatter.geo.lon}`,
    `  countryCode: "${frontmatter.geo.countryCode}"`,
    `featured: ${frontmatter.featured}`,
    `approved: ${frontmatter.approved}`,
    "---",
    "",
    content.trim(),
    "",
  ].join("\n");

  return yaml;
}

async function readInput(): Promise<string> {
  const args = process.argv.slice(2);

  if (args.includes("--stdin")) {
    // Read from stdin
    return new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", (chunk) => (data += chunk));
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });
  }

  const inputIdx = args.indexOf("--input");
  if (inputIdx !== -1 && args[inputIdx + 1]) {
    const filePath = path.resolve(args[inputIdx + 1]);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Input file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, "utf-8");
  }

  throw new Error("Usage: add-article --input <file.json> or add-article --stdin");
}

async function main() {
  try {
    const raw = await readInput();
    const data = JSON.parse(raw) as ArticlePayload;

    console.log(`\nValidating article: "${data.title}"...`);

    const result = validate(data as unknown as Record<string, unknown>);
    if (!result.valid) {
      console.error("\nValidation failed:");
      result.errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }

    console.log("Validation passed.");

    // Ensure category directory exists
    const categoryDir = path.join(CONTENT_DIR, data.category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    // Generate MDX file
    const mdxContent = generateMdx(data);
    const outputPath = path.join(categoryDir, `${data.id}.mdx`);

    // Check if file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`\nWarning: File already exists, overwriting: ${outputPath}`);
    }

    fs.writeFileSync(outputPath, mdxContent, "utf-8");
    console.log(`\nArticle saved: ${outputPath}`);
    console.log("Done! Run 'npm run build' to regenerate the site.");
  } catch (err) {
    console.error("Error:", (err as Error).message);
    process.exit(1);
  }
}

main();
