import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src");
const files = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    const stat = fs.statSync(file);
    if (stat.isDirectory()) walk(file);
    else files.push(file);
  }
};
walk(root);

let missingImports = 0;
let braceErrors = 0;
let forbiddenRefs = 0;
const candidates = (base) => [
  base,
  `${base}.js`,
  `${base}.jsx`,
  `${base}.scss`,
  `${base}.css`,
  path.join(base, "index.js"),
  path.join(base, "index.jsx"),
];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (/\.(js|jsx)$/.test(file)) {
    for (const match of text.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const base = path.resolve(path.dirname(file), match[1]);
      if (!candidates(base).some(fs.existsSync)) {
        missingImports += 1;
        console.error("MISSING IMPORT", path.relative(process.cwd(), file), match[1]);
      }
    }
  }
  if (/\.(scss|css)$/.test(file)) {
    let depth = 0;
    for (const ch of text) {
      if (ch === "{") depth += 1;
      if (ch === "}") depth -= 1;
      if (depth < 0) break;
    }
    if (depth !== 0) {
      braceErrors += 1;
      console.error("CSS BRACE", path.relative(process.cwd(), file));
    }
  }
  if (/onrender\.com|localhost:\d+/i.test(text)) {
    forbiddenRefs += 1;
    console.error("FORBIDDEN REF", path.relative(process.cwd(), file));
  }
}

console.log(JSON.stringify({ sourceFiles: files.length, missingImports, braceErrors, forbiddenRefs }, null, 2));
if (missingImports || braceErrors || forbiddenRefs) process.exit(1);
