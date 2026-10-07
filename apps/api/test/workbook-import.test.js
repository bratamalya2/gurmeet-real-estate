import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import XLSX from 'xlsx';
import { WorkbookImportError, mergeWorkbookRows, parseWorkbook, validateExpectedWorkbookSource } from '../src/services/workbook-import.js';
import { highestValueProperties } from '../src/services/featured-properties.js';

const projectRoot = path.resolve(import.meta.dirname, '../../..');
const readWorkbook = filename => fs.readFile(path.join(projectRoot, 'data', filename));

test('parses the supplied Redfin Transactions workbook', async () => {
  const parsed = parseWorkbook(await readWorkbook('Gurmeet_Singh_Full_Property_Data_For_Website.xlsx'), 'redfin.xlsx');
  assert.equal(parsed.source, 'redfin');
  assert.equal(parsed.rows.length, 123);
  assert.equal(parsed.rows.filter(row => row.status === 'Active').length, 1);
  assert.equal(parsed.rows.find(row => row.address.street === '1449 Dorona Ln').price, 630000);
});

test('parses the supplied Zillow All Properties workbook and excludes non-listings', async () => {
  const parsed = parseWorkbook(await readWorkbook('Gurmeet_Singh_All_Zillow_Properties.xlsx'), 'zillow.xlsx');
  assert.equal(parsed.source, 'zillow');
  assert.equal(parsed.rows.length, 192);
  assert.equal(parsed.rows.filter(row => row.status === 'Active').length, 2);
  assert.equal(parsed.rows.some(row => /undisclosed|could not be loaded/i.test(row.address.street)), false);
  const active = parsed.rows.find(row => row.address.street === '478 Ribier Ct');
  assert.equal(active.status, 'Active');
  assert.equal(active.transaction.soldDate, undefined);
  const dualRepresentation = parsed.rows.find(row => row.address.street === '3806 Amy Ct');
  assert.equal(dualRepresentation.transaction.side, 'Buyer & Seller');
  assert.equal(dualRepresentation.transaction.soldDate.toISOString(), '2019-10-05T00:00:00.000Z');
  assert.match(dualRepresentation.transaction.verification, /estimated/i);
});

test('merges duplicate addresses with Redfin as primary and keeps source-only listings', async () => {
  const redfin = parseWorkbook(await readWorkbook('Gurmeet_Singh_Full_Property_Data_For_Website.xlsx'));
  const zillow = parseWorkbook(await readWorkbook('Gurmeet_Singh_All_Zillow_Properties.xlsx'));
  const merged = mergeWorkbookRows(redfin.rows, zillow.rows);
  const duplicate = merged.find(row => row.address.street === '3586 Somerset Ave');
  assert.deepEqual(duplicate.source.providers, ['redfin', 'zillow']);
  assert.equal(duplicate.source.name, 'workbook');
  assert.equal(duplicate.price, 949000);
  assert.equal(merged.some(row => row.address.street === '3806 Amy Ct'), true);
});

test('rejects a workbook uploaded through the wrong source control', () => {
  assert.throws(() => validateExpectedWorkbookSource('redfin', 'zillow'), WorkbookImportError);
  assert.throws(() => validateExpectedWorkbookSource('zillow', 'unknown'), WorkbookImportError);
  assert.doesNotThrow(() => validateExpectedWorkbookSource('zillow', 'zillow'));
});

test('keeps only the six highest-priced active or pending listings for homepage features', () => {
  const properties = [
    { _id: 'sold', status: 'Sold', price: 9000000, updatedAt: '2026-10-04' },
    { _id: 'unpriced', status: 'Active', updatedAt: '2026-10-04' },
    ...[700, 600, 500, 400, 300, 200, 100].map((price, index) => ({
      _id: String(index), status: index % 2 ? 'Pending' : 'Active', price, updatedAt: `2026-10-${String(index + 1).padStart(2, '0')}`,
    })),
  ];
  assert.deepEqual(highestValueProperties(properties).map(property => property.price), [700, 600, 500, 400, 300, 200]);
});

test('rejects unsupported workbooks before any database work', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Unknown']]), 'Unknown');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  assert.throws(() => parseWorkbook(buffer, 'unknown.xlsx'), WorkbookImportError);
});
