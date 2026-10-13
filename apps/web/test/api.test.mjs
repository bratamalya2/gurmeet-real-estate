import assert from 'node:assert/strict';
import test from 'node:test';
import { publicAssetUrl } from '../lib/api.js';

test('uses the public site upload route for local assets on server and browser renders', () => {
  assert.equal(publicAssetUrl('/uploads/listing.jpg'), '/uploads/listing.jpg');
  assert.equal(publicAssetUrl('uploads/listing.jpg'), '/uploads/listing.jpg');
});

test('leaves externally hosted image URLs unchanged', () => {
  assert.equal(
    publicAssetUrl('https://images.example.com/listing.jpg'),
    'https://images.example.com/listing.jpg',
  );
});
