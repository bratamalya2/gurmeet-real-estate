export const propertySides = ['buyer', 'seller'];

export function propertySideFilter(side) {
  if (!propertySides.includes(side)) return null;
  return { 'transaction.side': new RegExp(side, 'i') };
}
