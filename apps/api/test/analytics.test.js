import assert from 'node:assert/strict';
import test from 'node:test';
import { AnalyticsEvent } from '../src/models/index.js';
import { AnalyticsRangeError, inventoryMetrics, parseAnalyticsRange } from '../src/services/analytics.js';

test('defaults analytics to the last 30 UTC calendar days', () => {
  const range = parseAnalyticsRange({ now: new Date('2026-10-04T12:00:00.000Z') });
  assert.equal(range.from, '2026-09-05T00:00:00.000Z');
  assert.equal(range.to, '2026-10-05T00:00:00.000Z');
});

test('supports all-time and custom analytics ranges', () => {
  const all = parseAnalyticsRange({ range: 'all' });
  assert.equal(all.from, undefined);
  assert.equal(all.to, undefined);
  const custom = parseAnalyticsRange({ from: '2026-09-01', to: '2026-09-30' });
  assert.equal(custom.from, '2026-09-01T00:00:00.000Z');
  assert.equal(custom.to, '2026-10-01T00:00:00.000Z');
});

test('rejects invalid or reversed analytics ranges', () => {
  assert.throws(() => parseAnalyticsRange({ from: '2026-02-30', to: '2026-03-01' }), AnalyticsRangeError);
  assert.throws(() => parseAnalyticsRange({ from: '2026-10-05', to: '2026-10-04' }), AnalyticsRangeError);
});

test('calculates inventory status, city, source, image, and price metrics', () => {
  const result = inventoryMetrics([
    { status: 'Active', price: 500000, images: ['/one'], address: { city: 'Fremont' }, source: { name: 'workbook', providers: ['redfin', 'zillow'] } },
    { status: 'Active', price: 700000, images: [], address: { city: 'Fremont' }, source: { name: 'workbook', providers: ['redfin'] } },
    { status: 'Sold', price: 400000, images: ['/two'], address: { city: 'Hayward' }, source: { name: 'manual' } },
  ]);
  assert.deepEqual(result.byStatus, [{ status: 'Active', count: 2 }, { status: 'Pending', count: 0 }, { status: 'Sold', count: 1 }]);
  assert.deepEqual(result.byCity[0], { label: 'Fremont', count: 2 });
  assert.equal(result.price.average, 600000);
  assert.deepEqual(result.imageCoverage, { withImages: 2, withoutImages: 1 });
  assert.equal(result.sourceCoverage.find(item => item.label === 'redfin').count, 2);
});

test('analytics events have the required types, indexes, and 24-month TTL', () => {
  assert.deepEqual(AnalyticsEvent.schema.path('type').enumValues, ['page_view', 'listing_view']);
  assert.equal(AnalyticsEvent.schema.path('path').options.maxlength, 300);
  const indexes = AnalyticsEvent.schema.indexes();
  assert.equal(indexes.some(([fields]) => fields.type === 1 && fields.createdAt === 1), true);
  assert.equal(indexes.some(([fields]) => fields.property === 1 && fields.createdAt === 1), true);
  assert.equal(AnalyticsEvent.schema.path('createdAt').options.index.expires, 60 * 60 * 24 * 730);
});
