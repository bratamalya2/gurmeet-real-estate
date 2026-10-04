import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import XLSX from 'xlsx';
import { WorkbookImportError, mergeWorkbookRows, parseWorkbook } from '../src/services/workbook-import.js';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const readWorkbook = filename => fs.readFile(path.join(projectRoot, 'data', filename));

test('parses the supplied Redfin workbook and active summary', async () => {
  const parsed = parseWorkbook(await readWorkbook('Gurmeet_Singh_Redfin_2026-09-27 (1).xlsx'), 'redfin.xlsx');
  assert.equal(parsed.source, 'redfin');
  assert.equal(parsed.rows.length, 27);
  assert.equal(parsed.rows.filter(row => row.status === 'Active').length, 2);
  assert.equal(parsed.rows.find(row => row.address.street === '478 Ribier Ct').price, 470000);
});

test('parses the supplied Zillow workbook and splits baths from square feet', async () => {
  const parsed = parseWorkbook(await readWorkbook('Gurmeet_Singh_Zillow_2026-09-27 (1).xlsx'), 'zillow.xlsx');
  assert.equal(parsed.source, 'zillow');
  assert.equal(parsed.rows.length, 7);
  assert.equal(parsed.rows.filter(row => row.status === 'Active').length, 2);
  const listing = parsed.rows.find(row => row.address.street === '1449 Dorona Ln');
  assert.equal(listing.baths, 3);
  assert.equal(listing.sqft, 1811);
});

test('keeps legacy Transactions workbook support', async () => {
  const parsed = parseWorkbook(await readWorkbook('Redfin.xlsx'), 'legacy.xlsx');
  assert.equal(parsed.source, 'redfin');
  assert.equal(parsed.rows.length, 123);
  assert.equal(parsed.rows[0].status, 'Active');
});

test('merges duplicate addresses with Redfin as primary and keeps source-only listings', async () => {
  const redfin = parseWorkbook(await readWorkbook('Gurmeet_Singh_Redfin_2026-09-27 (1).xlsx'));
  const zillow = parseWorkbook(await readWorkbook('Gurmeet_Singh_Zillow_2026-09-27 (1).xlsx'));
  const merged = mergeWorkbookRows(redfin.rows, zillow.rows);
  const duplicate = merged.find(row => row.address.street === '3586 Somerset Ave');
  assert.equal(merged.length, 28);
  assert.deepEqual(duplicate.source.providers, ['redfin', 'zillow']);
  assert.equal(duplicate.source.name, 'workbook');
  assert.equal(merged.some(row => row.address.street === '1865 Newport Ct'), true);
});

test('rejects unsupported workbooks before any database work', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Unknown']]), 'Unknown');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  assert.throws(() => parseWorkbook(buffer, 'unknown.xlsx'), WorkbookImportError);
});
