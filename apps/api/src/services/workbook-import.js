import crypto from 'crypto';
import slugify from 'slugify';
import XLSX from 'xlsx';
import { Property } from '../models/index.js';

const SOURCE_NAMES = new Set(['redfin', 'zillow', 'photos']);
const REDFIN_TABLE_HEADERS = ['Role', 'Address', 'City', 'State', 'ZIP'];
const LEGACY_REDFIN_HEADERS = ['ID', 'Status', 'Address', 'City', 'State', 'ZIP', 'Price'];
const ZILLOW_ALL_PROPERTIES_HEADERS = ['Status', 'Full property address', 'Price', 'Date', 'Beds', 'Baths', 'Sq Ft', 'Gurmeet’s side', 'Confidence'];
const PHOTO_MANIFEST_HEADERS = ['Property name', 'Address', 'Google Drive image link', 'Status', 'Page(s)', 'Property page', 'Photo source', 'Verification notes'];

export class WorkbookImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkbookImportError';
    this.statusCode = 422;
  }
}

export function validateExpectedWorkbookSource(source, expectedSource) {
  const expected = text(expectedSource).toLowerCase();
  if (!expected) return;
  if (!SOURCE_NAMES.has(expected)) throw new WorkbookImportError('Choose either the Redfin or Zillow import control.');
  if (source !== expected) {
    const label = source === 'redfin' ? 'Redfin' : 'Zillow';
    throw new WorkbookImportError(`This file is a ${label} workbook. Use the ${label} import control instead.`);
  }
}

const text = value => value == null ? '' : String(value).trim();
const numeric = value => {
  if (value === '' || value == null) return undefined;
  const parsed = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};
const dateValue = value => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
};

export function normalizeAddress({ street = '', city = '', state = '', zip = '' } = {}) {
  return [street, city, state, zip].join('').toLowerCase().replace(/\W/g, '');
}

function streetCityKey({ street = '', city = '' } = {}) {
  return [street, city].join('').toLowerCase().replace(/\W/g, '');
}

function findHeaderRow(rows, requiredHeaders) {
  return rows.findIndex(row => requiredHeaders.every(header => row.some(value => text(value) === header)));
}

function headerIndex(row) {
  return Object.fromEntries(row.map((value, index) => [text(value), index]).filter(([key]) => key));
}

function addressFrom(row, indices) {
  return {
    street: text(row[indices.Address]),
    city: text(row[indices.City]),
    state: text(row[indices.State]),
    zip: text(row[indices.ZIP]),
  };
}

function makeRecord({ source, address, price, status, beds, baths, sqft, soldDate, side, verification, confidence, notes, imageSearchUrl, url, externalId }) {
  const normalized = normalizeAddress(address);
  const key = streetCityKey(address) || normalized;
  if (!address.street || !address.city || !key) return null;

  const description = [
    side && `Transaction side: ${side}.`,
    verification,
    notes,
  ].filter(Boolean).join(' ');

  return {
    key,
    title: [address.street, address.city].filter(Boolean).join(', '),
    address: { ...address, normalized },
    price,
    beds,
    baths,
    sqft,
    status,
    description,
    images: [],
    featured: false,
    source: {
      name: source,
      externalId: externalId || `${source}-${normalized || key}`,
      url,
      lastSyncedAt: new Date(),
    },
    transaction: {
      soldDate,
      side,
      verification,
      confidence,
      notes,
      imageSearchUrl,
    },
  };
}

function rowsAfterHeader(rows, index) {
  if (index < 0) return [];
  return rows.slice(index + 1);
}

function parseStructuredRedfinSheet(rows, options = {}) {
  const headerRowIndex = findHeaderRow(rows, REDFIN_TABLE_HEADERS);
  if (headerRowIndex < 0) return [];
  const indices = headerIndex(rows[headerRowIndex]);
  const records = [];
  for (const row of rowsAfterHeader(rows, headerRowIndex)) {
    if (!row.some(value => text(value))) break;
    const address = addressFrom(row, indices);
    if (!address.street) continue;
    records.push(makeRecord({
      source: 'redfin',
      address,
      price: numeric(row[indices['Sold price (USD)']]),
      status: options.status || 'Sold',
      beds: numeric(row[indices.Beds]),
      baths: numeric(row[indices.Baths]),
      sqft: numeric(row[indices['Sq ft']]),
      soldDate: dateValue(row[indices['Sold date']]),
      side: text(row[indices.Role]),
      verification: text(row[indices['Verification note']]),
      url: text(row[indices['Source URL']]),
    }));
  }
  return records.filter(Boolean);
}

