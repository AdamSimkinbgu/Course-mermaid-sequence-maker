import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

// Import compiled modules from dist outputs
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const parserExcel = await import(path.resolve(__dirname, '../packages/parser-excel/dist/index.js'));

const csvPath = path.resolve(__dirname, '../resources/templates/courses-template.csv');
const csv = fs.readFileSync(csvPath, 'utf8');

function parseCsv(text) {
  const rows = [];
  let i = 0, field = '', inQuotes = false, row = [];
  while (i < text.length) {
    const c = text[i++];
    if (inQuotes) {
      if (c === '"') {
        if (text[i] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else { field += c; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const table = parseCsv(csv).filter(r => r.length && r.some(v => v !== ''));
const header = table.shift();
const rows = table.map(cols => Object.fromEntries(header.map((h, idx) => [h, cols[idx] ?? ''])));

const { parseRows } = parserExcel;
const result = parseRows(rows);

console.log('Smoke test: parsed graph summary');
console.log({ nodes: result.graph.nodes.length, edges: result.graph.edges.length, diagnostics: result.diagnostics });

if (result.diagnostics.length) {
  console.warn('Diagnostics present. Please review.');
}
