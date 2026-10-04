'use client';

import { useEffect, useMemo, useState } from 'react';
import { publicApiUrl } from '../lib/api';

const emptyData = {
  overview: {},
  traffic: { trend: [], topPages: [], topListings: [] },
  leads: { trend: [], byType: [], byListing: [] },
  inventory: { byStatus: [], byCity: [], price: {}, imageCoverage: {}, sourceCoverage: [] },
  dataHealth: { latestImports: [], lastActivity: null },
};

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDate(date);
}

function presetQuery(preset) {
  if (preset === 'all') return 'range=all';
  const today = localDate();
  if (preset === 'ytd') return `from=${today.slice(0, 4)}-01-01&to=${today}`;
  const days = Number(preset.replace('d', ''));
  return `from=${daysAgo(days - 1)}&to=${today}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ label, value, detail }) {
  return <div className="analytics-stat"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function BarList({ items, labelKey = 'label', valueKey = 'count', empty = 'No data yet.' }) {
  const max = Math.max(...items.map(item => Number(item[valueKey] || 0)), 1);
  if (!items.length) return <p className="muted analytics-empty">{empty}</p>;
  return <div className="analytics-bars">{items.map((item, index) => <div className="analytics-bar-row" key={`${item[labelKey]}-${index}`}><div className="analytics-bar-label"><span>{item[labelKey]}</span><b>{formatNumber(item[valueKey])}</b></div><div className="analytics-bar-track"><i style={{ width: `${(Number(item[valueKey] || 0) / max) * 100}%` }} /></div></div>)}</div>;
}

function TrendChart({ data, firstKey, secondKey, firstLabel, secondLabel, empty = 'No activity in this range.' }) {
  const max = Math.max(...data.flatMap(item => [item[firstKey] || 0, item[secondKey] || 0]), 1);
  const points = key => data.map((item, index) => `${data.length === 1 ? 50 : (index / (data.length - 1)) * 100},${100 - ((item[key] || 0) / max) * 86 - 7}`).join(' ');
  if (!data.length) return <p className="muted analytics-empty">{empty}</p>;
  return <div className="analytics-trend"><div className="analytics-legend"><span><i className="legend-dot first" />{firstLabel}</span><span><i className="legend-dot second" />{secondLabel}</span></div><svg viewBox="0 0 100 100" role="img" aria-label={`${firstLabel} and ${secondLabel} trend chart`} preserveAspectRatio="none"><line x1="0" y1="93" x2="100" y2="93" /><polyline className="trend-line first" points={points(firstKey)} /><polyline className="trend-line second" points={points(secondKey)} /></svg><table className="analytics-table"><caption className="sr-only">{firstLabel} and {secondLabel} by day</caption><thead><tr><th>Date</th><th>{firstLabel}</th><th>{secondLabel}</th></tr></thead><tbody>{data.map(item => <tr key={item.date}><td>{item.date}</td><td>{formatNumber(item[firstKey])}</td><td>{formatNumber(item[secondKey])}</td></tr>)}</tbody></table></div>;
}

function LeadTrend({ data }) {
  const max = Math.max(...data.map(item => item.count || 0), 1);
  if (!data.length) return <p className="muted analytics-empty">No leads in this range.</p>;
  return <div className="analytics-trend"><svg viewBox="0 0 100 100" role="img" aria-label="Lead trend chart" preserveAspectRatio="none"><line x1="0" y1="93" x2="100" y2="93" /><polyline className="trend-line first" points={data.map((item, index) => `${data.length === 1 ? 50 : (index / (data.length - 1)) * 100},${100 - ((item.count || 0) / max) * 86 - 7}`).join(' ')} /></svg><table className="analytics-table"><caption className="sr-only">Leads by day</caption><thead><tr><th>Date</th><th>Leads</th></tr></thead><tbody>{data.map(item => <tr key={item.date}><td>{item.date}</td><td>{formatNumber(item.count)}</td></tr>)}</tbody></table></div>;
}

function DataTable({ headers, rows, empty = 'No data yet.' }) {
  if (!rows.length) return <p className="muted analytics-empty">{empty}</p>;
  return <table className="admin-table analytics-table"><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.key || index}>{row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
}

export default function AdminAnalytics() {
  const [preset, setPreset] = useState('30d');
  const [customFrom, setCustomFrom] = useState(daysAgo(29));
  const [customTo, setCustomTo] = useState(localDate());
  const [query, setQuery] = useState(presetQuery('30d'));
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(publicApiUrl(`admin/analytics?${query}`), { credentials: 'include' })
      .then(response => response.ok ? response.json() : response.json().then(result => Promise.reject(new Error(result.error || 'Analytics could not be loaded.'))))
      .then(result => { if (!cancelled) setData(result); })
      .catch(fetchError => { if (!cancelled) setError(fetchError.message || 'Analytics could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const overview = data.overview || {};
  const price = data.inventory?.price || {};
  const rangeLabel = useMemo(() => data.range?.from && data.range?.to ? `${data.range.from} to ${data.range.to}` : 'All available data', [data.range]);
  const choosePreset = event => {
    const value = event.target.value;
    setPreset(value);
    if (value !== 'custom') setQuery(presetQuery(value));
  };
  const applyCustom = event => {
    event.preventDefault();
    if (!customFrom || !customTo) return;
    setQuery(`from=${customFrom}&to=${customTo}`);
  };

  return <div className="analytics-page">
    <div className="analytics-toolbar">
      <div><p className="eyebrow">Reporting period</p><strong>{rangeLabel}</strong></div>
      <div className="analytics-controls"><select value={preset} onChange={choosePreset} aria-label="Analytics date range"><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="ytd">Year to date</option><option value="all">All time</option><option value="custom">Custom range</option></select>{preset === 'custom' && <form onSubmit={applyCustom}><input type="date" value={customFrom} onChange={event => setCustomFrom(event.target.value)} aria-label="Analytics start date" /><span>–</span><input type="date" value={customTo} onChange={event => setCustomTo(event.target.value)} aria-label="Analytics end date" /><button className="btn" type="submit">Apply</button></form>}</div>
    </div>
    {error && <p className="error">{error}</p>}
    {loading ? <div className="empty">Loading analytics…</div> : <>
      <div className="analytics-kpis"><StatCard label="Page views" value={formatNumber(overview.pageViews)} /><StatCard label="Listing views" value={formatNumber(overview.listingViews)} /><StatCard label="Leads" value={formatNumber(overview.leads)} /><StatCard label="Total listings" value={formatNumber(overview.totalListings)} /><StatCard label="Active listings" value={formatNumber(overview.activeListings)} /><StatCard label="Avg. active price" value={formatCurrency(overview.activeAveragePrice)} /></div>
      <div className="analytics-grid two"><Panel title="Traffic trend"><TrendChart data={data.traffic?.trend || []} firstKey="pageViews" secondKey="listingViews" firstLabel="Page views" secondLabel="Listing views" /></Panel><Panel title="Lead trend"><LeadTrend data={data.leads?.trend || []} /></Panel></div>
      <div className="analytics-grid three"><Panel title="Lead types"><BarList items={(data.leads?.byType || []).map(item => ({ label: item.type, count: item.count }))} /></Panel><Panel title="Listing status"><BarList items={(data.inventory?.byStatus || []).map(item => ({ label: item.status, count: item.count }))} /></Panel><Panel title="Price range"><div className="analytics-price-list"><span>Average active price <b>{formatCurrency(price.average)}</b></span><span>Lowest active price <b>{formatCurrency(price.minimum)}</b></span><span>Highest active price <b>{formatCurrency(price.maximum)}</b></span></div></Panel></div>
      <div className="analytics-grid two"><Panel title="Listings by city"><BarList items={data.inventory?.byCity || []} /></Panel><Panel title="Source coverage"><BarList items={data.inventory?.sourceCoverage || []} /></Panel></div>
      <div className="analytics-grid two"><Panel title="Top public pages"><DataTable headers={["Page", "Views"]} rows={(data.traffic?.topPages || []).map(item => ({ key: item.path, cells: [item.path, formatNumber(item.views)] }))} /></Panel><Panel title="Top viewed listings"><DataTable headers={["Listing", "Views"]} rows={(data.traffic?.topListings || []).map(item => ({ key: item.propertyId, cells: [item.title, formatNumber(item.views)] }))} /></Panel></div>
      <div className="analytics-grid two"><Panel title="Listings generating leads"><DataTable headers={["Listing", "Leads"]} rows={(data.leads?.byListing || []).map(item => ({ key: item.propertyId, cells: [item.title, formatNumber(item.leads)] }))} /></Panel><Panel title="Image coverage"><BarList items={[{ label: 'With images', count: data.inventory?.imageCoverage?.withImages || 0 }, { label: 'Without images', count: data.inventory?.imageCoverage?.withoutImages || 0 }]} /></Panel></div>
      <div className="analytics-grid two"><Panel title="Data freshness"><DataTable headers={["Source", "Rows", "Last upload", "Status"]} rows={(data.dataHealth?.latestImports || []).map(item => ({ key: item.source, cells: [item.source, formatNumber(item.rowCount), formatDate(item.uploadedAt), item.status] }))} empty="No workbook imports yet." /></Panel><Panel title="Recent system activity"><DataTable headers={["Source", "Status", "Created", "Updated", "When"]} rows={data.dataHealth?.lastActivity ? [{ key: data.dataHealth.lastActivity._id, cells: [data.dataHealth.lastActivity.source, data.dataHealth.lastActivity.status, formatNumber(data.dataHealth.lastActivity.created), formatNumber(data.dataHealth.lastActivity.updated), formatDate(data.dataHealth.lastActivity.completedAt || data.dataHealth.lastActivity.createdAt)] }] : []} empty="No system activity yet." /></Panel></div>
    </>}
  </div>;
}

function Panel({ title, children }) {
  return <section className="admin-panel analytics-panel"><h2>{title}</h2>{children}</section>;
}
