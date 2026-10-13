import assert from 'node:assert/strict';
import test from 'node:test';
import { propertyStatusLabel } from '../lib/property-labels.mjs';
import { propertyPrimaryImagePath } from '../lib/property-images.mjs';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../lib/property-assets.js';

test('uses portfolio-specific labels for sold property cards', () => {
  assert.equal(propertyStatusLabel({ status: 'Sold', portfolioSide: 'buyer' }), 'BOUGHT');
  assert.equal(propertyStatusLabel({ status: 'Sold', portfolioSide: 'seller' }), 'SOLD');
  assert.equal(propertyStatusLabel({ status: 'Sold' }), 'SOLD');
});

test('keeps active and pending card labels unchanged', () => {
  assert.equal(propertyStatusLabel({ status: 'Active', portfolioSide: 'buyer' }), 'FOR SALE');
  assert.equal(propertyStatusLabel({ status: 'Pending', portfolioSide: 'seller' }), 'PENDING');
});

test('listing cards and property detail pages use the first stored image', () => {
  assert.equal(
    propertyPrimaryImagePath({
      images: ['/uploads/card-cover.jpg', '/uploads/second-photo.jpg'],
      photoManifest: { managedImagePaths: ['/uploads/synced-photo.jpg'] },
    }),
    '/uploads/card-cover.jpg',
  );
});

test('the primary image ignores photo-manifest-only paths and falls back to the placeholder', () => {
  assert.equal(
    propertyPrimaryImagePath({ photoManifest: { managedImagePaths: ['/uploads/synced-photo.jpg'] } }),
    PROPERTY_PLACEHOLDER_IMAGE,
  );
  assert.equal(propertyPrimaryImagePath({ images: [] }), PROPERTY_PLACEHOLDER_IMAGE);
  assert.equal(propertyPrimaryImagePath({ images: [PROPERTY_PLACEHOLDER_IMAGE] }), PROPERTY_PLACEHOLDER_IMAGE);
});
