const eligible = property => Number(property?.price) > 0;

const updatedAt = property => {
  const value = new Date(property?.updatedAt || 0).valueOf();
  return Number.isFinite(value) ? value : 0;
};

export const featuredPropertyFilter = {
  price: { $gt: 0 },
};

export const featuredPropertySort = { price: -1, updatedAt: -1, _id: 1 };

export function highestValueProperties(properties = []) {
  return [...properties]
    .filter(eligible)
    .sort((left, right) => {
      const byPrice = Number(right.price) - Number(left.price);
      if (byPrice) return byPrice;
      const byUpdatedAt = updatedAt(right) - updatedAt(left);
      if (byUpdatedAt) return byUpdatedAt;
      return String(left._id || '').localeCompare(String(right._id || ''));
    })
    .slice(0, 10);
}
