import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const schemaDirectory = path.resolve("schemas");
const schemaFiles = (await readdir(schemaDirectory))
  .filter((file) => file.endsWith(".schema.json"))
  .sort();

if (schemaFiles.length === 0) {
  throw new Error("No JSON schemas found in schemas/");
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

for (const file of schemaFiles) {
  const contents = await readFile(path.join(schemaDirectory, file), "utf8");
  const schema = JSON.parse(contents);
  ajv.compile(schema);
}

console.log(`PASS: compiled ${schemaFiles.length} JSON schemas`);