function parseActiveRedfinSummary(rows) {
  const records = [];
  for (const row of rows) {
    const value = text(row[0]);
    const match = value.match(/Active listings:\s*(.+)$/i);
    if (!match) continue;
    const summary = match[1].replace(/\.\s*Source:.*$/i, '');
    for (const item of summary.split(';')) {
      const listing = item.trim().match(/^(.+?),\s*([^()]+?)\s*\(\$([\d,]+)\)$/);
      if (!listing) continue;
      records.push(makeRecord({
        source: 'redfin',
        address: { street: listing[1].trim(), city: listing[2].trim(), state: 'CA', zip: '' },
        price: numeric(listing[3]),
        status: 'Active',
        verification: 'Active listing from Redfin profile summary',
        url: 'https://www.redfin.com/real-estate-agents/gurmeet-singh',
      }));
    }
  }
  return records.filter(Boolean);
}

function parseLegacyRedfin(rows) {
  const headerRowIndex = findHeaderRow(rows, LEGACY_REDFIN_HEADERS);
  if (headerRowIndex < 0) return [];
  const indices = headerIndex(rows[headerRowIndex]);
  const records = [];
  for (const row of rowsAfterHeader(rows, headerRowIndex)) {
    if (!row.some(value => text(value))) continue;
    const address = addressFrom(row, indices);
    if (!address.street) continue;
    const statusValue = text(row[indices.Status]).toLowerCase();
    records.push(makeRecord({
      source: 'redfin',
      address,
      price: numeric(row[indices.Price]),
      status: statusValue.startsWith('active') ? 'Active' : statusValue.startsWith('pending') ? 'Pending' : 'Sold',
      beds: numeric(row[indices.Beds]),
      baths: numeric(row[indices.Baths]),
      sqft: numeric(row[indices['Sq Ft']]),
      soldDate: dateValue(row[indices['Sold Date']]),
      side: text(row[indices.Side]),
      verification: text(row[indices.Verification]),
      notes: text(row[indices.Notes]),
      url: text(row[indices['Primary Source URL']]),
      externalId: `redfin-workbook-${text(row[indices.ID])}`,
    }));
  }
  return records.filter(Boolean);
}

function parseRedfin(workbook) {
  const records = [];
  if (workbook.SheetNames.includes('Transactions')) {
    records.push(...parseLegacyRedfin(XLSX.utils.sheet_to_json(workbook.Sheets.Transactions, { header: 1, defval: '', raw: true })));
  } else {
    for (const sheetName of ['Current Redfin', 'Earlier workbook rows']) {
      if (!workbook.SheetNames.includes(sheetName)) continue;
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
      records.push(...parseStructuredRedfinSheet(rows));
      if (sheetName === 'Current Redfin') records.push(...parseActiveRedfinSummary(rows));
    }
  }
  if (!records.length) throw new WorkbookImportError('The Redfin workbook contains no recognizable listing rows.');
  return records;
}

function parseBathsAndSqft(value) {
  const [baths, sqft] = text(value).split('/').map(item => item.trim());
  return { baths: numeric(baths), sqft: numeric(sqft) };
}

