import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import XLSX from 'xlsx';
import { WorkbookImportError, PROPERTY_PLACEHOLDER_IMAGE, buildManifestPropertyPlan, deduplicateManifestRows, driveImageUrl, findManifestPropertyMatch, parseWorkbook, validateExpectedWorkbookSource } from '../src/services/workbook-import.js';
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

test('parses the supplied 251-listing photo manifest', async () => {
  const parsed = parseWorkbook(await readWorkbook('Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx'), 'photos.xlsx');
  assert.equal(parsed.source, 'workbook');
  assert.equal(parsed.rows.length, 251);
  assert.equal(parsed.rows.filter(row => row.pages === 'Bought with Gurmeet').length, 182);
  assert.equal(parsed.rows.filter(row => row.pages === 'Sold by Gurmeet').length, 69);
  assert.equal(parsed.rows[0].propertySlug, '1995-eleanor-loop-dublin-ca-94568-zillow-zillow-all-properties-8');
  assert.equal(parsed.rows[0].imageUrl, driveImageUrl('https://drive.google.com/file/d/1nb6xESBTDmwFUMzKJYr1hIGvpMyQ4wPO/view?usp=drivesdk'));
  assert.equal(parsed.rows[0].propertySource, 'zillow');
  assert.equal(parsed.rows[0].transactionSide, 'Buyer');
});

test('builds a manifest replacement plan with stable matching and preserved fields', () => {
  const existing = [{
    _id: 'existing-id',
    slug: 'existing-property',
    title: 'Old title',
    address: { street: '1 Main St', city: 'Fremont', state: 'CA', zip: '94536', normalized: '1mainstfremontca94536' },
    price: 850000,
    beds: 3,
    sqft: 1800,
    description: 'Existing description',
    coordinates: { lat: 1, lng: 2 },
    source: { name: 'redfin', providers: ['redfin'] },
    transaction: { soldDate: new Date('2024-01-01T00:00:00.000Z') },
  }];
  const rows = [{
    propertySlug: 'existing-property',
    propertySource: 'redfin',
    title: 'New title',
    address: existing[0].address,
    imageUrl: 'https://drive.google.com/uc?export=view&id=image',
    propertyPage: 'https://homesbygurmeet.com/properties/existing-property',
    pages: 'Sold by Gurmeet',
    transactionSide: 'Seller',
    source: { name: 'workbook', externalId: 'existing-property' },
    verificationNotes: 'Verified image',
  }];
  const plan = buildManifestPropertyPlan(rows, existing);
  assert.equal(plan.updated, 1);
  assert.equal(plan.created, 0);
  assert.equal(plan.removeIds.length, 0);
  assert.equal(plan.listings[0].match._id, 'existing-id');
  assert.equal(plan.listings[0].payload.status, 'Sold');
  assert.equal(plan.listings[0].payload.price, 850000);
  assert.equal(plan.listings[0].payload.description, 'Existing description');
  assert.deepEqual(plan.listings[0].payload.coordinates, { lat: 1, lng: 2 });
  assert.equal(plan.listings[0].payload.transaction.soldDate.toISOString(), '2024-01-01T00:00:00.000Z');
  assert.equal(plan.listings[0].payload.transaction.side, 'Seller');
  assert.deepEqual(plan.listings[0].payload.images, [PROPERTY_PLACEHOLDER_IMAGE]);
  assert.deepEqual(plan.listings[0].payload.photoManifest.imageUrls, ['https://drive.google.com/uc?export=view&id=image']);
});

test('deduplicates the supplied 251-row workbook by address', async () => {
  const parsed = parseWorkbook(await readWorkbook('Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx'), 'photos.xlsx');
  const plan = buildManifestPropertyPlan(parsed.rows, []);
  assert.equal(parsed.rows.length, 251);
  assert.equal(plan.totalListings, 203);
  assert.equal(plan.ignored, 48);
  assert.equal(plan.listings.every(({ payload }) => payload.images.includes(PROPERTY_PLACEHOLDER_IMAGE)), true);
});

