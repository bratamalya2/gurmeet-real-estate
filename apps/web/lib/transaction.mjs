export function relativeTransactionLabel(transaction = {}, now = new Date()) {
  const date = new Date(transaction.soldDate);
  if (!transaction.soldDate || Number.isNaN(date.valueOf()) || date > now) return '';
  let months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const duration = years
    ? `${years} year${years === 1 ? '' : 's'}${remainingMonths ? ` ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}` : ''}`
    : months ? `${months} month${months === 1 ? '' : 's'}` : 'less than a month';
  const side = String(transaction.side || '').toLowerCase();
  const action = side.includes('buyer') && !side.includes('seller') ? 'Purchased' : side.includes('seller') && !side.includes('buyer') ? 'Sold' : 'Transaction completed';
  const approximate = /estimated/i.test(String(transaction.verification || '')) ? 'Approx. ' : '';
  return `${approximate}${action} ${duration} ago`;
}
