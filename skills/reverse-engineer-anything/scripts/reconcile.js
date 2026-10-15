#!/usr/bin/env node
// Diff an original table against a rebuilt one, by key.
// Usage: node reconcile.js original.(csv|xlsx) rebuild.(csv|xlsx) --key "Col A[,Col B]" [--cols "M1,M2"] [--tol 0.01] [--sheet Name] [--limit 20]
// CSV works with no dependencies; .xlsx needs `npm i xlsx`.
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { files: [], tol: 0.01, limit: 20 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args.files.push(a);
  }
  args.tol = Number(args.tol);
  args.limit = Number(args.limit);
  return args;
}

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(v => v !== ''))
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function loadTable(file, sheet) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.csv' || ext === '.txt') return parseCsv(fs.readFileSync(file, 'utf8'));
  let XLSX;
  try { XLSX = require('xlsx'); } catch { throw new Error(`Reading ${ext} needs the xlsx package: npm i xlsx`); }
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[sheet || wb.SheetNames[0]];
  if (!ws) throw new Error(`Sheet not found: ${sheet}`);
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,\s฿]/g, '').replace(/^\((.*)\)$/, '-$1');
  return s === '' || s === '-' ? 0 : Number(s);
}

function indexByKey(rows, keys, label) {
  const map = new Map();
  let dupes = 0;
  for (const r of rows) {
    const k = keys.map(c => String(r[c] ?? '').trim()).join(' | ');
    if (map.has(k)) dupes++;
    map.set(k, r);
  }
  if (dupes) console.warn(`⚠️  ${label}: ${dupes} duplicate key(s) — aggregate to the key's grain first.`);
  return map;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.files.length !== 2 || !args.key) {
    console.error('Usage: node reconcile.js original rebuild --key "Col[,Col]" [--cols "M1,M2"] [--tol 0.01] [--sheet Name] [--limit 20]');
    process.exit(2);
  }
  const keys = args.key.split(',').map(s => s.trim());
  const orig = loadTable(args.files[0], args.sheet);
  const rebuilt = loadTable(args.files[1], args.sheet);

  for (const [label, rows] of [['original', orig], ['rebuild', rebuilt]]) {
    const missing = keys.filter(k => rows.length && !(k in rows[0]));
    if (missing.length) throw new Error(`${label} is missing key column(s): ${missing.join(', ')}`);
  }

  const cols = args.cols
    ? args.cols.split(',').map(s => s.trim())
    : Object.keys(orig[0] || {}).filter(c => !keys.includes(c) && orig.every(r => !isNaN(toNumber(r[c]))));

  const A = indexByKey(orig, keys, 'original');
  const B = indexByKey(rebuilt, keys, 'rebuild');

  const onlyA = [...A.keys()].filter(k => !B.has(k));
  const onlyB = [...B.keys()].filter(k => !A.has(k));
  const diffs = [];
  const totals = Object.fromEntries(cols.map(c => [c, { orig: 0, rebuild: 0 }]));

  for (const [k, ra] of A) { for (const c of cols) totals[c].orig += toNumber(ra[c]); }
  for (const [k, rb] of B) { for (const c of cols) totals[c].rebuild += toNumber(rb[c]); }
  for (const [k, ra] of A) {
    const rb = B.get(k);
    if (!rb) continue;
    for (const c of cols) {
      const d = toNumber(rb[c]) - toNumber(ra[c]);
      if (Math.abs(d) > args.tol) diffs.push({ key: k, col: c, orig: toNumber(ra[c]), rebuild: toNumber(rb[c]), diff: d });
    }
  }
  diffs.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));

  const fmt = n => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  console.log(`\nKeys: ${keys.join(' + ')}   Measures: ${cols.join(', ')}   Tolerance: ±${args.tol}`);
  console.log(`Rows — original: ${A.size}, rebuild: ${B.size}, matched keys: ${A.size - onlyA.length}`);

  console.log('\nTotals');
  for (const c of cols) {
    const t = totals[c], d = t.rebuild - t.orig;
    const ratio = t.orig ? (t.rebuild / t.orig).toFixed(4) : 'n/a';
    console.log(`  ${Math.abs(d) <= args.tol ? '✅' : '❌'} ${c}: original ${fmt(t.orig)} | rebuild ${fmt(t.rebuild)} | diff ${fmt(d)} | ratio ${ratio}`);
  }

  const show = (title, list) => {
    console.log(`\n${title}: ${list.length}`);
    list.slice(0, args.limit).forEach(x => console.log('  ' + x));
  };
  show('Only in original (filter/join too strict?)', onlyA);
  show('Only in rebuild (filter/join too loose?)', onlyB);
  console.log(`\nValue mismatches beyond tolerance: ${diffs.length} (largest first)`);
  diffs.slice(0, args.limit).forEach(d =>
    console.log(`  [${d.key}] ${d.col}: original ${fmt(d.orig)} → rebuild ${fmt(d.rebuild)} (diff ${fmt(d.diff)})`));

  const pass = !onlyA.length && !onlyB.length && !diffs.length;
  console.log(`\n${pass ? '✅ MATCH' : '❌ NOT MATCHED'}\n`);
  process.exit(pass ? 0 : 1);
}

try { main(); } catch (e) { console.error('Error: ' + e.message); process.exit(2); }
