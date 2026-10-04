import Link from 'next/link';

const money = value => value ? `$${Math.round(value).toLocaleString()}` : '$0';
const number = value => value ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0';
const date = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';

function Metric({ label, value, detail }) {
  return <div className="insight-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function BarPanel({ title, items, labelKey, valueKey, formatValue = number }) {
  const values = items.map(item => Number(item[valueKey]) || 0);
  const maximum = Math.max(...values, 1);
  return <section className="insight-panel">
    <h2>{title}</h2>
    {items.length ? <>
      <div className="insight-bars" aria-hidden="true">{items.map(item => <div className="insight-bar" key={String(item[labelKey])}><div className="insight-bar-label"><span>{item[labelKey]}</span><b>{formatValue(item[valueKey])}</b></div><div className="insight-bar-track"><i style={{ width: `${Math.max((Number(item[valueKey]) || 0) / maximum * 100, 2)}%` }} /></div></div>)}</div>
      <table className="insight-table"><caption className="sr-only">{title} data</caption><thead><tr><th scope="col">Category</th><th scope="col">Count</th></tr></thead><tbody>{items.map(item => <tr key={String(item[labelKey])}><td>{item[labelKey]}</td><td>{formatValue(item[valueKey])}</td></tr>)}</tbody></table>
    </> : <p className="muted">No records available for this view.</p>}
  </section>;
}

export default function MarketInsights({ data }) {
  if (!data || !data.soldCount) return <div className="insight-empty"><p className="eyebrow">Awaiting sold data</p><h2>Market insights will appear here soon.</h2><p>Once sold homes are added to the portfolio, this page will summarize the market patterns in that record.</p></div>;

  return <div className="insights-dashboard">
    <div className="insight-kpis">
      <Metric label="Sold homes" value={number(data.soldCount)} />
      <Metric label="Total sales volume" value={money(data.totalSalesVolume)} />
      <Metric label="Average sale price" value={money(data.averageSalePrice)} />
      <Metric label="Median sale price" value={money(data.medianSalePrice)} />
      <Metric label="Average price / sq ft" value={money(data.averagePricePerSqft)} />
      <Metric label="Average home size" value={`${number(data.averageSqft)} sq ft`} />
    </div>
    <div className="insight-grid insight-grid-three">
      <BarPanel title="Sold homes by year" items={data.byYear || []} labelKey="year" valueKey="count" />
      <BarPanel title="Sold homes by city" items={data.byCity || []} labelKey="city" valueKey="count" />
      <BarPanel title="Price-band distribution" items={data.priceBands || []} labelKey="label" valueKey="count" />
    </div>
    <section className="insight-profile">
      <div><p className="eyebrow">Buyer and seller profile</p><h2>The homes in this record</h2></div>
      <div className="insight-profile-stats"><Metric label="Average bedrooms" value={number(data.averageBeds)} /><Metric label="Average bathrooms" value={number(data.averageBaths)} /><Metric label="Average square footage" value={`${number(data.averageSqft)} sq ft`} /></div>
    </section>
    <section className="insight-panel insight-recent"><div className="insight-panel-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent sold homes</h2></div><span className="muted">Newest records first</span></div>
      <div className="insight-table-wrap" tabIndex="0" role="region" aria-label="Recent sold homes table. Scroll horizontally to view all columns."><table className="insight-table"><caption className="sr-only">Recent sold homes</caption><thead><tr><th scope="col">Address</th><th scope="col">City</th><th scope="col">Sold date</th><th scope="col">Price</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead><tbody>{(data.recentSales || []).map(sale => <tr key={sale.propertyId}><td>{sale.street || sale.title}</td><td>{sale.city || '—'}</td><td>{date(sale.soldDate)}</td><td>{sale.price ? money(sale.price) : 'Not recorded'}</td><td><Link href={`/properties/${sale.slug}`}>View home</Link></td></tr>)}</tbody></table></div>
    </section>
    <p className="insight-coverage">Data coverage: prices recorded for {data.coverage?.priced || 0} of {data.soldCount} sold homes; square footage for {data.coverage?.withSquareFootage || 0}; sold dates for {data.coverage?.withSoldDate || 0}. Metrics exclude unavailable fields.</p>
  </div>;
}
