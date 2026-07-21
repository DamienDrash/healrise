import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROGRAM_SCHEMA = join(ROOT, "strapi", "src", "api", "program", "content-types", "program", "schema.json");
const PROGRAM_SERVICE = join(ROOT, "strapi", "src", "api", "program", "services", "program.ts");
const PROGRAM_API = join(ROOT, "app", "src", "api", "programs.js");

const schema = JSON.parse(readFileSync(PROGRAM_SCHEMA, "utf8"));
const service = readFileSync(PROGRAM_SERVICE, "utf8");
const api = readFileSync(PROGRAM_API, "utf8");

test("program schema models mixed media content types and sources", () => {
  const attrs = schema.attributes;
  for (const type of ["pdf", "audio", "checklist", "external_embed"]) {
    assert.ok(attrs.content_type.enum.includes(type), `content_type enum fehlt ${type}`);
  }
  assert.deepEqual(attrs.media_source, {
    type: "enumeration",
    enum: ["none", "strapi", "minio", "youtube", "soundcloud", "vimeo", "bunny", "mux", "external"],
    default: "none",
  });
  assert.equal(attrs.media_url.type, "string");
  assert.equal(attrs.media_asset.type, "media");
  assert.equal(attrs.media_asset.multiple, false);
  assert.deepEqual(attrs.media_asset.allowedTypes, ["files", "videos", "audios", "images"]);
  assert.equal(attrs.media_embed_id.type, "string");
  assert.equal(attrs.media_title.type, "string");
  assert.equal(attrs.media_duration_seconds.type, "integer");
  assert.equal(attrs.media_access_note.type, "text");
});

test("program locked-state gating protects media payload fields", () => {
  const match = service.match(/PROTECTED_FIELDS\s*=\s*\[([^\]]+)\]/s);
  assert.ok(match, "PROTECTED_FIELDS export nicht gefunden");
  for (const field of ["body", "video_url", "media_url", "media_asset", "media_embed_id"]) {
    assert.ok(match[1].includes(`'${field}'`) || match[1].includes(`"${field}"`), `PROTECTED_FIELDS fehlt ${field}`);
  }
  assert.ok(service.includes("hasOwnProperty.call(program, 'plan_required')"), "Gating muss bei fehlendem plan_required fail-closed bleiben");
});

test("frontend normalizes and populates media fields", () => {
  // Normalisierte Felder inkl. der Media-Felder (Beweis, dass sie erwartet werden).
  for (const field of ["thumbnail", "media_source", "media_url", "media_asset", "media_embed_id", "media_title", "media_duration_seconds"]) {
    assert.match(api, new RegExp(`${field}:`), `normalizeProgram fehlt ${field}`);
  }
  // Strapi 5 lehnt explizite Media-Populate-Keys ab ("Invalid key media_asset").
  // `populate: "*"` populiert die Top-Level-Media-Felder (media_asset UND thumbnail)
  // mit — daher MUSS es in beiden Requests (getPrograms + getProgram) stehen.
  const wildcard = api.match(/populate:\s*['"]\*['"]/g) || [];
  assert.ok(
    wildcard.length >= 2,
    `getPrograms UND getProgram müssen populate:"*" nutzen (deckt media_asset/thumbnail ab), gefunden: ${wildcard.length}`,
  );
  assert.doesNotMatch(api, /populate\[media_asset\]/, "explizite Media-Keys sind in Strapi 5 ungültig");
});
