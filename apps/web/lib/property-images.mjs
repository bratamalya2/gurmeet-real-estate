import { PROPERTY_PLACEHOLDER_IMAGE } from './property-assets.js';

export function propertyPrimaryImagePath(property = {}) {
  const images = Array.isArray(property.images) ? property.images : [];
  return images.find(path => typeof path === 'string' && path.trim()) || PROPERTY_PLACEHOLDER_IMAGE;
}
