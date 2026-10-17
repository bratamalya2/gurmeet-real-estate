import crypto from 'crypto';
import slugify from 'slugify';
import XLSX from 'xlsx';
import { Property } from '../models/index.js';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../constants/property-assets.js';

export { PROPERTY_PLACEHOLDER_IMAGE };

const SOURCE_NAMES = new Set(['redfin', 'zillow', 'workbook', 'sold-portfolio']);
const REDFIN_TABLE_HEADERS = ['Role', 'Address', 'City', 'State', 'ZIP'];
const LEGACY_REDFIN_HEADERS = ['ID', 'Status', 'Address', 'City', 'State', 'ZIP', 'Price'];
const ZILLOW_ALL_PROPERTIES_HEADERS = ['Status', 'Full property address', 'Price', 'Date', 'Beds', 'Baths', 'Sq Ft', 'Gurmeet’s side', 'Confidence'];
const PHOTO_MANIFEST_HEADERS = ['Property name', 'Address', 'Google Drive image link', 'Status', 'Page(s)', 'Property page', 'Photo source', 'Verification notes'];
const SOLD_PORTFOLIO_HEADERS = ['Transaction Type', 'Sold Price ($)', 'Beds', 'Baths', 'Living Area (Sq Ft)', 'Property Address', 'Sale Timeline'];
const SOLD_PORTFOLIO_SHEET_NAMES = ['Sales Transactions', 'Sold Properties'];

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
  if (!SOURCE_NAMES.has(expected)) throw new WorkbookImportError('Choose the supported portfolio workbook.');
  if (source !== expected) {
    throw new WorkbookImportError('This file is not the supported portfolio workbook.');
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

function manifestSide(value) {
  const side = text(value).toLowerCase();
  const buyer = side.includes('bought') || side.includes('buyer');
  const seller = side.includes('sold') || side.includes('seller');
  if (buyer && seller) return 'Buyer & Seller';
  if (buyer) return 'Buyer';
  if (seller) return 'Seller';
  throw new WorkbookImportError('Each manifest row must identify Bought with Gurmeet or Sold by Gurmeet.');
}

export function driveImageUrl(value) {
  const original = text(value);
  const match = original.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([a-zA-Z0-9_-]+)/i);
  return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : original;
}

