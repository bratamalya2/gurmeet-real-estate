import { Lead, Property } from '../models/index.js';
import { PROPERTY_PLACEHOLDER_IMAGE } from '../constants/property-assets.js';

const MERGED_ARRAY_FIELDS = [
  'imageUrls',
  'originalImageUrls',
  'propertyPages',
  'photoSources',
  'managedImagePaths',
  'localUploadPaths',
  'driveFileIds',
];

const hasValue = value => value !== undefined && value !== null && value !== '';
const propertyId = property => property?._id;
const propertyIdString = property => String(propertyId(property) ?? '');

function unique(values = []) {
  return [...new Set(values.filter(hasValue).map(value => String(value)))];
}

function realImages(property = {}) {
  return (property.images || []).filter(image => image && image !== PROPERTY_PLACEHOLDER_IMAGE);
}

function completenessScore(property = {}) {
  return [
    property.price,
    property.beds,
    property.baths,
    property.sqft,
    property.description,
    property.coordinates?.lat,
    property.coordinates?.lng,
    property.transaction?.soldDate,
    property.transaction?.side,
    property.transaction?.verification,
    property.source?.url,
  ].filter(hasValue).length;
}

function updatedTime(property = {}) {
  const value = new Date(property.updatedAt || 0).valueOf();
  return Number.isFinite(value) ? value : 0;
}

function compareCandidates(left, right) {
  const completeness = completenessScore(right) - completenessScore(left);
  if (completeness) return completeness;
  const images = realImages(right).length - realImages(left).length;
  if (images) return images;
  const updated = updatedTime(right) - updatedTime(left);
  if (updated) return updated;
  return propertyIdString(left).localeCompare(propertyIdString(right));
}

function mergedSide(properties) {
  const sides = properties.map(property => String(property.transaction?.side || '').toLowerCase());
  const buyer = sides.some(side => side.includes('buyer') || side.includes('bought'));
  const seller = sides.some(side => side.includes('seller') || side.includes('sold'));
  if (buyer && seller) return 'Buyer & Seller';
  if (buyer) return 'Buyer';
  if (seller) return 'Seller';
  return properties.map(property => property.transaction?.side).find(hasValue);
}

function firstValue(properties, getter) {
  return properties.map(getter).find(hasValue);
}

function mergePhotoManifest(properties) {
  const manifests = properties.map(property => property.photoManifest || {});
  const merged = {};
  for (const field of MERGED_ARRAY_FIELDS) {
    const values = unique(manifests.flatMap(manifest => manifest[field] || []));
    if (values.length) merged[field] = values;
  }
  for (const field of ['imageUrl', 'originalImageUrl', 'propertyPage', 'photoSource', 'verificationNotes', 'pages', 'driveFolderUrl', 'downloadedAt', 'importedAt']) {
    const value = firstValue(manifests, manifest => manifest[field]);
    if (hasValue(value)) merged[field] = value;
  }
  return merged;
}

function mergePropertyRecords(canonical, rankedProperties) {
  const merged = {
    title: firstValue(rankedProperties, property => property.title),
    address: firstValue(rankedProperties, property => property.address),
    price: firstValue(rankedProperties, property => property.price),
    beds: firstValue(rankedProperties, property => property.beds),
    baths: firstValue(rankedProperties, property => property.baths),
    sqft: firstValue(rankedProperties, property => property.sqft),
    description: firstValue(rankedProperties, property => property.description),
    status: firstValue(rankedProperties, property => property.status),
    featured: canonical.featured,
    coordinates: firstValue(rankedProperties, property => property.coordinates),
    manualOverrides: {
      price: rankedProperties.some(property => property.manualOverrides?.price),
      description: rankedProperties.some(property => property.manualOverrides?.description),
      images: rankedProperties.some(property => property.manualOverrides?.images),
    },
    source: {
      ...canonical.source,
      providers: unique(rankedProperties.flatMap(property => [
        ...(property.source?.providers || []),
        property.source?.name,
      ])),
    },
    transaction: {
      soldDate: firstValue(rankedProperties, property => property.transaction?.soldDate),
      side: mergedSide(rankedProperties),
      verification: firstValue(rankedProperties, property => property.transaction?.verification),
      confidence: firstValue(rankedProperties, property => property.transaction?.confidence),
      notes: firstValue(rankedProperties, property => property.transaction?.notes),
      imageSearchUrl: firstValue(rankedProperties, property => property.transaction?.imageSearchUrl),
    },
    photoManifest: mergePhotoManifest(rankedProperties),
  };

  const images = unique(rankedProperties.flatMap(property => property.images || []));
  const real = images.filter(image => image !== PROPERTY_PLACEHOLDER_IMAGE);
  merged.images = real.length ? real : unique(images.length ? images : [PROPERTY_PLACEHOLDER_IMAGE]);
  return merged;
}

export function buildPropertyDeduplicationPlan(properties = []) {
  const groupsByAddress = new Map();
  let skipped = 0;
  for (const property of properties) {
    const normalized = String(property.address?.normalized || '').trim().toLowerCase();
    if (!normalized) {
      skipped += 1;
      continue;
    }
    const group = groupsByAddress.get(normalized) || [];
    group.push(property);
    groupsByAddress.set(normalized, group);
  }

  const operations = [];
  const duplicateIds = [];
  for (const [normalized, group] of groupsByAddress) {
    if (group.length < 2) continue;
    const ranked = [...group].sort(compareCandidates);
    const canonical = ranked[0];
    const duplicates = ranked.slice(1);
    const ids = duplicates.map(propertyId).filter(hasValue);
    duplicateIds.push(...ids);
    operations.push({
      normalized,
      canonicalId: propertyId(canonical),
      duplicateIds: ids,
      update: mergePropertyRecords(canonical, ranked),
    });
  }

  return {
    operations,
    duplicateIds,
    groups: operations.length,
    removed: duplicateIds.length,
    retained: properties.length - duplicateIds.length,
    skipped,
  };
}

export async function applyPropertyDeduplication({ session } = {}) {
  const query = Property.find();
  if (session) query.session(session);
  const properties = await query.lean();
  const plan = buildPropertyDeduplicationPlan(properties);
  const options = session ? { session } : {};

  for (const operation of plan.operations) {
    await Property.updateOne({ _id: operation.canonicalId }, { $set: operation.update }, options);
  }

  let leadsReassigned = 0;
  if (plan.duplicateIds.length) {
    for (const operation of plan.operations) {
      if (!operation.duplicateIds.length) continue;
      const result = await Lead.updateMany(
        { property: { $in: operation.duplicateIds } },
        { $set: { property: operation.canonicalId } },
        options,
      );
      leadsReassigned += result.modifiedCount ?? result.nModified ?? 0;
    }
    await Property.deleteMany({ _id: { $in: plan.duplicateIds } }, options);
  }
  return { ...plan, leadsReassigned };
}
