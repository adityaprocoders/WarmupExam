import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const allFiles = [];

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) return;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else allFiles.push(fullPath);
  });
}
walk(projectRoot);

// Patterns: JS import/require + EJS include()
const patterns = [
  /(?:from|require\()\s*['"](\.\.?\/[^'"]+)['"]/g,   // JS imports
  /include\(\s*['"](\.\.?\/?[^'"]+)['"]\s*\)/g,       // EJS includes
];

let mismatchCount = 0;

allFiles.forEach((file) => {
  if (!file.endsWith('.js') && !file.endsWith('.ejs')) return;

  const content = fs.readFileSync(file, 'utf-8');

  patterns.forEach((regex) => {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      let importPath = match[1];

      // add extension if missing
      if (!path.extname(importPath)) {
        importPath += file.endsWith('.ejs') ? '.ejs' : '.js';
      }

      const resolvedPath = path.resolve(path.dirname(file), importPath);
      const dir = path.dirname(resolvedPath);
      const base = path.basename(resolvedPath);

      if (!fs.existsSync(dir)) return;
      const actualFiles = fs.readdirSync(dir);

      const exactMatch = actualFiles.includes(base);
      const caseInsensitiveMatch = actualFiles.find(
        (f) => f.toLowerCase() === base.toLowerCase()
      );

      if (!exactMatch && caseInsensitiveMatch) {
        mismatchCount++;
        console.log(`❌ MISMATCH in: ${file}`);
        console.log(`   written as : ${base}`);
        console.log(`   actual file: ${caseInsensitiveMatch}`);
        console.log('---');
      }
    }
  });
});

console.log(`\n✅ Scan complete. Found ${mismatchCount} mismatch(es).`);