test('merges duplicate address sides and metadata while keeping the most complete row', () => {
  const rows = [
    { address: { street: '1 Main St', city: 'Fremont', state: 'CA', zip: '94536', normalized: '1mainstfremontca94536' }, title: 'Main Street', propertySlug: 'main-st', transactionSide: 'Buyer', propertySource: 'zillow', verificationNotes: 'Buyer verified' },
    { address: { street: '1 Main St', city: 'Fremont', state: 'CA', zip: '94536', normalized: '1mainstfremontca94536' }, title: 'Main Street, Fremont', propertySlug: 'main-st-redfin', transactionSide: 'Seller', propertySource: 'redfin', price: 900000, imageUrl: 'https://example.com/main.jpg', verificationNotes: 'Seller verified' },
  ];
  const result = deduplicateManifestRows(rows);
  assert.equal(result.ignored, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].transactionSide, 'Buyer & Seller');
  assert.equal(result.rows[0].price, 900000);
  assert.deepEqual(result.rows[0].propertySources, ['redfin', 'zillow']);
  assert.deepEqual(result.rows[0].imageUrls, ['https://example.com/main.jpg']);
});

test('creates unmatched sold rows, removes absent properties, and ignores duplicate stable identities', () => {
  const existing = [{ _id: 'old-id', slug: 'old-property', address: { street: 'Old St', city: 'Fremont', state: 'CA', zip: '94536' } }];
  const row = {
    propertySlug: 'new-property',
    address: { street: '2 Main St', city: 'Fremont', state: 'CA', zip: '94536', normalized: '2mainstfremontca94536' },
    title: 'New property',
    propertyPage: 'https://homesbygurmeet.com/properties/new-property',
    pages: 'Bought with Gurmeet',
    transactionSide: 'Buyer',
    source: { name: 'workbook', externalId: 'new-property' },
  };
  const plan = buildManifestPropertyPlan([row, { ...row, title: 'Duplicate row' }], existing);
  assert.equal(plan.created, 1);
  assert.equal(plan.updated, 0);
  assert.equal(plan.removeIds.length, 1);
  assert.equal(plan.ignored, 1);
  assert.equal(plan.listings[0].payload.status, 'Sold');
  assert.equal(plan.listings[0].payload.price, undefined);
  assert.equal(plan.listings[0].payload.source.name, 'workbook');
});

test('manifest matching uses exact slug before source-aware and unique address matching', () => {
  const row = { propertySlug: 'exact', propertySource: 'zillow', address: { normalized: 'same', street: '1 Main St', city: 'Fremont' } };
  const exact = { _id: 'exact-id', slug: 'exact', source: { name: 'redfin' }, address: { normalized: 'other' } };
  const source = { _id: 'source-id', slug: 'source', source: { name: 'zillow' }, address: { normalized: 'same' } };
  assert.equal(findManifestPropertyMatch(row, [exact, source])._id, 'exact-id');
  assert.equal(findManifestPropertyMatch({ ...row, propertySlug: 'missing' }, [source])._id, 'source-id');
});

test('rejects a workbook uploaded through the wrong source control', () => {
  assert.throws(() => validateExpectedWorkbookSource('redfin', 'workbook'), WorkbookImportError);
  assert.throws(() => validateExpectedWorkbookSource('workbook', 'unknown'), WorkbookImportError);
  assert.doesNotThrow(() => validateExpectedWorkbookSource('workbook', 'workbook'));
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

test('rejects non-empty manifest rows with malformed addresses or missing property pages', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Property name', 'Address', 'Google Drive image link', 'Status', 'Page(s)', 'Property page', 'Photo source', 'Verification notes'],
    ['Bad row', 'not an address', 'https://drive.google.com/file/d/id/view', 'Verified', 'Bought with Gurmeet', 'https://homesbygurmeet.com/properties/bad-row', '', ''],
  ]), 'Portfolio — all listings');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  assert.throws(() => parseWorkbook(buffer, 'photos.xlsx'), WorkbookImportError);
});
