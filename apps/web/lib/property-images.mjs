import { PROPERTY_PLACEHOLDER_IMAGE } from './property-assets.js';

export function propertyPhotoPaths(property = {}) {
  const candidates = [
    ...(Array.isArray(property.images) ? property.images : []),
    ...(Array.isArray(property.photoManifest?.managedImagePaths) ? property.photoManifest.managedImagePaths : []),
    ...(Array.isArray(property.photoManifest?.localUploadPaths) ? property.photoManifest.localUploadPaths : []),
  ].filter(path => typeof path === 'string' && path && path !== PROPERTY_PLACEHOLDER_IMAGE);
  return [...new Set(candidates)].length ? [...new Set(candidates)] : [PROPERTY_PLACEHOLDER_IMAGE];
}
