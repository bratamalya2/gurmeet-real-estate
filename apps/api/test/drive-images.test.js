import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  DriveImageImportError,
  buildDriveImageUpdatePlan,
  buildLocalUploadImagePlan,
  extractDriveFolderId,
  extractDriveFileId,
  extractLocalDriveFileId,
  findDrivePropertyMatch,
  findDrivePropertyMatches,
  normalizeDriveFilename,
  isSupportedLocalImage,
  unreferencedManagedImagePaths,
  stageDriveFolderImages,
} from '../src/services/drive-images.js';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../src/constants/property-assets.js';

test('extracts standard Google Drive folder IDs and rejects other URLs', () => {
  assert.equal(extractDriveFolderId('https://drive.google.com/drive/folders/folder_123-abc'), 'folder_123-abc');
  assert.equal(extractDriveFolderId('https://drive.google.com/open?id=folder_123-abc'), 'folder_123-abc');
  assert.throws(() => extractDriveFolderId('https://example.com/folder/folder-id'), DriveImageImportError);
  assert.throws(() => extractDriveFolderId('https://drive.google.com/drive/folders/'), DriveImageImportError);
});

test('matches image filenames by slug, then address, and reports ambiguity', () => {
  const slugProperty = { _id: 'slug-id', slug: '123-main-st-fremont-ca-94536', address: { normalized: 'other' } };
  const addressProperty = { _id: 'address-id', slug: 'other', address: { normalized: '456mainstfremontca94536' } };
  assert.equal(findDrivePropertyMatch({ name: '123-main-st-fremont-ca-94536.jpg' }, [slugProperty, addressProperty]).property, slugProperty);
  assert.equal(findDrivePropertyMatch({ name: '456-main-st-fremont-ca-94536.png' }, [slugProperty, addressProperty]).property, addressProperty);
  const duplicateA = { _id: 'a', slug: 'a', address: { normalized: 'sameaddress' } };
  const duplicateB = { _id: 'b', slug: 'b', address: { normalized: 'sameaddress' } };
  assert.equal(findDrivePropertyMatch({ name: 'same-address.jpg' }, [duplicateA, duplicateB]).reason, 'ambiguous_address');
  assert.equal(normalizeDriveFilename('123 Main St, Fremont CA 94536.JPG'), '123mainstfremontca94536');
});

test('matches downloaded files to Drive URLs already stored on properties', () => {
  assert.equal(extractDriveFileId('https://drive.google.com/uc?export=view&id=stored-file-123'), 'stored-file-123');
  assert.equal(extractDriveFileId('https://drive.google.com/file/d/stored-file-456/view'), 'stored-file-456');
  const property = {
    _id: 'stored-id',
    slug: 'unrelated-slug',
    address: { normalized: 'unrelatedaddress' },
    images: ['https://drive.google.com/uc?export=view&id=stored-file-123'],
  };
  assert.equal(findDrivePropertyMatch({ id: 'stored-file-123', name: 'arbitrary-photo-name.jpg' }, [property]).property, property);
});

test('attaches a shared stored Drive file to every explicitly mapped property', () => {
  const properties = [
    { _id: 'with-zip', slug: 'first-property', address: { normalized: 'firstpropertyca94536' }, images: ['https://drive.google.com/uc?export=view&id=shared-file'] },
    { _id: 'without-zip', slug: 'second-property', address: { normalized: 'secondpropertyca' }, photoManifest: { imageUrls: ['https://drive.google.com/uc?export=view&id=shared-file'] }, images: [] },
  ];
  const match = findDrivePropertyMatches({ id: 'shared-file', name: 'unrelated.jpg' }, properties);
  assert.deepEqual(match.properties.map(property => property._id), ['with-zip', 'without-zip']);
  assert.equal(match.reason, 'stored_drive_id');
  const plan = buildDriveImageUpdatePlan([{ id: 'shared-file', name: 'unrelated.jpg', localPath: '/uploads/shared.jpg' }], properties, { folderUrl: 'https://drive.google.com/drive/folders/folder' });
  assert.equal(plan.matched, 2);
  assert.deepEqual(plan.operations.map(operation => operation.images), [['/uploads/shared.jpg'], ['/uploads/shared.jpg']]);
});

test('keeps managed files referenced by another property during cleanup planning', () => {
  assert.deepEqual(
    unreferencedManagedImagePaths(['/uploads/shared.jpg', '/uploads/old.jpg'], [{ images: ['/uploads/shared.jpg'] }]),
    ['/uploads/old.jpg'],
  );
});

test('connects local upload files by slug or address and preserves existing images', () => {
  assert.equal(isSupportedLocalImage('property.JPG'), true);
  assert.equal(isSupportedLocalImage('notes.pdf'), false);
  const properties = [
    { _id: 'property-id', slug: '123-main-st-fremont-ca-94536', address: { normalized: '123mainstfremontca94536' }, images: [PROPERTY_PLACEHOLDER_IMAGE, '/uploads/manual.jpg'] },
    { _id: 'other-id', slug: 'other-property', address: { normalized: 'sameaddress' }, images: [] },
    { _id: 'duplicate-id', slug: 'duplicate-property', address: { normalized: 'sameaddress' }, images: [] },
  ];
  const plan = buildLocalUploadImagePlan([
    { name: '123-main-st-fremont-ca-94536.jpg', localPath: '/uploads/123-main-st-fremont-ca-94536.jpg' },
    { name: 'same-address.png', localPath: '/uploads/same-address.png' },
    { name: 'unmatched.gif', localPath: '/uploads/unmatched.gif' },
  ], properties);
  assert.equal(plan.matchedFiles, 1);
  assert.equal(plan.matchedProperties, 1);
  assert.equal(plan.updated, 1);
  assert.equal(plan.ignored, 2);
  assert.deepEqual(plan.operations[0].images, ['/uploads/manual.jpg', '/uploads/123-main-st-fremont-ca-94536.jpg']);
  assert.equal(plan.operations[0].manualOverrides.images, true);
});

