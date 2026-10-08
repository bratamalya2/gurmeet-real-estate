import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import XLSX from 'xlsx';
import { WorkbookImportError, buildWorkbookListings, parseWorkbook, validateExpectedWorkbookSource } from '../src/services/workbook-import.js';
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
  assert.equal(parsed.rows.length, 207);
  assert.equal(parsed.rows.filter(row => row.status === 'Active').length, 2);
  assert.equal(parsed.rows.some(row => /undisclosed|could not be loaded/i.test(row.address.street)), false);
  const active = parsed.rows.find(row => row.address.street === '478 Ribier Ct' && row.status === 'Active');
  assert.equal(active.status, 'Active');
  assert.equal(active.transaction.soldDate, undefined);
  const dualRepresentation = parsed.rows.find(row => row.address.street === '3806 Amy Ct');
  assert.equal(dualRepresentation.transaction.side, 'Buyer & Seller');
  assert.equal(dualRepresentation.transaction.soldDate.toISOString(), '2019-10-05T00:00:00.000Z');
  assert.match(dualRepresentation.transaction.verification, /estimated/i);
  const repeatedAddress = parsed.rows.filter(row => row.address.street === '478 Ribier Ct');
  assert.equal(repeatedAddress.length, 2);
  assert.equal(new Set(repeatedAddress.map(row => row.source.externalId)).size, 2);
});

test('keeps source rows separate when addresses are repeated across workbooks', async () => {
  const redfin = parseWorkbook(await readWorkbook('Gurmeet_Singh_Full_Property_Data_For_Website.xlsx'));
  const zillow = parseWorkbook(await readWorkbook('Gurmeet_Singh_All_Zillow_Properties.xlsx'));
  const listings = buildWorkbookListings(redfin.rows, zillow.rows);
  const duplicates = listings.filter(row => row.address.street === '3586 Somerset Ave');
  assert.equal(duplicates.length, 2);
  assert.deepEqual(duplicates.map(row => row.source.name).sort(), ['redfin', 'zillow']);
  assert.equal(new Set(duplicates.map(row => row.slug)).size, 2);
  assert.equal(listings.some(row => row.address.street === '3806 Amy Ct'), true);
});

test('rejects a workbook uploaded through the wrong source control', () => {
  assert.throws(() => validateExpectedWorkbookSource('redfin', 'zillow'), WorkbookImportError);
  assert.throws(() => validateExpectedWorkbookSource('zillow', 'unknown'), WorkbookImportError);
  assert.doesNotThrow(() => validateExpectedWorkbookSource('zillow', 'zillow'));
});

test('keeps the ten highest-priced listings for homepage features, including sold residences', () => {
  const properties = [
    { _id: 'sold', status: 'Sold', price: 9000000, updatedAt: '2026-10-04' },
    { _id: 'unpriced', status: 'Active', updatedAt: '2026-10-04' },
    ...[800, 700, 600, 500, 400, 300, 200, 100, 50, 25, 10].map((price, index) => ({
      _id: String(index), status: index % 2 ? 'Pending' : 'Active', price, updatedAt: `2026-10-${String(index + 1).padStart(2, '0')}`,
    })),
  ];
  assert.deepEqual(highestValueProperties(properties).map(property => property.price), [9000000, 800, 700, 600, 500, 400, 300, 200, 100, 50]);
});

test('rejects unsupported workbooks before any database work', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Unknown']]), 'Unknown');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  assert.throws(() => parseWorkbook(buffer, 'unknown.xlsx'), WorkbookImportError);
});
