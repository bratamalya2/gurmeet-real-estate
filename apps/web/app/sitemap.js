import { serverApiUrl } from '../lib/api';

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const staticPages = ['', '/about', '/services', '/homes-for-sale', '/recently-sold', '/contact', '/home-valuation'].map(path => ({ url: `${baseUrl}${path}`, lastModified: new Date(), changeFrequency: 'weekly', priority: path === '' ? 1 : 0.7 }));
  try {
    const response = await fetch(serverApiUrl('properties?limit=24&page=1'), { cache: 'no-store' });
    if (!response.ok) return staticPages;
    const firstPage = await response.json();
    const pages = await Promise.all(Array.from({ length: firstPage.pages || 1 }, (_, index) => index ? fetch(serverApiUrl(`properties?limit=24&page=${index + 1}`), { cache: 'no-store' }).then(result => result.ok ? result.json() : { items: [] }) : firstPage));
    return [...staticPages, ...pages.flatMap(result => result.items.map(property => ({ url: `${baseUrl}/properties/${property.slug}`, lastModified: property.updatedAt || property.createdAt, changeFrequency: 'weekly', priority: 0.8 })))] ;
  } catch { return staticPages; }
}