test('connects the actual downloaded Drive filename format through its embedded file ID', () => {
  const driveId = '1nb6xESBTDmwFUMzKJYr1hIGvpMyQ4wPO';
  const filename = 'drive-95d3ed13-6efc-4791-aa0f-39b487738244-1nb6xESBTDmwFUMzKJYr1hIGvpMyQ4wPO.webp';
  assert.equal(extractLocalDriveFileId(filename), driveId);
  const property = {
    _id: 'property-id',
    slug: 'unrelated-slug',
    address: { normalized: 'unrelatedaddress' },
    images: [PROPERTY_PLACEHOLDER_IMAGE],
    photoManifest: { imageUrls: [`https://drive.google.com/uc?export=view&id=${driveId}`] },
  };
  const plan = buildLocalUploadImagePlan([{ id: driveId, name: filename, localPath: `/uploads/${filename}` }], [property]);
  assert.equal(plan.matchedFiles, 1);
  assert.equal(plan.matchedProperties, 1);
  assert.deepEqual(plan.operations[0].images, [`/uploads/${filename}`]);
});

test('preserves manual images and replaces workbook and previous managed images', () => {
  const property = {
    _id: 'property-id',
    slug: 'property-slug',
    address: { normalized: 'propertyaddress' },
    images: ['/uploads/manual.jpg', '/uploads/old-drive.jpg', 'https://drive.google.com/old-workbook-image'],
    photoManifest: {
      imageUrl: 'https://drive.google.com/old-workbook-image',
      managedImagePaths: ['/uploads/old-drive.jpg'],
    },
  };
  const plan = buildDriveImageUpdatePlan([
    { id: 'file-a', name: 'property-slug.jpg', localPath: '/uploads/new-a.jpg' },
    { id: 'file-b', name: 'property-slug.jpg', localPath: '/uploads/new-b.jpg' },
  ], [property], { folderUrl: 'https://drive.google.com/drive/folders/folder' });
  assert.equal(plan.updated, 1);
  assert.deepEqual(plan.operations[0].images, ['/uploads/manual.jpg', '/uploads/new-a.jpg', '/uploads/new-b.jpg']);
  assert.deepEqual(plan.operations[0].photoManifest.managedImagePaths, ['/uploads/new-a.jpg', '/uploads/new-b.jpg']);
  assert.deepEqual(plan.obsoletePaths, ['/uploads/old-drive.jpg']);
});

test('replaces an imported placeholder while preserving manual images', () => {
  const property = {
    _id: 'property-id',
    slug: 'property-slug',
    address: { normalized: 'propertyaddress' },
    images: [PROPERTY_PLACEHOLDER_IMAGE, '/uploads/manual.jpg'],
    photoManifest: {},
  };
  const plan = buildDriveImageUpdatePlan([
    { id: 'file-a', name: 'property-slug.jpg', localPath: '/uploads/new-a.jpg' },
  ], [property], { folderUrl: 'https://drive.google.com/drive/folders/folder' });
  assert.deepEqual(plan.operations[0].images, ['/uploads/manual.jpg', '/uploads/new-a.jpg']);
});

test('recursively stages supported public Drive images and cleans failed downloads', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hbg-drive-test-'));
  const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, arrayBuffer: async () => Buffer.from('image') });
  const fetchImpl = async url => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/files') && !parsed.searchParams.has('alt')) {
      const query = parsed.searchParams.get('q') || '';
      if (query.includes("'root'")) return response({ files: [{ id: 'nested', name: 'Nested', mimeType: 'application/vnd.google-apps.folder' }, { id: 'one', name: 'one.jpg', mimeType: 'image/jpeg' }, { id: 'text', name: 'notes.txt', mimeType: 'text/plain' }] });
      return response({ files: [{ id: 'two', name: 'two.png', mimeType: 'image/png' }] });
    }
    return response({});
  };
  const staged = await stageDriveFolderImages('https://drive.google.com/drive/folders/root', { apiKey: 'test-key', stagingRoot: root, fetchImpl });
  assert.equal(staged.filesFound, 3);
  assert.equal(staged.files.length, 2);
  assert.equal(staged.ignored, 1);
  await fs.rm(root, { recursive: true, force: true });

  const failingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hbg-drive-fail-'));
  await assert.rejects(() => stageDriveFolderImages('https://drive.google.com/drive/folders/root', {
    apiKey: 'test-key',
    stagingRoot: failingRoot,
    fetchImpl: async url => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/files') && !parsed.searchParams.has('alt')) return response({ files: [{ id: 'one', name: 'one.jpg', mimeType: 'image/jpeg' }] });
      return response({ error: { message: 'download failed' } }, 403);
    },
  }), DriveImageImportError);
  assert.deepEqual(await fs.readdir(failingRoot), []);
  await fs.rm(failingRoot, { recursive: true, force: true });
});

test('requires a configured Google Drive API key', async () => {
  await assert.rejects(() => stageDriveFolderImages('https://drive.google.com/drive/folders/root', { stagingRoot: os.tmpdir() }), DriveImageImportError);
});
