/**
 * Internal link checker.
 *
 * Walks the built `dist/` output, extracts every internal `href`, and verifies that a
 * corresponding HTML file exists. This is the check that backs the "no broken internal
 * links" acceptance criterion, and it is deliberately part of the build verification
 * rather than a one-off manual review.
 *
 * Usage: node scripts/check-links.mjs [distDir]
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const distDir = process.argv[2] ?? 'dist';

if (!existsSync(distDir)) {
  console.error(`check-links: "${distDir}" does not exist. Run the site build first.`);
  process.exit(1);
}

/** Collect every HTML file in the output directory. */
function collectHtml(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectHtml(full, acc);
    else if (entry.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const htmlFiles = collectHtml(distDir);

/** Map a URL path to the file that must exist to serve it. */
function candidatesFor(pathname) {
  const clean = pathname.split('#')[0].split('?')[0];
  const normalised = clean.endsWith('/') && clean.length > 1 ? clean.slice(0, -1) : clean;
  const relative = normalised.replace(/^\//, '');
  if (relative === '') return [join(distDir, 'index.html')];
  return [
    join(distDir, `${relative}${sep}index.html`),
    join(distDir, `${relative}.html`),
    join(distDir, relative),
  ];
}

const internal = [];
const external = new Set();
const anchorOnly = new Set();
const seen = new Set();

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const page = `/${file.replace(distDir, '').replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/^\//, '')}`;

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (!href) continue;
    if (href.startsWith('#')) {
      anchorOnly.add(`${page} -> ${href}`);
      continue;
    }
    if (/^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('data:')) {
      external.add(href);
      continue;
    }
    if (!href.startsWith('/')) continue;
    const key = `${page} -> ${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    internal.push({ page, href });
  }
}

const broken = [];
const okCount = { value: 0 };

for (const { page, href } of internal) {
  if (candidatesFor(href).some((candidate) => existsSync(candidate))) {
    okCount.value += 1;
  } else {
    broken.push({ page, href });
  }
}

console.log('check-links');
console.log(`  html files:        ${htmlFiles.length}`);
console.log(`  internal links:    ${internal.length}`);
console.log(`  resolved:          ${okCount.value}`);
console.log(`  external links:    ${external.size}`);
console.log(`  in-page anchors:   ${anchorOnly.size}`);

if (broken.length > 0) {
  console.log(`\n  BROKEN (${broken.length}):`);
  for (const item of broken.slice(0, 40)) {
    console.log(`    ${item.page} -> ${item.href}`);
  }
  process.exit(1);
}

console.log('\n  result: no broken internal links');
