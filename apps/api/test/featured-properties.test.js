import assert from 'node:assert/strict';
import test from 'node:test';
import { highestValueProperties, selectFeaturedProperties } from '../src/services/featured-properties.js';

const property = (id, status, price, normalized, updatedAt = '2026-10-01') => ({
  _id: id,
  status,
  price,
  updatedAt,
  address: { normalized },
});

test('prefers priced active and pending properties over sold properties', () => {
  const result = selectFeaturedProperties([
    property('active', 'Active', 500000, 'active-address'),
  ], [
    property('sold', 'Sold', 900000, 'sold-address'),
  ]);
  assert.deepEqual(result.map(item => item._id), ['active']);
});

test('falls back to the highest-priced sold properties when no active or pending listings exist', () => {
  const result = selectFeaturedProperties([], [
    property('lower', 'Sold', 400000, 'lower-address'),
    property('higher', 'Sold', 800000, 'higher-address'),
    property('unpriced', 'Sold', undefined, 'unpriced-address'),
  ]);
  assert.deepEqual(result.map(item => item._id), ['higher', 'lower']);
});

test('deduplicates addresses and keeps the highest-priced duplicate', () => {
  const result = highestValueProperties([
    property('lower', 'Active', 500000, 'same-address'),
    property('higher', 'Pending', 700000, 'same-address'),
    property('other', 'Active', 600000, 'other-address'),
  ]);
  assert.deepEqual(result.map(item => item._id), ['higher', 'other']);
});

test('keeps equal-price ordering deterministic by updated date and id', () => {
  const result = highestValueProperties([
    property('older', 'Active', 500000, 'older-address', '2026-10-01'),
    property('newer', 'Active', 500000, 'newer-address', '2026-10-02'),
    property('id-a', 'Active', 500000, 'a-address', '2026-10-02'),
    property('id-b', 'Active', 500000, 'b-address', '2026-10-02'),
  ]);
  assert.deepEqual(result.map(item => item._id), ['id-a', 'id-b', 'newer', 'older']);
});

test('returns no results when neither active/pending nor sold records have prices', () => {
  const result = selectFeaturedProperties([
    property('unpriced-active', 'Active', undefined, 'active-address'),
  ], [
    property('unpriced-sold', 'Sold', 0, 'sold-address'),
  ]);
  assert.deepEqual(result, []);
});

test('limits featured results to ten properties', () => {
  const result = highestValueProperties(Array.from({ length: 12 }, (_, index) => property(String(index), 'Sold', 1000000 - index, `address-${index}`)), { statuses: ['Sold'] });
  assert.equal(result.length, 10);
});
