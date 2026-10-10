export function propertyStatusLabel({ status, portfolioSide } = {}) {
  if (status === 'Sold') return portfolioSide === 'buyer' ? 'BOUGHT' : 'SOLD';
  if (status === 'Pending') return 'PENDING';
  return 'FOR SALE';
}