function fullAddress(value) {
  const match = text(value).match(/^(.+?),\s*(.+?),\s*([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/i);
  if (!match) return null;
  return { street: match[1].trim(), city: match[2].trim(), state: match[3].toUpperCase(), zip: match[4] || '' };
}

function propertySlugFromUrl(value) {
  try {
    const pathname = new URL(text(value)).pathname.replace(/\/+$/, '');
    return decodeURIComponent(pathname.split('/').pop() || '');
  } catch {
    return '';
  }
}

function sourceFromPropertySlug(slug) {
  const match = text(slug).match(/-(redfin|zillow)-/i);
  return match?.[1]?.toLowerCase();
}

export function driveImageUrl(value) {
  const original = text(value);
  const match = original.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([a-zA-Z0-9_-]+)/i);
  return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : original;
}

function parsePhotoManifest(workbook) {
  const sheetName = 'Portfolio — all listings';
  if (!workbook.SheetNames.includes(sheetName)) throw new WorkbookImportError('The photo manifest must include a Portfolio — all listings sheet.');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
  const headerRowIndex = findHeaderRow(rows, PHOTO_MANIFEST_HEADERS);
  if (headerRowIndex < 0) throw new WorkbookImportError('The photo manifest is missing required columns.');
  const indices = headerIndex(rows[headerRowIndex]);
  const records = [];
  for (const row of rowsAfterHeader(rows, headerRowIndex)) {
    if (!row.some(value => text(value))) continue;
    const address = fullAddress(row[indices.Address]);
    const propertyPage = text(row[indices['Property page']]);
    const propertySlug = propertySlugFromUrl(propertyPage);
    if (!address || !propertySlug) continue;
    records.push({
      source: { name: 'photos', externalId: propertySlug },
      key: streetCityKey(address) || normalizeAddress(address),
      title: text(row[indices['Property name']]),
      address: { ...address, normalized: normalizeAddress(address) },
      propertySlug,
      propertySource: sourceFromPropertySlug(propertySlug),
      imageUrl: driveImageUrl(row[indices['Google Drive image link']]),
      originalImageUrl: text(row[indices['Google Drive image link']]),
      pages: text(row[indices['Page(s)']]),
      propertyPage,
      photoSource: text(row[indices['Photo source']]),
      verificationNotes: text(row[indices['Verification notes']]),
    });
  }
  if (!records.length) throw new WorkbookImportError('The photo manifest contains no valid property rows.');
  return records;
}

function zillowSide(value) {
  const side = text(value);
  if (!side || /^not stated$/i.test(side)) return undefined;
  if (/buyer\s+(?:and|&)\s+seller/i.test(side)) return 'Buyer & Seller';
  if (/^buyer$/i.test(side)) return 'Buyer';
  if (/^seller$/i.test(side)) return 'Seller';
  return side;
}

function zillowViewedOn(workbook) {
  const sheet = workbook.Sheets['Read Me'];
  if (!sheet) return undefined;
  const row = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }).find(item => text(item[0]) === 'Viewed on');
  return dateValue(row?.[1]);
}

