import test from 'node:test';
import assert from 'node:assert/strict';
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
  let i = 0;
  let field = '';
  let inQuotes = false;
  let row = [];
  while (i < text.length) {
    const c = text[i++];
    if (inQuotes) {
      if (c === '"') {
        if (text[i] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // ignore
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const table = parseCsv(csv).filter(r => r.length && r.some(v => v !== ''));
const header = table.shift();
const rows = table.map(cols => Object.fromEntries(header.map((h, idx) => [h, cols[idx] ?? ''])));

const { parseRows } = parserExcel;

test('template courses CSV imports without diagnostics', (t) => {
  const result = parseRows(rows);
  t.diagnostic(`nodes=${result.graph.nodes.length} edges=${result.graph.edges.length}`);
  assert.equal(result.diagnostics.length, 0, 'expected no diagnostics for template CSV');
  assert.equal(result.graph.nodes.length, 6, 'expected six nodes in template');
  assert.equal(result.graph.edges.length, 6, 'expected six edges in template');
});
