export const propertySides = ['buyer', 'seller'];
export const propertySources = ['redfin', 'zillow'];

export function propertySideFilter(side) {
  if (!propertySides.includes(side)) return null;
  return { 'transaction.side': new RegExp(side, 'i') };
}

export function propertySourceFilter(source) {
  if (!propertySources.includes(source)) return null;
  const provider = new RegExp(`^${source}$`, 'i');
  return { $or: [{ 'source.name': provider }, { 'source.providers': provider }] };
}
