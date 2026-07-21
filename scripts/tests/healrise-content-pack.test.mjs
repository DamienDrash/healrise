import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BANNED_RISKY_PATTERNS, validateContentPack } from "../validate-content-pack.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PACK_PATH = join(ROOT, "strapi", "data", "healrise-content-pack-v1.json");
const SCHEMA_PATH = join(ROOT, "strapi", "src", "api", "program", "content-types", "program", "schema.json");
const pack = JSON.parse(readFileSync(PACK_PATH, "utf8"));
const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const records = pack.programs;

const requiredFields = ["title", "slug", "description", "body", "plan_required", "category", "content_type", "week", "day", "order", "duration_minutes", "is_featured", "media_source"];

test("HEALRISE content pack parses and contains a review-sized first batch", () => {
  assert.equal(pack.version, "v1");
  assert.equal(pack.source, "notion-sanitized");
  assert.ok(Array.isArray(records));
  assert.ok(records.length >= 12 && records.length <= 16, `unexpected record count: ${records.length}`);
});

test("all program records include required Strapi seed fields and unique stable slugs", () => {
  const slugs = new Set();
  for (const record of records) {
    for (const field of requiredFields) assert.ok(Object.hasOwn(record, field), `${record.slug ?? record.title} missing ${field}`);
    assert.match(record.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!slugs.has(record.slug), `duplicate slug ${record.slug}`);
    slugs.add(record.slug);
    assert.ok(record.body.includes("<"), `${record.slug} body should be HTML/rich text`);
  }
});

test("plan, category, content_type and media_source values match Strapi enums", () => {
  const attrs = schema.attributes;
  for (const record of records) {
    assert.ok(attrs.plan_required.enum.includes(record.plan_required), `${record.slug} invalid plan`);
    assert.ok(attrs.category.enum.includes(record.category), `${record.slug} invalid category`);
    assert.ok(attrs.content_type.enum.includes(record.content_type), `${record.slug} invalid content_type`);
    assert.ok(attrs.media_source.enum.includes(record.media_source), `${record.slug} invalid media_source`);
  }
});

test("paid plans and recommended first modules are represented", () => {
  for (const plan of ["healrise7", "healrise14", "premium"]) {
    assert.ok(records.some((r) => r.plan_required === plan), `${plan} missing`);
  }
  for (const slug of ["willkommen-healrise-orientierung", "sieben-wohlfuehl-basics", "healing-nest-vorbereiten", "woche-2-sanfter-uebergang", "sechs-wochen-ueberblick"]) {
    assert.ok(records.some((r) => r.slug === slug), `${slug} missing`);
  }
});

test("content pack has no risky medical claims or raw Notion placeholders", () => {
  const result = validateContentPack(pack);
  assert.deepEqual(result.errors, []);
  assert.ok(BANNED_RISKY_PATTERNS.length >= 8, "claims guard should cover the known risky Notion language");
});