function estimatedZillowSoldDate(value, viewedOn) {
  if (!viewedOn) return undefined;
  const match = text(value).match(/^(\d+)\s+(month|year)s?\s+ago$/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const estimated = new Date(Date.UTC(viewedOn.getUTCFullYear(), viewedOn.getUTCMonth(), viewedOn.getUTCDate()));
  if (match[2].toLowerCase() === 'month') estimated.setUTCMonth(estimated.getUTCMonth() - amount);
  else estimated.setUTCFullYear(estimated.getUTCFullYear() - amount);
  return estimated;
}

function parseAllPropertiesZillow(workbook) {
  const sheet = workbook.Sheets['All Properties'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  const headerRowIndex = findHeaderRow(rows, ZILLOW_ALL_PROPERTIES_HEADERS);
  if (headerRowIndex < 0) throw new WorkbookImportError('The Zillow All Properties workbook is missing required columns.');
  const indices = headerIndex(rows[headerRowIndex]);
  const viewedOn = zillowViewedOn(workbook);
  const records = [];
  for (const [rowIndex, row] of rowsAfterHeader(rows, headerRowIndex).entries()) {
    if (!row.some(value => text(value))) continue;
    const statusValue = text(row[indices.Status]).toLowerCase();
    if (statusValue === 'for rent') continue;
    if (statusValue !== 'sold' && statusValue !== 'for sale') continue;
    const addressText = text(row[indices['Full property address']]);
    if (/property details could not be loaded|^\(undisclosed address\)/i.test(addressText)) continue;
    const address = fullAddress(addressText);
    if (!address) continue;
    const isSold = statusValue === 'sold';
    const estimatedSoldDate = isSold ? estimatedZillowSoldDate(row[indices.Date], viewedOn) : undefined;
    records.push(makeRecord({
      source: 'zillow',
      address,
      price: numeric(row[indices.Price]),
      status: isSold ? 'Sold' : 'Active',
      beds: numeric(row[indices.Beds]),
      baths: numeric(row[indices.Baths]),
      sqft: numeric(row[indices['Sq Ft']]),
      soldDate: estimatedSoldDate,
      side: zillowSide(row[indices['Gurmeet’s side']]),
      verification: isSold && estimatedSoldDate ? `Sold date estimated from Zillow’s ${text(row[indices.Date])} label.` : 'Zillow profile workbook',
      confidence: text(row[indices.Confidence]),
      imageSearchUrl: text(row[indices['House image search link']]),
      url: text(row[indices['Primary source link']]) || 'https://www.zillow.com/profile/Gurmeet%20Singh',
      externalId: `zillow-all-properties-${rowIndex + headerRowIndex + 2}`,
    }));
  }
  if (!records.length) throw new WorkbookImportError('The Zillow All Properties workbook contains no valid listing rows.');
  return records.filter(Boolean);
}

function parseZillow(workbook) {
  if (workbook.SheetNames.includes('All Properties')) return parseAllPropertiesZillow(workbook);
  const sheet = workbook.Sheets['Profile and activity'];
  if (!sheet) throw new WorkbookImportError('The Zillow workbook must include a Profile and activity sheet.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  const records = [];

  const soldHeaderIndex = rows.findIndex(row => text(row[0]) === 'Address' && text(row[1]) === 'City');
  if (soldHeaderIndex >= 0) {
    const indices = headerIndex(rows[soldHeaderIndex]);
    for (const row of rowsAfterHeader(rows, soldHeaderIndex)) {
      if (!row.some(value => text(value)) || text(row[0]) === 'Active listing') break;
      const address = addressFrom(row, indices);
      const parsed = parseBathsAndSqft(row[indices['Baths / Sq ft']]);
      records.push(makeRecord({
        source: 'zillow',
        address,
        price: numeric(row[indices['Sold price (USD)']]),
        status: 'Sold',
        beds: numeric(row[indices.Beds]),
        baths: numeric(row[indices['Baths / Sq ft']]) ?? parsed.baths,
        sqft: parsed.sqft,
        side: text(row[indices['Role / relative timing']]),
        url: 'https://www.zillow.com/profile/Gurmeet%20Singh',
      }));
    }
  }

  const activeHeaderIndex = rows.findIndex(row => text(row[0]) === 'Active listing' && text(row[1]) === 'City');
  if (activeHeaderIndex >= 0) {
    const indices = headerIndex(rows[activeHeaderIndex]);
    for (const row of rowsAfterHeader(rows, activeHeaderIndex)) {
      if (!row.some(value => text(value))) break;
      const address = addressFrom(row, { ...indices, Address: 0 });
      const parsed = parseBathsAndSqft(row[indices['Baths / Sq ft']]);
      records.push(makeRecord({
        source: 'zillow',
        address,
        price: numeric(row[indices['Ask (USD)']]),
        status: text(row[indices.Status]).toLowerCase().includes('pending') ? 'Pending' : 'Active',
        beds: numeric(row[indices.Beds]),
        baths: parsed.baths,
        sqft: parsed.sqft,
        url: 'https://www.zillow.com/profile/Gurmeet%20Singh',
      }));
    }
  }

  if (!records.length) throw new WorkbookImportError('The Zillow workbook contains no recognizable listing rows.');
  return records.filter(Boolean);
}

export function detectWorkbookSource(workbook) {
  if (workbook.SheetNames.includes('Portfolio — all listings')) return 'photos';
  if (workbook.SheetNames.includes('Profile and activity') || workbook.SheetNames.includes('All Properties')) return 'zillow';
  if (workbook.SheetNames.includes('Current Redfin') || workbook.SheetNames.includes('Earlier workbook rows') || workbook.SheetNames.includes('Transactions')) return 'redfin';
  throw new WorkbookImportError('Unsupported workbook. Upload a Redfin, Zillow, or supported photo-manifest workbook with the expected sheets.');
}

export function parseWorkbook(buffer, filename = 'uploaded.xlsx') {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new WorkbookImportError('The uploaded workbook is empty.');
  let workbook;
  try {
    workbook = XLSX.read(buffer, { cellDates: true });
  } catch {
    throw new WorkbookImportError('The uploaded file is not a readable .xlsx workbook.');
  }
  const source = detectWorkbookSource(workbook);
  const rows = source === 'redfin' ? parseRedfin(workbook) : source === 'zillow' ? parseZillow(workbook) : parsePhotoManifest(workbook);
  if (!rows.length) throw new WorkbookImportError('The workbook contains no valid listing addresses.');
  const occurrences = new Map();
  const identifiedRows = rows.map(row => {
    const baseId = row.source.externalId || `${source}-${row.address.normalized}`;
    const occurrence = (occurrences.get(baseId) || 0) + 1;
    occurrences.set(baseId, occurrence);
    return {
      ...row,
      source: { ...row.source, externalId: occurrence === 1 ? baseId : `${baseId}--${occurrence}` },
    };
  });
  return {
    source,
    filename,
    checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
    rows: identifiedRows,
  };
}

export function buildWorkbookListings(redfinRows = [], zillowRows = [], photoRows = []) {
  const photoBySlug = new Map(photoRows.filter(row => row.propertySlug).map(row => [row.propertySlug, row]));
  const photoBySourceAndAddress = new Map();
  for (const row of photoRows) {
    if (!row.propertySource || !row.address) continue;
    const key = `${row.propertySource}:${streetCityKey(row.address)}`;
    photoBySourceAndAddress.set(key, [...(photoBySourceAndAddress.get(key) || []), row]);
  }
  const usedSlugs = new Set();
  return [...redfinRows, ...zillowRows].map((row, index) => {
    const sourceName = row.source.name;
    const baseSlug = slugify(`${row.address.street}-${row.address.city}-${row.address.state}-${row.address.zip}-${sourceName}-${row.source.externalId}`, { lower: true, strict: true }) || `property-${index + 1}`;
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    usedSlugs.add(slug);
    const sourceAddressMatches = photoBySourceAndAddress.get(`${sourceName}:${streetCityKey(row.address)}`) || [];
    const photo = photoBySlug.get(baseSlug) || (sourceAddressMatches.length === 1 ? sourceAddressMatches[0] : null);
    const photoManifest = photo ? {
      imageUrl: photo.imageUrl,
      originalImageUrl: photo.originalImageUrl,
      propertyPage: photo.propertyPage,
      photoSource: photo.photoSource,
      verificationNotes: photo.verificationNotes,
      pages: photo.pages,
      importedAt: new Date(),
    } : undefined;
    return {
      ...row,
      slug,
      source: {
        name: sourceName,
        externalId: row.source.externalId,
        url: row.source.url,
        lastSyncedAt: new Date(),
        providers: [sourceName],
      },
      images: photoManifest?.imageUrl ? [photoManifest.imageUrl] : [],
      photoManifest,
      featured: false,
      manualOverrides: { price: false, description: false, images: false },
      createdBy: undefined,
    };
  });
}

// Retained for callers upgrading from the former merged-workbook API.
export const mergeWorkbookRows = buildWorkbookListings;

export function snapshotForDocument(parsed) {
  return {
    source: parsed.source,
    filename: parsed.filename,
    checksum: parsed.checksum,
    rowCount: parsed.rows.length,
    rows: parsed.rows,
    uploadedAt: new Date(),
  };
}

export function sourceIsValid(source) {
  return SOURCE_NAMES.has(source);
}

function photoManifestDocument(row) {
  return {
    imageUrl: row.imageUrl,
    originalImageUrl: row.originalImageUrl,
    propertyPage: row.propertyPage,
    photoSource: row.photoSource,
    verificationNotes: row.verificationNotes,
    pages: row.pages,
    importedAt: new Date(),
  };
}

export function findPhotoManifestMatch(property, photoRows = []) {
  const exact = photoRows.find(row => row.propertySlug && row.propertySlug === property?.slug);
  if (exact) return exact;
  const normalized = property?.address?.normalized;
  const addressKey = streetCityKey(property?.address || {});
  if (!normalized && !addressKey) return null;
  const source = property?.source?.name;
  const matchesAddress = row => (normalized && row.address?.normalized === normalized) || (addressKey && streetCityKey(row.address || {}) === addressKey);
  const sourceMatches = photoRows.filter(row => matchesAddress(row) && row.propertySource && row.propertySource === source);
  if (sourceMatches.length === 1) return sourceMatches[0];
  const addressMatches = photoRows.filter(matchesAddress);
  return addressMatches.length === 1 ? addressMatches[0] : null;
}

export async function applyPhotoManifestToProperties(photoRows = [], { session } = {}) {
  const existing = await Property.find().session(session || null).lean();
  const matchedIds = new Set();
  const operations = [];
  let matched = 0;
  for (const row of photoRows) {
    const available = existing.filter(item => !matchedIds.has(String(item._id)));
    let property = available.find(item => row.propertySlug && item.slug === row.propertySlug);
    if (!property && row.propertySource) {
      const sourceMatches = available.filter(item => item.source?.name === row.propertySource && ((item.address?.normalized && item.address.normalized === row.address?.normalized) || streetCityKey(item.address || {}) === streetCityKey(row.address || {})));
      if (sourceMatches.length === 1) property = sourceMatches[0];
    }
    if (!property) {
      const addressMatches = available.filter(item => ((item.address?.normalized && item.address.normalized === row.address?.normalized) || streetCityKey(item.address || {}) === streetCityKey(row.address || {})));
      if (addressMatches.length === 1) property = addressMatches[0];
    }
    if (!property) continue;
    matchedIds.add(String(property._id));
    matched++;
    operations.push({ updateOne: { filter: { _id: property._id }, update: { $set: { images: row.imageUrl ? [row.imageUrl] : [], photoManifest: photoManifestDocument(row) } } } });
  }
  if (operations.length) await Property.bulkWrite(operations, { ordered: true, session });
  return { matched, updated: operations.length, ignored: photoRows.length - matched };
}

function cleanValue(value) {
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined).map(([key, nested]) => [key, cleanValue(nested)]));
  }
  return value;
}

