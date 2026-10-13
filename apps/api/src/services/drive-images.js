import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Property } from '../models/index.js';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../constants/property-assets.js';

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const LOCAL_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_FILES = 1000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export class DriveImageImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DriveImageImportError';
    this.statusCode = 422;
  }
}

export function extractDriveFolderId(folderUrl) {
  let url;
  try {
    url = new URL(String(folderUrl || '').trim());
  } catch {
    throw new DriveImageImportError('Enter a valid Google Drive folder URL.');
  }
  if (!['drive.google.com', 'www.drive.google.com'].includes(url.hostname.toLowerCase())) {
    throw new DriveImageImportError('The URL must be a Google Drive folder link.');
  }
  const folderMatch = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const folderId = folderMatch?.[1] || url.searchParams.get('id');
  if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    throw new DriveImageImportError('The Google Drive URL does not contain a valid folder ID.');
  }
  return folderId;
}

export function isSupportedDriveImage(file) {
  return IMAGE_MIME_TYPES.has(String(file?.mimeType || '').toLowerCase());
}

function comparable(value) {
  return String(value || '').toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]/g, '');
}

export function normalizeDriveFilename(filename) {
  return comparable(path.basename(String(filename || '')));
}

export function isSupportedLocalImage(filename) {
  return LOCAL_IMAGE_EXTENSIONS.has(path.extname(String(filename || '')).toLowerCase());
}

export function extractLocalDriveFileId(filename) {
  const base = path.basename(String(filename || '')).replace(/\.[a-z0-9]+$/i, '');
  const match = base.match(/^drive-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i);
  return match?.[1] || '';
}

