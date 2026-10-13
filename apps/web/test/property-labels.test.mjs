import assert from 'node:assert/strict';
import test from 'node:test';
import { propertyStatusLabel } from '../lib/property-labels.mjs';
import { propertyPhotoPaths } from '../lib/property-images.mjs';
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

test('property detail photos include synced local paths and remove duplicate placeholders', () => {
  assert.deepEqual(
    propertyPhotoPaths({
      images: [PROPERTY_PLACEHOLDER_IMAGE, '/uploads/drive-photo.jpg'],
      photoManifest: {
        managedImagePaths: ['/uploads/drive-photo.jpg', '/uploads/drive-photo-2.jpg'],
        localUploadPaths: ['/uploads/manual-photo.jpg'],
      },
    }),
    ['/uploads/drive-photo.jpg', '/uploads/drive-photo-2.jpg', '/uploads/manual-photo.jpg'],
  );
});

test('property detail uses the placeholder when no usable photo exists', () => {
  assert.deepEqual(propertyPhotoPaths({ images: [PROPERTY_PLACEHOLDER_IMAGE] }), [PROPERTY_PLACEHOLDER_IMAGE]);
});
