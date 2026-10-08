import Link from 'next/link';
import { buildYearChartData, groupTopCities } from '../lib/market-insights.mjs';

const money = value => value ? `$${Math.round(value).toLocaleString()}` : '$0';
const number = value => value ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0';
const date = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
const chartLabel = value => String(value).length > 22 ? `${String(value).slice(0, 20)}…` : value;

function Metric({ label, value, detail }) {
  return <div className="insight-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

function ChartTable({ caption, headers, rows }) {
  return <div className="insight-chart-table"><table className="insight-table"><caption className="sr-only">{caption}</caption><thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${caption}-${index}`}>{row.map((cell, cellIndex) => <td key={`${caption}-${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function YearChart({ items }) {
  const chart = buildYearChartData(items);
  const chartId = 'sold-year-chart-title';
  const linePoints = chart.points.map(point => `${point.x},${point.lineY}`).join(' ');
  const gridLines = [0, .25, .5, .75, 1];
  return <section className="insight-panel insight-chart-panel insight-year-panel">
    <div className="insight-panel-heading"><div><p className="eyebrow">Annual activity</p><h2 id={chartId}>Sold homes by year</h2></div><div className="insight-legend" aria-label="Chart legend"><span><i className="legend-swatch count" />Sold homes</span><span><i className="legend-swatch price" />Average sale price</span></div></div>
    {chart.points.length ? <>
      <div className="insight-chart-wrap">
        <svg className="insight-chart insight-year-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-labelledby={chartId}>
          <desc>Bars show the number of sold homes. The line shows average sale price by year.</desc>
          {gridLines.map(ratio => {
            const y = chart.padding.top + chart.chartHeight * (1 - ratio);
            return <g key={ratio}><line className="chart-grid-line" x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={y} y2={y} /><text className="chart-axis-label" x={chart.padding.left - 10} y={y + 4} textAnchor="end">{Math.round(chart.maxCount * ratio)}</text><text className="chart-axis-label chart-price-axis" x={chart.width - chart.padding.right + 10} y={y + 4}>${Math.round(chart.maxAveragePrice * ratio / 1000)}k</text></g>;
          })}
          <line className="chart-axis" x1={chart.padding.left} x2={chart.padding.left} y1={chart.padding.top} y2={chart.padding.top + chart.chartHeight} />
          <line className="chart-axis" x1={chart.width - chart.padding.right} x2={chart.width - chart.padding.right} y1={chart.padding.top} y2={chart.padding.top + chart.chartHeight} />
          {chart.points.map(point => <g key={point.year}><rect className="chart-bar" x={point.barX} y={point.barY} width={point.barWidth} height={point.barHeight} rx="3"><title>{point.year}: {point.count} sold homes</title></rect><text className="chart-x-label" x={point.x} y={chart.height - 15} textAnchor="middle">{point.year}</text></g>)}
          <polyline className="chart-line" points={linePoints} />
          {chart.points.map(point => <circle className="chart-point" key={`point-${point.year}`} cx={point.x} cy={point.lineY} r="4"><title>{point.year}: {money(point.averageSalePrice)} average sale price</title></circle>)}
        </svg>
      </div>
      <ChartTable caption="Sold homes by year data" headers={['Year', 'Sold homes', 'Average sale price']} rows={chart.points.map(point => [point.year, point.count, money(point.averageSalePrice)])} />
    </> : <p className="muted insight-chart-empty">No yearly sold data available.</p>}
  </section>;
}

function HorizontalBarChart({ title, eyebrow, items, labelKey, valueKey, formatValue = number }) {
  const values = items.map(item => Number(item[valueKey]) || 0);
  const maximum = Math.max(...values, 1);
  const width = 760;
  const rowHeight = 42;
  const labelWidth = 150;
  const height = Math.max(items.length * rowHeight + 12, 72);
  return <section className="insight-panel insight-chart-panel">
    <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
    {items.length ? <>
      <div className="insight-chart-wrap"><svg className="insight-chart insight-bars-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} bar chart`}>
        {items.map((item, index) => {
          const value = Number(item[valueKey]) || 0;
          const y = index * rowHeight + 8;
          const barWidth = Math.max((value / maximum) * (width - labelWidth - 80), value ? 3 : 0);
          return <g key={String(item[labelKey])}><text className="chart-category-label" x="0" y={y + 17}>{chartLabel(item[labelKey])}</text><rect className="chart-horizontal-track" x={labelWidth} y={y} width={width - labelWidth - 80} height="22" rx="3" /><rect className="chart-horizontal-bar" x={labelWidth} y={y} width={barWidth} height="22" rx="3"><title>{item[labelKey]}: {formatValue(value)}</title></rect><text className="chart-value-label" x={labelWidth + barWidth + 10} y={y + 17}>{formatValue(value)}</text></g>;
        })}
      </svg></div>
      <ChartTable caption={`${title} data`} headers={['Category', 'Count']} rows={items.map(item => [item[labelKey], formatValue(item[valueKey])])} />
    </> : <p className="muted insight-chart-empty">No records available for this view.</p>}
  </section>;
}

function PriceBandPanel({ items }) {
  return <HorizontalBarChart title="Price-band distribution" eyebrow="Sale prices" items={items} labelKey="label" valueKey="count" />;
}

export default function MarketInsights({ data }) {
  if (!data || !data.soldCount) return <div className="insight-empty"><p className="eyebrow">Awaiting sold data</p><h2>Market insights will appear here soon.</h2><p>Once sold homes are added to the portfolio, this page will summarize the market patterns in that record.</p></div>;
  const cityItems = groupTopCities(data.byCity || []);

  return <div className="insights-dashboard">
    <div className="insight-kpis">
      <Metric label="Sold homes" value={number(data.soldCount)} />
      <Metric label="Total sales volume" value={money(data.totalSalesVolume)} />
      <Metric label="Average sale price" value={money(data.averageSalePrice)} />
      <Metric label="Median sale price" value={money(data.medianSalePrice)} />
      <Metric label="Average price / sq ft" value={money(data.averagePricePerSqft)} />
      <Metric label="Average home size" value={`${number(data.averageSqft)} sq ft`} />
    </div>
    <YearChart items={data.byYear || []} />
    <div className="insight-grid insight-grid-two">
      <HorizontalBarChart title="Sold homes by city" eyebrow="Where homes sold" items={cityItems} labelKey="city" valueKey="count" />
      <PriceBandPanel items={data.priceBands || []} />
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