export async function listLocalUploadImages(uploadsDirectory) {
  const entries = await fs.readdir(uploadsDirectory, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && isSupportedLocalImage(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => ({
      name: entry.name,
      id: extractLocalDriveFileId(entry.name),
      localPath: `/uploads/${entry.name}`,
      targetPath: path.join(uploadsDirectory, entry.name),
    }));
}

export function extractDriveFileId(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/open\?[^#]*\bid=([a-zA-Z0-9_-]+)/i,
    /drive\.google\.com\/uc\?[^#]*\bid=([a-zA-Z0-9_-]+)/i,
    /drive\.usercontent\.google\.com\/download\?[^#]*\bid=([a-zA-Z0-9_-]+)/i,
  ];
  return patterns.map(pattern => source.match(pattern)?.[1]).find(Boolean) || '';
}

function storedDriveFileIds(property = {}) {
  return new Set([
    ...(property.photoManifest?.driveFileIds || []),
    ...(property.images || []).map(extractDriveFileId),
    extractDriveFileId(property.photoManifest?.imageUrl),
    extractDriveFileId(property.photoManifest?.originalImageUrl),
    ...(property.photoManifest?.imageUrls || []).map(extractDriveFileId),
    ...(property.photoManifest?.originalImageUrls || []).map(extractDriveFileId),
  ].filter(Boolean));
}

export function findDrivePropertyMatches(file, properties = []) {
  const fileId = String(file?.id || '');
  if (fileId) {
    const storedIdMatches = properties.filter(property => storedDriveFileIds(property).has(fileId));
    if (storedIdMatches.length) return { properties: storedIdMatches, reason: 'stored_drive_id' };
  }
  const normalizedFilename = normalizeDriveFilename(file?.name);
  if (!normalizedFilename) return { properties: [], reason: 'missing_filename' };

  const slugMatches = properties.filter(property => comparable(property.slug) === normalizedFilename);
  if (slugMatches.length === 1) return { properties: slugMatches, reason: 'slug' };
  if (slugMatches.length > 1) return { properties: [], reason: 'ambiguous_slug' };

  const addressMatches = properties.filter(property => comparable(property.address?.normalized) === normalizedFilename);
  if (addressMatches.length === 1) return { properties: addressMatches, reason: 'address' };
  if (addressMatches.length > 1) return { properties: [], reason: 'ambiguous_address' };
  return { properties: [], reason: 'unmatched' };
}

export function findDrivePropertyMatch(file, properties = []) {
  const match = findDrivePropertyMatches(file, properties);
  return { property: match.properties.length === 1 ? match.properties[0] : null, reason: match.reason };
}

function localFilename(file, batchId) {
  const id = String(file.id || '').replace(/[^a-zA-Z0-9_-]/g, '') || crypto.randomUUID();
  const extension = EXTENSIONS[file.mimeType] || path.extname(file.name || '').toLowerCase() || '.img';
  return `drive-${batchId}-${id}${extension}`;
}

async function driveRequest(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message ? `: ${body.error.message}` : '';
    } catch {}
    throw new DriveImageImportError(`Google Drive request failed with status ${response.status}${detail}`);
  }
  return response;
}

async function listDriveFiles(folderId, apiKey, fetchImpl) {
  const files = [];
  const visitedFolders = new Set();
  let ignored = 0;

  async function visit(parentId) {
    if (visitedFolders.has(parentId)) return;
    visitedFolders.add(parentId);
    let pageToken;
    do {
      const params = new URLSearchParams({
        q: `'${parentId}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,size)',
        pageSize: '1000',
        key: apiKey,
      });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await driveRequest(`https://www.googleapis.com/drive/v3/files?${params}`, fetchImpl);
      const body = await response.json();
      for (const file of body.files || []) {
        if (files.length >= MAX_FILES) throw new DriveImageImportError(`The Drive folder contains more than ${MAX_FILES} files.`);
        if (file.mimeType === DRIVE_FOLDER_MIME) await visit(file.id);
        else if (isSupportedDriveImage(file)) files.push(file);
        else ignored++;
      }
      pageToken = body.nextPageToken;
    } while (pageToken);
  }

  await visit(folderId);
  return { files, ignored };
}

export async function stageDriveFolderImages(folderUrl, { apiKey, stagingRoot, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new DriveImageImportError('Google Drive image imports are not configured on the server.');
  const folderId = extractDriveFolderId(folderUrl);
  const batchId = crypto.randomUUID();
  const stagingDirectory = path.join(stagingRoot, `.drive-import-${batchId}`);
  await fs.mkdir(stagingDirectory, { recursive: true });
  try {
    const listed = await listDriveFiles(folderId, apiKey, fetchImpl);
    if (!listed.files.length) throw new DriveImageImportError('The Google Drive folder contains no supported image files.');
    let totalBytes = 0;
    const files = [];
    for (const file of listed.files) {
      const declaredSize = Number(file.size || 0);
      if (declaredSize > MAX_IMAGE_BYTES) throw new DriveImageImportError(`Image ${file.name} exceeds the ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit.`);
      const params = new URLSearchParams({ alt: 'media', key: apiKey });
      const response = await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?${params}`, fetchImpl);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new DriveImageImportError(`Image ${file.name} exceeds the ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit.`);
      totalBytes += bytes.length;
      if (totalBytes > MAX_TOTAL_BYTES) throw new DriveImageImportError(`The Drive image batch exceeds the ${MAX_TOTAL_BYTES / 1024 / 1024} MB limit.`);
      const filename = localFilename(file, batchId);
      await fs.writeFile(path.join(stagingDirectory, filename), bytes, { flag: 'wx' });
      files.push({
        ...file,
        stagingPath: path.join(stagingDirectory, filename),
        localPath: `/uploads/${filename}`,
        originalUrl: `https://drive.google.com/file/d/${file.id}/view`,
      });
    }
    return { folderId, folderUrl, batchId, stagingDirectory, files, filesFound: listed.files.length + listed.ignored, ignored: listed.ignored };
  } catch (error) {
    await fs.rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function commitStagedDriveImages(staged, uploadsDirectory) {
  const committed = [];
  try {
    for (const file of staged.files) {
      const target = path.resolve(uploadsDirectory, path.basename(file.localPath));
      await fs.rename(file.stagingPath, target);
      committed.push({ ...file, targetPath: target });
    }
    return committed;
  } catch (error) {
    await removeCommittedDriveImages(committed);
    throw error;
  }
}

export async function removeCommittedDriveImages(files = []) {
  await Promise.all(files.map(file => fs.unlink(file.targetPath).catch(() => {})));
}

export function unreferencedManagedImagePaths(paths = [], properties = []) {
  const referenced = new Set(properties.flatMap(property => property.images || []));
  return [...new Set(paths.filter(Boolean))].filter(imagePath => !referenced.has(imagePath));
}

export async function removeUnreferencedDriveImages(paths = [], uploadsDirectory) {
  const candidates = [...new Set(paths.filter(Boolean))];
  if (!candidates.length) return;
  const properties = await Property.find({ images: { $in: candidates } }).select('images').lean();
  const removable = unreferencedManagedImagePaths(candidates, properties);
  await removeCommittedDriveImages(removable.map(localPath => ({ targetPath: path.resolve(uploadsDirectory, path.basename(localPath)) })));
}

export function buildDriveImageUpdatePlan(files = [], properties = [], { folderUrl, downloadedAt = new Date() } = {}) {
  const updates = new Map();
  let ignored = 0;
  const ignoredFiles = [];
  for (const file of files) {
    const match = findDrivePropertyMatches(file, properties);
    if (!match.properties.length) {
      ignored++;
      ignoredFiles.push({ name: file.name, reason: match.reason });
      continue;
    }
    for (const property of match.properties) {
      const id = String(property._id);
      const current = updates.get(id) || { property, files: [] };
      current.files.push(file);
      updates.set(id, current);
    }
  }

  const operations = [];
  const obsoletePaths = [];
  for (const { property, files: propertyFiles } of updates.values()) {
    const previousManaged = property.photoManifest?.managedImagePaths || [];
    const workbookImages = new Set([
      property.photoManifest?.imageUrl,
      property.photoManifest?.originalImageUrl,
      ...(property.photoManifest?.imageUrls || []),
      ...(property.photoManifest?.originalImageUrls || []),
    ].filter(Boolean));
    const currentFileIds = new Set(propertyFiles.map(file => String(file.id)));
    const preservedImages = (property.images || []).filter(image => !previousManaged.includes(image) && !workbookImages.has(image) && !currentFileIds.has(extractDriveFileId(image)) && image !== PROPERTY_PLACEHOLDER_IMAGE);
    const localPaths = propertyFiles.map(file => file.localPath);
    obsoletePaths.push(...previousManaged);
    operations.push({
      property,
      fileIds: propertyFiles.map(file => file.id),
      images: [...new Set([...preservedImages, ...localPaths])],
      photoManifest: {
        ...(property.photoManifest || {}),
        managedImagePaths: localPaths,
        driveFileIds: propertyFiles.map(file => file.id),
        driveFolderUrl: folderUrl,
        downloadedAt,
      },
    });
  }
  return { operations, obsoletePaths: [...new Set(obsoletePaths)], matched: operations.length, updated: operations.length, ignored, ignoredFiles };
}

export function buildLocalUploadImagePlan(files = [], properties = []) {
  const updates = new Map();
  let ignored = 0;
  const ignoredFiles = [];
  const matchedFileNames = new Set();
  const matchedPropertyIds = new Set();

  for (const file of files) {
    const match = findDrivePropertyMatches({ id: file.id, name: file.name }, properties);
    if (!match.properties.length) {
      ignored++;
      ignoredFiles.push({ name: file.name, reason: match.reason });
      continue;
    }
    matchedFileNames.add(file.name);
    for (const property of match.properties) {
      const id = String(property._id);
      matchedPropertyIds.add(id);
      const current = updates.get(id) || { property, files: [] };
      current.files.push(file);
      updates.set(id, current);
    }
  }

  const operations = [];
  for (const { property, files: propertyFiles } of updates.values()) {
    const localPaths = propertyFiles.map(file => file.localPath || `/uploads/${path.basename(file.name)}`);
    const existingImages = (property.images || []).filter(image => image !== PROPERTY_PLACEHOLDER_IMAGE);
    const images = [...new Set([...existingImages, ...localPaths])];
    const addedPaths = localPaths.filter(localPath => !existingImages.includes(localPath));
    const hasNewImage = addedPaths.length > 0;
    if (!hasNewImage && existingImages.length === (property.images || []).length) continue;
    const hasDriveManagedFile = propertyFiles.some(file => file.id && property.photoManifest?.driveFileIds?.includes(file.id));
    const localUploadPaths = localPaths.filter((localPath, index) => !propertyFiles[index].id);
    operations.push({
      property,
      images,
      photoManifest: {
        ...(property.photoManifest || {}),
        localUploadPaths: [...new Set([...(property.photoManifest?.localUploadPaths || []), ...localUploadPaths])],
      },
      manualOverrides: {
        ...(property.manualOverrides || {}),
        images: hasDriveManagedFile ? property.manualOverrides?.images : true,
      },
    });
  }

  return {
    operations,
    filesFound: files.length,
    matchedFiles: matchedFileNames.size,
    matchedProperties: matchedPropertyIds.size,
    totalProperties: properties.length,
    propertiesWithoutMatch: Math.max(0, properties.length - matchedPropertyIds.size),
    updated: operations.length,
    ignored,
    ignoredFiles,
  };
}

export async function applyLocalUploadImageUpdates(files, { session } = {}) {
  const existing = await Property.find().session(session || null).lean();
  const plan = buildLocalUploadImagePlan(files, existing);
  if (plan.operations.length) {
    await Property.bulkWrite(plan.operations.map(operation => ({
      updateOne: {
        filter: { _id: operation.property._id },
        update: {
          $set: {
            images: operation.images,
            photoManifest: operation.photoManifest,
            manualOverrides: operation.manualOverrides,
          },
        },
      },
    })), { ordered: true, session });
  }
  return plan;
}

export async function applyDriveImageUpdates(files, { folderUrl, session } = {}) {
  const existing = await Property.find().session(session || null).lean();
  const plan = buildDriveImageUpdatePlan(files, existing, { folderUrl });
  if (plan.operations.length) {
    await Property.bulkWrite(plan.operations.map(operation => ({
      updateOne: {
        filter: { _id: operation.property._id },
        update: { $set: { images: operation.images, photoManifest: operation.photoManifest } },
      },
    })), { ordered: true, session });
  }
  return plan;
}
