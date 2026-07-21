import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const PLAN_ENUM = ["freebie", "healrise7", "healrise14", "premium"];
export const CATEGORY_ENUM = ["ernaehrung", "bewegung", "selfcare", "mindset", "supplements", "narbenpflege", "allgemein"];
export const CONTENT_TYPE_ENUM = ["guide", "video", "tipp", "uebung", "rezept", "pdf", "audio", "checklist", "external_embed"];
export const MEDIA_SOURCE_ENUM = ["none", "strapi", "minio", "youtube", "soundcloud", "vimeo", "bunny", "mux", "external"];

export const REQUIRED_FIELDS = ["title", "slug", "description", "body", "plan_required", "category", "content_type", "week", "day", "order", "duration_minutes", "is_featured", "media_source"];

export const BANNED_RISKY_PATTERNS = [
  /Heilung\s+beschleunigen/i,
  /beschleunigt\s+die\s+Heilung/i,
  /entzündungshemmend\s+wirkt/i,
  /entzündungshemmend/i,
  /Schmerzen?\s+lindern/i,
  /lindert\s+Schmerzen?/i,
  /Risiko\s+senken/i,
  /senkt\s+das\s+Risiko/i,
  /Kapselfibrose/i,
  /\b\d+\s*(mg|g|µg|mcg|IE)\b/i,
  /\bOP\b/,
  /Post-OP/i,
  /\bOperation/i,
  /\bRecovery\b/i,
  /Genesung/i,
  /\bSymptom/i,
  /\bSchmerz/i,
  /\bTherapie/i,
  /\bheilt\b/i,
  /\bBehandlung\b/i,
];

const RAW_NOTION_PLACEHOLDERS = [
  /\[Link zum Blog\]/i,
  /\[TODO\]/i,
  /\[Platzhalter\]/i,
  /Notion\s+TODO/i,
  /Lorem ipsum/i,
];

function textFor(record) {
  return [record.title, record.description, record.body].filter(Boolean).join("\n");
}

export function validateContentPack(pack) {
  const errors = [];
  if (!pack || typeof pack !== "object") return { errors: ["pack must be an object"] };
  if (pack.source !== "notion-sanitized") errors.push("source must be notion-sanitized");
  if (!Array.isArray(pack.programs)) errors.push("programs must be an array");
  const programs = Array.isArray(pack.programs) ? pack.programs : [];
  const slugs = new Set();

  programs.forEach((record, index) => {
    const label = record?.slug ?? `#${index}`;
    for (const field of REQUIRED_FIELDS) {
      if (!Object.hasOwn(record ?? {}, field)) errors.push(`${label}: missing ${field}`);
    }
    if (typeof record?.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.slug)) errors.push(`${label}: invalid slug`);
    if (slugs.has(record?.slug)) errors.push(`${label}: duplicate slug`);
    if (record?.slug) slugs.add(record.slug);
    if (!PLAN_ENUM.includes(record?.plan_required)) errors.push(`${label}: invalid plan_required`);
    if (!CATEGORY_ENUM.includes(record?.category)) errors.push(`${label}: invalid category`);
    if (!CONTENT_TYPE_ENUM.includes(record?.content_type)) errors.push(`${label}: invalid content_type`);
    if (!MEDIA_SOURCE_ENUM.includes(record?.media_source)) errors.push(`${label}: invalid media_source`);
    for (const n of ["week", "day", "order", "duration_minutes"]) {
      if (!Number.isInteger(record?.[n])) errors.push(`${label}: ${n} must be integer`);
    }
    if (typeof record?.is_featured !== "boolean") errors.push(`${label}: is_featured must be boolean`);

    const visible = textFor(record ?? {});
    for (const pattern of BANNED_RISKY_PATTERNS) {
      const match = visible.match(pattern);
      if (match) errors.push(`${label}: risky medical wording '${match[0]}'`);
    }
    for (const pattern of RAW_NOTION_PLACEHOLDERS) {
      const match = visible.match(pattern);
      if (match) errors.push(`${label}: raw placeholder '${match[0]}'`);
    }
  });

  return { errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const packPath = process.argv[2] ?? join(ROOT, "strapi", "data", "healrise-content-pack-v1.json");
  const pack = JSON.parse(readFileSync(packPath, "utf8"));
  const result = validateContentPack(pack);
  if (result.errors.length) {
    console.error(`Content pack validation failed (${result.errors.length}):`);
    for (const error of result.errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }
  console.log(`Content pack OK: ${pack.programs.length} records validated. Dry run only; no database writes.`);
}
