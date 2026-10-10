const eligible = property => ['Active', 'Pending'].includes(property?.status) && Number(property?.price) > 0;

export function featuredAddressKey(property) {
  const normalized = property?.address?.normalized;
  if (normalized) return `address:${normalized}`;
  const address = property?.address || {};
  const fallback = [address.street, address.city, address.state, address.zip]
    .filter(Boolean)
    .join('')
    .toLowerCase()
    .replace(/\W/g, '');
  return fallback ? `address:${fallback}` : `property:${property?._id || ''}`;
}

const updatedAt = property => {
  const value = new Date(property?.updatedAt || 0).valueOf();
  return Number.isFinite(value) ? value : 0;
};

export const featuredPropertyFilter = {
  status: { $in: ['Active', 'Pending'] },
  price: { $gt: 0 },
};

export const featuredPropertySort = { price: -1, updatedAt: -1, _id: 1 };

export function highestValueProperties(properties = []) {
  const sorted = [...properties]
    .filter(eligible)
    .sort((left, right) => {
      const byPrice = Number(right.price) - Number(left.price);
      if (byPrice) return byPrice;
      const byUpdatedAt = updatedAt(right) - updatedAt(left);
      if (byUpdatedAt) return byUpdatedAt;
      return String(left._id || '').localeCompare(String(right._id || ''));
    });
  const seen = new Set();
  return sorted.filter(property => {
    const key = featuredAddressKey(property);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}
