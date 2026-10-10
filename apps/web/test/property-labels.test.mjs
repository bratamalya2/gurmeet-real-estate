import assert from 'node:assert/strict';
import test from 'node:test';
import { propertyStatusLabel } from '../lib/property-labels.mjs';

test('uses portfolio-specific labels for sold property cards', () => {
  assert.equal(propertyStatusLabel({ status: 'Sold', portfolioSide: 'buyer' }), 'BOUGHT');
  assert.equal(propertyStatusLabel({ status: 'Sold', portfolioSide: 'seller' }), 'SOLD');
  assert.equal(propertyStatusLabel({ status: 'Sold' }), 'SOLD');
});

test('keeps active and pending card labels unchanged', () => {
  assert.equal(propertyStatusLabel({ status: 'Active', portfolioSide: 'buyer' }), 'FOR SALE');
  assert.equal(propertyStatusLabel({ status: 'Pending', portfolioSide: 'seller' }), 'PENDING');
});
