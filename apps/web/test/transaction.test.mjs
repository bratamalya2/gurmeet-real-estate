import assert from 'node:assert/strict';
import test from 'node:test';
import { relativeTransactionLabel } from '../lib/transaction.mjs';

const now = new Date('2026-10-08T12:00:00Z');

test('formats buyer, seller, and estimated transaction timing', () => {
  assert.equal(relativeTransactionLabel({ soldDate: '2025-08-08', side: 'Buyer' }, now), 'Purchased 1 year 2 months ago');
  assert.equal(relativeTransactionLabel({ soldDate: '2026-04-08', side: 'Seller / listing' }, now), 'Sold 6 months ago');
  assert.equal(relativeTransactionLabel({ soldDate: '2025-10-08', side: 'Buyer & Seller', verification: 'Sold date estimated from Zillow.' }, now), 'Approx. Transaction completed 1 year ago');
});

test('hides missing, invalid, and future transaction dates', () => {
  assert.equal(relativeTransactionLabel({}, now), '');
  assert.equal(relativeTransactionLabel({ soldDate: 'invalid' }, now), '');
  assert.equal(relativeTransactionLabel({ soldDate: '2026-11-01' }, now), '');
});