function listingIdentity(listing) {
  return `${listing.source?.name || 'workbook'}:${listing.source?.externalId || ''}`;
}

export async function rebuildProperties(listings, { session } = {}) {
  const existing = await Property.find().session(session || null).lean();
  const existingByIdentity = new Map();
  const existingByExternalId = new Map();
  for (const property of existing) {
    const identity = listingIdentity(property);
    if (!existingByIdentity.has(identity)) existingByIdentity.set(identity, property);
    const externalId = property.source?.externalId;
    if (externalId && !existingByExternalId.has(externalId)) existingByExternalId.set(externalId, property);
  }

  const matchedIds = new Set();
  const operations = [];
  let updated = 0;
  let created = 0;
  for (const listing of listings) {
    const match = [existingByIdentity.get(listingIdentity(listing)), existingByExternalId.get(listing.source.externalId)]
      .find(property => property && !matchedIds.has(String(property._id)));
    const payload = cleanValue({
      title: listing.title,
      slug: listing.slug,
      address: listing.address,
      price: listing.price,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      description: listing.description,
      status: listing.status,
      featured: false,
      images: listing.images || [],
      photoManifest: listing.photoManifest,
      source: listing.source,
      transaction: listing.transaction,
      manualOverrides: { price: false, description: false, images: false },
    });
    if (match) {
      matchedIds.add(String(match._id));
      updated++;
      const unset = { coordinates: 1, createdBy: 1, scraped: 1 };
      if (!listing.photoManifest) unset.photoManifest = 1;
      operations.push({ updateOne: { filter: { _id: match._id }, update: { $set: payload, $unset: unset } } });
    } else {
      created++;
      operations.push({ insertOne: { document: payload } });
    }
  }

  const removeIds = existing.filter(property => !matchedIds.has(String(property._id))).map(property => property._id);
  if (removeIds.length) await Property.deleteMany({ _id: { $in: removeIds } }, { session });
  if (operations.length) await Property.bulkWrite(operations, { ordered: true, session });
  return { created, updated, removed: removeIds.length, totalListings: listings.length };
}
