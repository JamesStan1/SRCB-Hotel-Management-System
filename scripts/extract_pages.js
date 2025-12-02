// scripts/extract_pages.js
// Recursively find all `page.js` files under ./app and copy them into ./functions/pages
// preserving the subdirectory structure.

const fs = require('fs');
const path = require('path');

function walk(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, filelist);
    } else {
      filelist.push(full);
    }
  });
  return filelist;
}

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function main() {
  const root = path.resolve(process.cwd(), 'app');
  if (!fs.existsSync(root)) {
    console.error('app/ directory not found in', process.cwd());
    process.exit(1);
  }

  const allFiles = walk(root);
  const pageFiles = allFiles.filter(f => path.basename(f) === 'page.js' || path.basename(f) === 'page.jsx' || path.basename(f) === 'page.tsx');

  const destRoot = path.resolve(process.cwd(), 'functions', 'pages');
  ensureDir(destRoot);

  const copied = [];
  pageFiles.forEach(src => {
    const rel = path.relative(root, src); // e.g. dashboard/overview/page.js
    const destDir = path.join(destRoot, path.dirname(rel));
    ensureDir(destDir);
    const dest = path.join(destDir, path.basename(src));

    // Add header comment with source
    const content = fs.readFileSync(src, 'utf8');
    const header = `// MIRROR OF: app/${rel}\r\n// Created by scripts/extract_pages.js on ${new Date().toISOString()}\r\n// NOTE: This is a copy for review purposes. Do not edit here; edit the source in app/.\r\n\r\n`;
    fs.writeFileSync(dest, header + content, 'utf8');
    copied.push({ src, dest });
  });

  console.log('Copied', copied.length, 'page files to', destRoot);
  copied.forEach(c => console.log('-', c.dest));
}

main();
