import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPropertyDeduplicationPlan } from '../src/services/property-deduplication.js';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../src/constants/property-assets.js';

const base = {
  address: { normalized: '123mainstreetfremontca94536' },
  status: 'Sold',
  images: [PROPERTY_PLACEHOLDER_IMAGE],
  source: { name: 'workbook', providers: [] },
  photoManifest: {},
  transaction: {},
};

test('keeps one property per normalized address and chooses the most complete record', () => {
  const plan = buildPropertyDeduplicationPlan([
    {
      ...base,
      _id: 'property-a',
      title: '123 Main Street, Fremont',
      price: 900000,
      transaction: { side: 'Buyer' },
      source: { name: 'redfin', providers: ['redfin'] },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      ...base,
      _id: 'property-b',
      title: '123 Main Street, Fremont',
      price: 950000,
      beds: 4,
      baths: 3,
      sqft: 2200,
      description: 'A complete listing record.',
      images: [PROPERTY_PLACEHOLDER_IMAGE, '/uploads/house.webp'],
      source: { name: 'zillow', providers: ['zillow'] },
      transaction: { side: 'Seller', soldDate: '2025-05-01T00:00:00.000Z' },
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ]);

  assert.equal(plan.groups, 1);
  assert.equal(plan.removed, 1);
  assert.equal(plan.retained, 1);
  assert.equal(plan.operations[0].canonicalId, 'property-b');
  assert.deepEqual(plan.operations[0].duplicateIds, ['property-a']);
  assert.deepEqual(plan.operations[0].update.images, ['/uploads/house.webp']);
  assert.deepEqual(plan.operations[0].update.source.providers, ['zillow', 'redfin']);
  assert.equal(plan.operations[0].update.transaction.side, 'Buyer & Seller');
  assert.equal(plan.operations[0].update.price, 950000);
  assert.equal(plan.operations[0].update.beds, 4);
});

test('uses a deterministic ID tie-breaker and merges photo metadata', () => {
  const plan = buildPropertyDeduplicationPlan([
    {
      ...base,
      _id: 'property-z',
      photoManifest: { managedImagePaths: ['/uploads/z.webp'], driveFileIds: ['drive-z'] },
      source: { name: 'zillow', providers: ['zillow'] },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      ...base,
      _id: 'property-a',
      photoManifest: { managedImagePaths: ['/uploads/a.webp'], driveFileIds: ['drive-a'] },
      source: { name: 'redfin', providers: ['redfin'] },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ]);

  assert.equal(plan.operations[0].canonicalId, 'property-a');
  assert.deepEqual(plan.operations[0].update.photoManifest.managedImagePaths, ['/uploads/a.webp', '/uploads/z.webp']);
  assert.deepEqual(plan.operations[0].update.photoManifest.driveFileIds, ['drive-a', 'drive-z']);
});

test('skips properties without normalized addresses and leaves unique records unchanged', () => {
  const plan = buildPropertyDeduplicationPlan([
    { _id: 'missing-address', address: {}, images: [] },
    { ...base, _id: 'unique', address: { normalized: 'uniqueaddress' }, images: [] },
  ]);

  assert.equal(plan.groups, 0);
  assert.equal(plan.removed, 0);
  assert.equal(plan.retained, 2);
  assert.equal(plan.skipped, 1);
  assert.deepEqual(plan.operations, []);
});