function parsePhotoManifest(workbook) {
  const sheetName = 'Portfolio — all listings';
  if (!workbook.SheetNames.includes(sheetName)) throw new WorkbookImportError('The portfolio workbook must include a Portfolio — all listings sheet.');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
  const headerRowIndex = findHeaderRow(rows, PHOTO_MANIFEST_HEADERS);
  if (headerRowIndex < 0) throw new WorkbookImportError('The portfolio workbook is missing required columns.');
  const indices = headerIndex(rows[headerRowIndex]);
  const records = [];
  for (const [offset, row] of rowsAfterHeader(rows, headerRowIndex).entries()) {
    if (!row.some(value => text(value))) continue;
    const address = fullAddress(row[indices.Address]);
    const propertyPage = text(row[indices['Property page']]);
    const propertySlug = propertySlugFromUrl(propertyPage);
    if (!address) throw new WorkbookImportError(`The portfolio workbook has an invalid address on row ${headerRowIndex + offset + 2}.`);
    if (!propertySlug) throw new WorkbookImportError(`The portfolio workbook has an invalid Property page URL on row ${headerRowIndex + offset + 2}.`);
    const side = manifestSide(row[indices['Page(s)']]);
    records.push({
      source: { name: 'workbook', externalId: propertySlug, url: propertyPage },
      key: streetCityKey(address) || normalizeAddress(address),
      title: text(row[indices['Property name']]),
      address: { ...address, normalized: normalizeAddress(address) },
      propertySlug,
      propertySource: sourceFromPropertySlug(propertySlug),
      imageUrl: driveImageUrl(row[indices['Google Drive image link']]),
      originalImageUrl: text(row[indices['Google Drive image link']]),
      pages: text(row[indices['Page(s)']]),
      status: 'Sold',
      transactionSide: side,
      propertyPage,
      photoSource: text(row[indices['Photo source']]),
      verificationNotes: text(row[indices['Verification notes']]),
    });
  }
  if (!records.length) throw new WorkbookImportError('The portfolio workbook contains no valid property rows.');
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

function soldPortfolioSide(value) {
  const side = text(value).toLowerCase().replace(/\s+/g, ' ');
  if (side === 'buyer') return 'Buyer';
  if (side === 'seller') return 'Seller';
  if (side === 'both' || side === 'buyer / seller' || side === 'buyer and seller' || side === 'buyer & seller') return 'Buyer & Seller';
  return undefined;
}

function estimatedRelativeSoldDate(value, importedAt) {
  const match = text(value).match(/^sold\s+(\d+)\s+(month|year)s?\s+ago$/i);
  if (!match || !(importedAt instanceof Date) || Number.isNaN(importedAt.valueOf())) return undefined;
  const estimated = new Date(Date.UTC(importedAt.getUTCFullYear(), importedAt.getUTCMonth(), importedAt.getUTCDate()));
  const amount = Number(match[1]);
  if (match[2].toLowerCase() === 'month') estimated.setUTCMonth(estimated.getUTCMonth() - amount);
  else estimated.setUTCFullYear(estimated.getUTCFullYear() - amount);
  return estimated;
}

function parseSoldPortfolio(workbook, importedAt = new Date()) {
  const sheetName = SOLD_PORTFOLIO_SHEET_NAMES.find(name => workbook.SheetNames.includes(name));
  const sheet = sheetName && workbook.Sheets[sheetName];
  if (!sheet) throw new WorkbookImportError('The sold portfolio workbook must include a Sales Transactions sheet.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  const headerRowIndex = findHeaderRow(rows, SOLD_PORTFOLIO_HEADERS);
  if (headerRowIndex < 0) throw new WorkbookImportError('The sold portfolio workbook is missing required columns.');
  const indices = headerIndex(rows[headerRowIndex]);
  const records = [];
  const ignoredRows = [];
  for (const [offset, row] of rowsAfterHeader(rows, headerRowIndex).entries()) {
    const rowNumber = headerRowIndex + offset + 2;
    if (!row.some(value => text(value))) continue;
    const side = soldPortfolioSide(row[indices['Transaction Type']]);
    if (!side) {
      ignoredRows.push({ row: rowNumber, reason: 'Not a supported property transaction row.' });
      continue;
    }
    const address = fullAddress(row[indices['Property Address']]);
    if (!address) {
      ignoredRows.push({ row: rowNumber, reason: 'Property address is incomplete or invalid.' });
      continue;
    }
    const timeline = text(row[indices['Sale Timeline']]);
    const exactSoldDate = dateValue(row[indices['Sale Timeline']]);
    const soldDate = exactSoldDate || estimatedRelativeSoldDate(timeline, importedAt);
    const verification = exactSoldDate
      ? `Sold date recorded in the workbook: ${timeline}.`
      : soldDate
        ? `Sold date estimated from the workbook timeline: ${timeline}.`
        : timeline ? `Workbook sale timeline: ${timeline}.` : 'Sold portfolio workbook.';
    const record = makeRecord({
      source: 'workbook',
      address,
      price: numeric(row[indices['Sold Price ($)']]),
      status: 'Sold',
      beds: numeric(row[indices.Beds]),
      baths: numeric(row[indices.Baths]),
      sqft: numeric(row[indices['Living Area (Sq Ft)']]),
      soldDate,
      side,
      verification,
      notes: timeline,
      externalId: `sold-portfolio-${normalizeAddress(address)}`,
    });
    if (!record) {
      ignoredRows.push({ row: rowNumber, reason: 'Property address could not be normalized.' });
      continue;
    }
    records.push(record);
  }
  if (!records.length) throw new WorkbookImportError('The sold portfolio workbook contains no valid property rows.');
  return { rows: records, ignoredRows };
}

export function detectWorkbookSource(workbook) {
  if (SOLD_PORTFOLIO_SHEET_NAMES.some(name => workbook.SheetNames.includes(name))) return 'sold-portfolio';
  if (workbook.SheetNames.includes('Portfolio — all listings')) return 'workbook';
  if (workbook.SheetNames.includes('Profile and activity') || workbook.SheetNames.includes('All Properties')) return 'zillow';
  if (workbook.SheetNames.includes('Current Redfin') || workbook.SheetNames.includes('Earlier workbook rows') || workbook.SheetNames.includes('Transactions')) return 'redfin';
  throw new WorkbookImportError('Unsupported workbook. Upload the Homes By Gurmeet portfolio workbook with a Portfolio — all listings sheet.');
}

export function parseWorkbook(buffer, filename = 'uploaded.xlsx', options = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new WorkbookImportError('The uploaded workbook is empty.');
  let workbook;
  try {
    workbook = XLSX.read(buffer, { cellDates: true });
  } catch {
    throw new WorkbookImportError('The uploaded file is not a readable .xlsx workbook.');
  }
  const source = detectWorkbookSource(workbook);
  const parsed = source === 'redfin'
    ? { rows: parseRedfin(workbook), ignoredRows: [] }
    : source === 'zillow'
      ? { rows: parseZillow(workbook), ignoredRows: [] }
      : source === 'sold-portfolio'
        ? parseSoldPortfolio(workbook, options.importedAt || new Date())
        : { rows: parsePhotoManifest(workbook), ignoredRows: [] };
  const rows = parsed.rows;
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
    ignored: parsed.ignoredRows.length,
    ignoredRows: parsed.ignoredRows,
  };
}

export function snapshotForDocument(parsed) {
  return {
    source: parsed.source,
    filename: parsed.filename,
    checksum: parsed.checksum,
    rowCount: parsed.rows.length,
    rows: parsed.rows,
    ignored: parsed.ignored || 0,
    ignoredRows: parsed.ignoredRows || [],
    uploadedAt: new Date(),
  };
}

function sameManifestAddress(left = {}, right = {}) {
  const normalizedMatches = left.normalized && right.normalized && left.normalized === right.normalized;
  return normalizedMatches || streetCityKey(left) === streetCityKey(right);
}

export function findManifestPropertyMatch(row, properties = [], matchedIds = new Set()) {
  const available = properties.filter(property => !matchedIds.has(String(property._id)));
  const exactSlug = available.find(property => row.propertySlug && property.slug === row.propertySlug);
  if (exactSlug) return exactSlug;

  if (row.propertySource) {
    const sourceMatches = available.filter(property => (property.source?.name === row.propertySource || property.source?.providers?.includes(row.propertySource)) && sameManifestAddress(property.address, row.address));
    if (sourceMatches.length === 1) return sourceMatches[0];
  }

  const addressMatches = available.filter(property => sameManifestAddress(property.address, row.address));
  return addressMatches.length === 1 ? addressMatches[0] : null;
}

function manifestPhotoDocument(row, importedAt) {
  return {
    imageUrl: row.imageUrl,
    originalImageUrl: row.originalImageUrl,
    propertyPage: row.propertyPage,
    photoSource: row.photoSource,
    verificationNotes: row.verificationNotes,
    pages: row.pages,
    imageUrls: row.imageUrls,
    originalImageUrls: row.originalImageUrls,
    propertyPages: row.propertyPages,
    photoSources: row.photoSources,
    importedAt,
  };
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function rowCompleteness(row = {}) {
  return [
    row.title,
    row.address?.street,
    row.address?.city,
    row.address?.state,
    row.address?.zip,
    row.price,
    row.beds,
    row.baths,
    row.sqft,
    row.transaction?.soldDate,
    row.transactionSide,
    row.verificationNotes,
    row.confidence,
    row.notes,
    row.imageUrl,
    row.propertySlug,
    row.propertyPage,
    row.photoSource,
  ].filter(hasValue).length;
}

function uniqueValues(values) {
  return [...new Set(values.filter(hasValue))];
}

function mergedTransactionSide(rows) {
  const sides = new Set();
  for (const row of rows) {
    const side = text(row.transactionSide).toLowerCase();
    if (side.includes('buyer')) sides.add('Buyer');
    if (side.includes('seller')) sides.add('Seller');
  }
  if (sides.has('Buyer') && sides.has('Seller')) return 'Buyer & Seller';
  return sides.has('Buyer') ? 'Buyer' : sides.has('Seller') ? 'Seller' : undefined;
}

function mergeDuplicateRows(group = []) {
  const ordered = group
    .map((row, index) => ({ row, index }))
    .sort((left, right) => rowCompleteness(right.row) - rowCompleteness(left.row) || Boolean(right.row.imageUrl) - Boolean(left.row.imageUrl) || Boolean(right.row.propertySlug) - Boolean(left.row.propertySlug) || left.index - right.index)
    .map(item => item.row);
  const winner = ordered[0];
  const merged = { ...winner, address: { ...(winner.address || {}) } };

  for (const field of ['title', 'price', 'status', 'beds', 'baths', 'sqft', 'description', 'propertySlug', 'propertyPage', 'propertySource', 'photoSource', 'confidence', 'imageSearchUrl']) {
    if (!hasValue(merged[field])) {
      const fallback = ordered.find(row => hasValue(row[field]));
      if (fallback) merged[field] = fallback[field];
    }
  }
  for (const field of ['street', 'city', 'state', 'zip', 'normalized']) {
    if (!hasValue(merged.address[field])) {
      const fallback = ordered.find(row => hasValue(row.address?.[field]));
      if (fallback) merged.address[field] = fallback.address[field];
    }
  }

  merged.transactionSide = mergedTransactionSide(ordered);
  merged.imageUrls = uniqueValues(ordered.map(row => row.imageUrl));
  merged.originalImageUrls = uniqueValues(ordered.map(row => row.originalImageUrl));
  merged.propertySources = uniqueValues(ordered.map(row => row.propertySource));
  merged.propertyPages = uniqueValues(ordered.map(row => row.propertyPage));
  merged.photoSources = uniqueValues(ordered.map(row => row.photoSource));
  merged.verificationNotes = uniqueValues(ordered.map(row => row.verificationNotes)).join(' ');
  merged.originalImageUrl = merged.originalImageUrl || merged.originalImageUrls[0];
  merged.imageUrl = merged.imageUrl || merged.imageUrls[0];
  return merged;
}

export function deduplicateManifestRows(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.address?.normalized || streetCityKey(row.address) || row.propertySlug || row.source?.externalId;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  const deduplicated = [...groups.values()].map(mergeDuplicateRows);
  return { rows: deduplicated, ignored: rows.length - deduplicated.length };
}

export function buildManifestPropertyPlan(rows = [], existing = []) {
  const { rows: uniqueRows, ignored } = deduplicateManifestRows(rows);
  const matchedIds = new Set();
  const usedSlugs = new Set();
  const importedAt = new Date();
  const listings = [];
  let updated = 0;
  let created = 0;

  for (const row of uniqueRows) {
    const match = findManifestPropertyMatch(row, existing, matchedIds);
    const baseSlug = slugify(row.propertySlug || `${row.address.street}-${row.address.city}-${row.address.state}-${row.address.zip}`, { lower: true, strict: true }) || `property-${created + updated + 1}`;
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    usedSlugs.add(slug);

    const existingTransaction = match?.transaction || {};
    const existingSource = match?.source || {};
    const existingManagedImages = match?.photoManifest?.managedImagePaths || [];
    const preservedManagedImages = (match?.images || []).filter(image => existingManagedImages.includes(image) && image !== PROPERTY_PLACEHOLDER_IMAGE);
    const preservedManualImages = (match?.images || []).filter(image => !existingManagedImages.includes(image) && image !== match?.photoManifest?.imageUrl && image !== PROPERTY_PLACEHOLDER_IMAGE);
    const publicImages = [...new Set([...preservedManualImages, ...preservedManagedImages])];
    if (!publicImages.length) publicImages.push(PROPERTY_PLACEHOLDER_IMAGE);
    const payload = cleanValue({
      title: row.title || match?.title || `${row.address.street}, ${row.address.city}`,
      slug,
      address: row.address,
      price: match?.price,
      beds: match?.beds,
      baths: match?.baths,
      sqft: match?.sqft,
      description: match?.description,
      status: 'Sold',
      featured: false,
      images: publicImages,
      photoManifest: { ...(match?.photoManifest || {}), ...manifestPhotoDocument(row, importedAt), managedImagePaths: existingManagedImages },
      coordinates: match?.coordinates,
      coordinatesSource: match?.coordinatesSource,
      source: {
        name: 'workbook',
        externalId: row.source?.externalId || row.propertySlug,
        url: row.propertyPage,
        lastSyncedAt: importedAt,
        providers: uniqueValues([...(existingSource.providers || []), ...(row.propertySources || []), row.propertySource]),
      },
      manualOverrides: match?.manualOverrides || { price: false, description: false, images: false },
      transaction: {
        ...existingTransaction,
        side: row.transactionSide,
        verification: row.verificationNotes,
        notes: row.verificationNotes,
      },
      createdBy: match?.createdBy,
    });

    if (match) {
      matchedIds.add(String(match._id));
      updated++;
    } else {
      created++;
    }
    listings.push({ match, payload });
  }

  const removeIds = existing.filter(property => !matchedIds.has(String(property._id))).map(property => property._id);
  return { listings, removeIds, created, updated, ignored, totalListings: uniqueRows.length };
}

export async function rebuildManifestProperties(rows = [], { session } = {}) {
  const existing = await Property.find().session(session || null).lean();
  const plan = buildManifestPropertyPlan(rows, existing);
  const operations = plan.listings.map(({ match, payload }) => match
    ? { updateOne: { filter: { _id: match._id }, update: { $set: payload, $unset: { scraped: 1 } } } }
    : { insertOne: { document: payload } });
  if (plan.removeIds.length) await Property.deleteMany({ _id: { $in: plan.removeIds } }, { session });
  if (operations.length) await Property.bulkWrite(operations, { ordered: true, session });
  return { created: plan.created, updated: plan.updated, removed: plan.removeIds.length, ignored: plan.ignored, totalListings: plan.totalListings };
}

function soldPortfolioCompleteness(row = {}) {
  return [
    row.title,
    row.address?.street,
    row.address?.city,
    row.address?.state,
    row.address?.zip,
    row.price,
    row.beds,
    row.baths,
    row.sqft,
    row.transaction?.soldDate,
    row.transaction?.side,
    row.transaction?.verification,
  ].filter(hasValue).length;
}

function mergeSoldPortfolioRows(group = []) {
  const ordered = group
    .map((row, index) => ({ row, index }))
    .sort((left, right) => soldPortfolioCompleteness(right.row) - soldPortfolioCompleteness(left.row) || left.index - right.index)
    .map(item => item.row);
  const winner = ordered[0];
  const merged = { ...winner, address: { ...(winner.address || {}) }, transaction: { ...(winner.transaction || {}) } };
  for (const field of ['title', 'price', 'beds', 'baths', 'sqft', 'description']) {
    if (!hasValue(merged[field])) {
      const fallback = ordered.find(row => hasValue(row[field]));
      if (fallback) merged[field] = fallback[field];
    }
  }
  for (const field of ['street', 'city', 'state', 'zip', 'normalized']) {
    if (!hasValue(merged.address[field])) {
      const fallback = ordered.find(row => hasValue(row.address?.[field]));
      if (fallback) merged.address[field] = fallback.address[field];
    }
  }
  const side = mergedTransactionSide(ordered.map(row => ({ transactionSide: row.transaction?.side })));
  const verification = uniqueValues(ordered.map(row => row.transaction?.verification)).join(' ');
  const notes = uniqueValues(ordered.map(row => row.transaction?.notes)).join(' ');
  merged.transaction = {
    ...merged.transaction,
    soldDate: ordered.find(row => hasValue(row.transaction?.soldDate))?.transaction?.soldDate,
    side,
    verification: verification || merged.transaction.verification,
    notes: notes || merged.transaction.notes,
  };
  merged.description = [`Transaction side: ${side}.`, merged.transaction.verification, merged.transaction.notes].filter(Boolean).join(' ');
  return merged;
}

export function deduplicateSoldPortfolioRows(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.address?.normalized || streetCityKey(row.address) || row.source?.externalId;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  const deduplicated = [...groups.values()].map(mergeSoldPortfolioRows);
  return { rows: deduplicated, ignored: rows.length - deduplicated.length };
}

function additivePropertyMatch(row, existing = [], matchedIds = new Set()) {
  return existing.find(property => !matchedIds.has(String(property._id)) && sameManifestAddress(property.address, row.address)) || null;
}

export function buildSoldPortfolioAdditivePlan(rows = [], existing = [], importedAt = new Date()) {
  const deduplicated = deduplicateSoldPortfolioRows(rows);
  const matchedIds = new Set();
  const usedSlugs = new Set(existing.map(property => property.slug).filter(Boolean));
  const listings = [];
  let created = 0;
  let updated = 0;

  for (const row of deduplicated.rows) {
    const match = additivePropertyMatch(row, existing, matchedIds);
    const baseSlug = match?.slug || slugify(`sold-${row.address.street}-${row.address.city}-${row.address.state}-${row.address.zip}`, { lower: true, strict: true }) || `sold-property-${created + updated + 1}`;
    let slug = baseSlug;
    let suffix = 2;
    while (!match && usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
    usedSlugs.add(slug);
    const existingAddress = match?.address || {};
    const existingSource = match?.source || {};
    const existingTransaction = match?.transaction || {};
    const images = match?.images?.length ? match.images : [PROPERTY_PLACEHOLDER_IMAGE];
    const transaction = cleanValue({
      ...existingTransaction,
      soldDate: row.transaction?.soldDate || existingTransaction.soldDate,
      side: row.transaction?.side || existingTransaction.side,
      verification: row.transaction?.verification || existingTransaction.verification,
      notes: row.transaction?.notes || existingTransaction.notes,
    });
    const payload = cleanValue({
      title: row.title || match?.title || `${row.address.street}, ${row.address.city}`,
      slug,
      address: {
        street: row.address.street || existingAddress.street,
        city: row.address.city || existingAddress.city,
        state: row.address.state || existingAddress.state,
        zip: row.address.zip || existingAddress.zip,
        normalized: row.address.normalized || existingAddress.normalized,
      },
      price: row.price ?? match?.price,
      beds: row.beds ?? match?.beds,
      baths: row.baths ?? match?.baths,
      sqft: row.sqft ?? match?.sqft,
      description: match?.description || row.description,
      status: 'Sold',
      featured: match?.featured ?? false,
      images,
      photoManifest: match?.photoManifest,
      coordinates: match?.coordinates,
      coordinatesSource: match?.coordinatesSource,
      source: {
        ...existingSource,
        name: existingSource.name || 'workbook',
        externalId: row.source?.externalId,
        lastSyncedAt: importedAt,
        providers: uniqueValues([...(existingSource.providers || []), existingSource.name, 'workbook']),
      },
      manualOverrides: match?.manualOverrides || { price: false, description: false, images: false },
      transaction,
      createdBy: match?.createdBy,
    });
    if (match) {
      matchedIds.add(String(match._id));
      updated++;
    } else {
      created++;
    }
    listings.push({ match, payload });
  }
  return {
    listings,
    created,
    updated,
    removed: 0,
    ignored: deduplicated.ignored,
    totalListings: existing.length + created,
  };
}

export async function addSoldPortfolioProperties(rows = [], { session, importedAt = new Date() } = {}) {
  const existing = await Property.find().session(session || null).lean();
  const plan = buildSoldPortfolioAdditivePlan(rows, existing, importedAt);
  const operations = plan.listings.map(({ match, payload }) => match
    ? { updateOne: { filter: { _id: match._id }, update: { $set: payload } } }
    : { insertOne: { document: payload } });
  if (operations.length) await Property.bulkWrite(operations, { ordered: true, session });
  return plan;
}

function cleanValue(value) {
  if (Array.isArray(value)) return value.map(cleanValue);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).filter(([, nested]) => nested !== undefined).map(([key, nested]) => [key, cleanValue(nested)]));
  }
  return value;
}
