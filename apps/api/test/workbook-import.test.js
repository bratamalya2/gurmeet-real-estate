import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import XLSX from 'xlsx';
import { WorkbookImportError, buildWorkbookListings, driveImageUrl, findPhotoManifestMatch, parseWorkbook, validateExpectedWorkbookSource } from '../src/services/workbook-import.js';
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

test('parses the supplied 251-listing photo manifest', async () => {
  const parsed = parseWorkbook(await readWorkbook('Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx'), 'photos.xlsx');
  assert.equal(parsed.source, 'photos');
  assert.equal(parsed.rows.length, 251);
  assert.equal(parsed.rows.filter(row => row.pages === 'Bought with Gurmeet').length, 182);
  assert.equal(parsed.rows.filter(row => row.pages === 'Sold by Gurmeet').length, 69);
  assert.equal(parsed.rows[0].propertySlug, '1995-eleanor-loop-dublin-ca-94568-zillow-zillow-all-properties-8');
  assert.equal(parsed.rows[0].imageUrl, driveImageUrl('https://drive.google.com/file/d/1nb6xESBTDmwFUMzKJYr1hIGvpMyQ4wPO/view?usp=drivesdk'));
  assert.equal(parsed.rows[0].propertySource, 'zillow');
});

test('photo manifest rows attach to source-specific listing slugs', async () => {
  const redfin = parseWorkbook(await readWorkbook('Gurmeet_Singh_Full_Property_Data_For_Website.xlsx'));
  const zillow = parseWorkbook(await readWorkbook('Gurmeet_Singh_All_Zillow_Properties.xlsx'));
  const photos = parseWorkbook(await readWorkbook('Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx'));
  const listings = buildWorkbookListings(redfin.rows, zillow.rows, photos.rows);
  const mapped = listings.find(row => row.slug === photos.rows[0].propertySlug);
  assert.ok(mapped);
  assert.equal(mapped.images.length, 1);
  assert.equal(mapped.photoManifest.pages, 'Bought with Gurmeet');
});

test('photo manifest matching prefers slug, then source-aware address, then unique address', () => {
  const rows = [
    { propertySlug: 'exact-slug', propertySource: 'zillow', address: { normalized: 'same', street: '1 Main St', city: 'Fremont' } },
    { propertySlug: 'other-slug', propertySource: 'redfin', address: { normalized: 'same', street: '1 Main St', city: 'Fremont' } },
  ];
  assert.equal(findPhotoManifestMatch({ slug: 'exact-slug', source: { name: 'zillow' }, address: { normalized: 'same' } }, rows), rows[0]);
  assert.equal(findPhotoManifestMatch({ slug: 'missing', source: { name: 'redfin' }, address: { normalized: 'same' } }, rows), rows[1]);
  assert.equal(findPhotoManifestMatch({ slug: 'missing', source: { name: 'manual' }, address: { normalized: 'unmatched' } }, rows), null);
});

test('rejects a workbook uploaded through the wrong source control', () => {
  assert.throws(() => validateExpectedWorkbookSource('redfin', 'zillow'), WorkbookImportError);
  assert.throws(() => validateExpectedWorkbookSource('zillow', 'unknown'), WorkbookImportError);
  assert.doesNotThrow(() => validateExpectedWorkbookSource('zillow', 'zillow'));
});

test('keeps the ten highest-priced unique active and pending listings for homepage features', () => {
  const properties = [
    { _id: 'sold', status: 'Sold', price: 9000000, updatedAt: '2026-10-04' },
    { _id: 'unpriced', status: 'Active', updatedAt: '2026-10-04' },
    { _id: 'duplicate-lower', status: 'Active', price: 750, address: { normalized: 'sameaddress' }, updatedAt: '2026-10-01' },
    { _id: 'duplicate-higher', status: 'Pending', price: 800, address: { normalized: 'sameaddress' }, updatedAt: '2026-10-02' },
    ...[700, 600, 500, 400, 300, 200, 100, 50, 25, 10, 5].map((price, index) => ({
      _id: String(index), status: index % 2 ? 'Pending' : 'Active', price, address: { normalized: `address-${index}` }, updatedAt: `2026-10-${String(index + 1).padStart(2, '0')}`,
    })),
  ];
  assert.deepEqual(highestValueProperties(properties).map(property => property.price), [800, 700, 600, 500, 400, 300, 200, 100, 50, 25]);
  assert.equal(highestValueProperties(properties).filter(property => property.address?.normalized === 'sameaddress').length, 1);
});

test('rejects unsupported workbooks before any database work', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Unknown']]), 'Unknown');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  assert.throws(() => parseWorkbook(buffer, 'unknown.xlsx'), WorkbookImportError);
});

test('rejects malformed photo manifests', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Address']]), 'Portfolio — all listings');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  assert.throws(() => parseWorkbook(buffer, 'photos.xlsx'), WorkbookImportError);
});
