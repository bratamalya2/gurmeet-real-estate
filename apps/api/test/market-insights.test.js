import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMarketInsights } from '../src/services/market-insights.js';
import { propertySideFilter } from '../src/services/property-filters.js';

const soldProperties = [
  { _id: 'one', slug: 'one', address: { street: '1 Main St', city: 'Fremont' }, price: 500000, beds: 3, baths: 2, sqft: 1000, transaction: { soldDate: new Date('2024-01-15') }, updatedAt: new Date('2024-02-01') },
  { _id: 'two', slug: 'two', address: { street: '2 Main St', city: 'Fremont' }, price: 700000, beds: 4, baths: 3, sqft: 1400, transaction: { soldDate: new Date('2025-01-15') }, updatedAt: new Date('2025-02-01') },
  { _id: 'three', slug: 'three', address: { street: '3 Main St', city: 'Hayward' }, beds: 2, baths: 1, updatedAt: new Date('2026-01-01') },
];

test('property side filters include Buyer & Seller records', () => {
  assert.equal(propertySideFilter('buyer')['transaction.side'].test('Buyer'), true);
  assert.equal(propertySideFilter('buyer')['transaction.side'].test('Buyer & Seller'), true);
  assert.equal(propertySideFilter('seller')['transaction.side'].test('Seller'), true);
  assert.equal(propertySideFilter('seller')['transaction.side'].test('Buyer & Seller'), true);
  assert.equal(propertySideFilter('unknown'), null);
});

test('market insights calculate price, size, city, year, and price-band metrics', () => {
  const result = buildMarketInsights(soldProperties);
  assert.equal(result.soldCount, 3);
  assert.equal(result.totalSalesVolume, 1200000);
  assert.equal(result.averageSalePrice, 600000);
  assert.equal(result.medianSalePrice, 600000);
  assert.equal(result.averagePricePerSqft, 500);
  assert.equal(result.averageSqft, 1200);
  assert.equal(result.averageBeds, 3);
  assert.equal(result.averageBaths, 2);
  assert.deepEqual(result.coverage, { priced: 2, withSquareFootage: 2, withSoldDate: 2 });
  assert.deepEqual(result.byYear.map(item => item.year), [2024, 2025]);
  assert.deepEqual(result.byCity.map(item => item.city), ['Fremont', 'Hayward']);
  assert.deepEqual(result.priceBands.map(item => item.count), [0, 2, 0, 0]);
  assert.equal(result.recentSales[0].street, '3 Main St');
});

test('market insights exclude malformed metrics and return an empty shape', () => {
  const incomplete = buildMarketInsights([{ address: {}, price: '', sqft: 0, beds: null, baths: 'not a number', transaction: { soldDate: 'not a date' } }]);
  assert.deepEqual(incomplete.coverage, { priced: 0, withSquareFootage: 0, withSoldDate: 0 });
  assert.equal(incomplete.averageSalePrice, 0);
  assert.equal(incomplete.recentSales.length, 1);

  const empty = buildMarketInsights([]);
  assert.deepEqual(empty, {
    soldCount: 0,
    totalSalesVolume: 0,
    averageSalePrice: 0,
    medianSalePrice: 0,
    averagePricePerSqft: 0,
    averageSqft: 0,
    averageBeds: 0,
    averageBaths: 0,
    coverage: { priced: 0, withSquareFootage: 0, withSoldDate: 0 },
    byYear: [],
    byCity: [],
    priceBands: [{ label: 'Under $500K', count: 0 }, { label: '$500K–$750K', count: 0 }, { label: '$750K–$1M', count: 0 }, { label: '$1M+', count: 0 }],
    recentSales: [],
  });
});
