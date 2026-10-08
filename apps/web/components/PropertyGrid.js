'use client';

import { useEffect, useState } from 'react';
import PropertyCard from './PropertyCard';
import { publicApiUrl } from '../lib/api';

const initialFilters = { q: '', city: '', minPrice: '', maxPrice: '', beds: '', baths: '' };

export default function PropertyGrid({ status, side, featured = false, showFilters = false, showSourceFilters = false, showPriceSort = false }) {
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState('price_desc');
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set('status', status);
  if (side) query.set('side', side);
  if (showSourceFilters && source !== 'all') query.set('source', source);
  if (showPriceSort) query.set('sort', sort);
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const endpoint = featured ? publicApiUrl('properties/featured') : publicApiUrl(`properties?${query.toString()}`);
    fetch(endpoint).then(response => response.ok ? response.json() : Promise.reject()).then(result => {
      if (!cancelled) setData(featured ? { items: result, total: result.length, page: 1, pages: 1 } : result);
    }).catch(() => { if (!cancelled) setData({ items: [], total: 0, page: 1, pages: 1 }); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [featured, page, status, side, source, sort, showSourceFilters, showPriceSort, JSON.stringify(filters)]);

  function applyFilters(event) { event.preventDefault(); setPage(1); setFilters(draft); }
  function clearFilters() { setDraft(initialFilters); setFilters(initialFilters); setSource('all'); setPage(1); }

  return <>
    {(showSourceFilters || showPriceSort) && <div className="listing-toolbar">
      {showSourceFilters && <div className="listing-source-filter" role="group" aria-label="Filter portfolio by listing source">
        <span>Listing source</span>
        <div className="source-pills">
          {['all', 'zillow', 'redfin'].map(option => <button key={option} type="button" className={source === option ? 'source-pill active' : 'source-pill'} aria-pressed={source === option} onClick={() => { setSource(option); setPage(1); }}>{option === 'all' ? 'All' : option[0].toUpperCase() + option.slice(1)}</button>)}
        </div>
      </div>}
      {showPriceSort && <label className="listing-sort">Sort by
        <select value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}>
          <option value="price_desc">Price: high to low</option>
          <option value="price_asc">Price: low to high</option>
        </select>
      </label>}
    </div>}
    {showFilters && <form className="listing-filters" onSubmit={applyFilters}>
      <input aria-label="Search listings" placeholder="Search address, city, or ZIP" value={draft.q} onChange={event => setDraft({ ...draft, q: event.target.value })} />
      <input aria-label="City" placeholder="City" value={draft.city} onChange={event => setDraft({ ...draft, city: event.target.value })} />
      <input aria-label="Minimum price" inputMode="numeric" placeholder="Min price" value={draft.minPrice} onChange={event => setDraft({ ...draft, minPrice: event.target.value })} />
      <input aria-label="Maximum price" inputMode="numeric" placeholder="Max price" value={draft.maxPrice} onChange={event => setDraft({ ...draft, maxPrice: event.target.value })} />
      <select aria-label="Minimum bedrooms" value={draft.beds} onChange={event => setDraft({ ...draft, beds: event.target.value })}><option value="">Any beds</option><option value="2">2+ beds</option><option value="3">3+ beds</option><option value="4">4+ beds</option></select>
      <select aria-label="Minimum bathrooms" value={draft.baths} onChange={event => setDraft({ ...draft, baths: event.target.value })}><option value="">Any baths</option><option value="2">2+ baths</option><option value="3">3+ baths</option></select>
      <button className="btn" type="submit">Apply filters</button><button className="text-button" type="button" onClick={clearFilters}>Clear</button>
    </form>}
    {!featured && !loading && <p className="listing-count">{data.total} {side === 'buyer' ? 'homes bought with Gurmeet' : side === 'seller' ? 'homes sold by Gurmeet' : status === 'Sold' ? 'sold properties' : 'properties'} found</p>}
    {loading ? <div className="empty">Loading properties…</div> : data.items.length ? <div className="grid three">{data.items.map(property => <PropertyCard key={property._id} p={property} />)}</div> : <div className="empty">{featured ? 'Featured residences will appear here soon.' : 'No properties match those filters.'}</div>}
    {!featured && data.pages > 1 && <nav className="pagination" aria-label="Listing pages"><button className="btn alt" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {data.page} of {data.pages}</span><button className="btn alt" disabled={page >= data.pages} onClick={() => setPage(current => current + 1)}>Next</button></nav>}
  </>;
}
