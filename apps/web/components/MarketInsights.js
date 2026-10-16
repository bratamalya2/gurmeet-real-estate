import Link from 'next/link';
import {
  buildPrimaryMetrics,
  buildYearChartData,
  groupTopCities,
} from '../lib/market-insights.mjs';

const money = value => value ? '$' + Math.round(value).toLocaleString('en-US') : 'Not recorded';
const number = value => value ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'Not recorded';
const squareFeet = value => value ? number(value) + ' sq ft' : 'Not recorded';
const date = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
const chartLabel = value => String(value).length > 20 ? String(value).slice(0, 18) + '…' : value;
const currencyAxis = value => '$' + Math.round(value / 1000).toLocaleString('en-US') + 'k';

function Metric({ label, value, detail }) {
  return <article className="insight-metric">
    <span className="insight-metric-label">{label}</span>
    <strong>{value}</strong>
    <small>{detail}</small>
  </article>;
}

function ChartTable({ caption, headers, rows }) {
  return <details className="insight-chart-data">
    <summary>View chart data</summary>
    <div className="insight-chart-table">
      <table className="insight-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={caption + '-' + rowIndex}>{row.map((cell, cellIndex) => <td key={caption + '-' + rowIndex + '-' + cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}

function SectionTitle({ eyebrow, title, copy }) {
  return <div className="insight-section-title">
    <p className="eyebrow">{eyebrow}</p>
    <h2>{title}</h2>
    {copy && <p>{copy}</p>}
  </div>;
}

function YearChart({ items }) {
  const chart = buildYearChartData(items);
  const chartId = 'portfolio-year-chart';
  const linePoints = chart.points.map(point => point.x + ',' + point.lineY).join(' ');
  const gridLines = [0, .25, .5, .75, 1];

  return <section className="insight-panel insight-year-panel">
    <div className="insight-panel-heading">
      <SectionTitle eyebrow="Portfolio activity" title="Closed homes by year" copy="Transaction count and recorded average sale price." />
      <div className="insight-legend" aria-label="Chart legend">
        <span><i className="legend-swatch count" />Closed homes</span>
        <span><i className="legend-swatch price" />Average sale price</span>
      </div>
    </div>
    {chart.points.length ? <>
      <div className="insight-chart-wrap">
        <svg className="insight-chart insight-year-chart" viewBox={'0 0 ' + chart.width + ' ' + chart.height} role="img" aria-labelledby={chartId}>
          <title id={chartId}>Closed homes and average sale price by year</title>
          <desc>Gold bars represent the number of homes sold. A blue line represents average sale price.</desc>
          {gridLines.map(ratio => {
            const y = chart.padding.top + chart.chartHeight * (1 - ratio);
            return <g key={ratio}>
              <line className="chart-grid-line" x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={y} y2={y} />
              <text className="chart-axis-label" x={chart.padding.left - 10} y={y + 4} textAnchor="end">{Math.round(chart.maxCount * ratio)}</text>
              <text className="chart-axis-label chart-price-axis" x={chart.width - chart.padding.right + 10} y={y + 4}>{currencyAxis(chart.maxAveragePrice * ratio)}</text>
            </g>;
          })}
          <line className="chart-axis" x1={chart.padding.left} x2={chart.padding.left} y1={chart.padding.top} y2={chart.padding.top + chart.chartHeight} />
          <line className="chart-axis" x1={chart.width - chart.padding.right} x2={chart.width - chart.padding.right} y1={chart.padding.top} y2={chart.padding.top + chart.chartHeight} />
          {chart.points.map(point => <g key={point.year}>
            <rect className="chart-bar" x={point.barX} y={point.barY} width={point.barWidth} height={point.barHeight} rx="3">
              <title>{String(point.year) + ': ' + point.count + ' homes sold'}</title>
            </rect>
            <text className="chart-x-label" x={point.x} y={chart.height - 15} textAnchor="middle">{point.year}</text>
          </g>)}
          <polyline className="chart-line" points={linePoints} />
          {chart.points.map(point => <circle className="chart-point" key={'point-' + point.year} cx={point.x} cy={point.lineY} r="4">
            <title>{String(point.year) + ': ' + money(point.averageSalePrice) + ' average sale price'}</title>
          </circle>)}
        </svg>
      </div>
      <ChartTable caption="Closed homes by year" headers={['Year', 'Closed homes', 'Average sale price']} rows={chart.points.map(point => [point.year, point.count, money(point.averageSalePrice)])} />
    </> : <p className="muted insight-chart-empty">No dated sales are available for the annual view.</p>}
  </section>;
}

function HorizontalBarChart({ eyebrow, title, copy, items, labelKey, valueKey, valueLabel }) {
  const values = items.map(item => Number(item[valueKey]) || 0);
  const maximum = Math.max(...values, 1);
  const width = 760;
  const rowHeight = 44;
  const labelWidth = 158;
  const height = Math.max(items.length * rowHeight + 12, 72);
  const chartId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-chart';
  return <section className="insight-panel insight-chart-panel">
    <SectionTitle eyebrow={eyebrow} title={title} copy={copy} />
    {items.length ? <>
      <div className="insight-chart-wrap">
        <svg className="insight-chart insight-bars-chart" viewBox={'0 0 ' + width + ' ' + height} role="img" aria-labelledby={chartId}>
          <title id={chartId}>{title}</title>
          <desc>Horizontal bars compare the recorded values by category.</desc>
          {items.map((item, index) => {
            const value = Number(item[valueKey]) || 0;
            const y = index * rowHeight + 9;
            const barWidth = Math.max(value / maximum * (width - labelWidth - 84), value ? 3 : 0);
            return <g key={String(item[labelKey])}>
              <text className="chart-category-label" x="0" y={y + 17}>{chartLabel(item[labelKey])}</text>
              <rect className="chart-horizontal-track" x={labelWidth} y={y} width={width - labelWidth - 84} height="22" rx="11" />
              <rect className="chart-horizontal-bar" x={labelWidth} y={y} width={barWidth} height="22" rx="11">
                <title>{String(item[labelKey]) + ': ' + valueLabel(value)}</title>
              </rect>
              <text className="chart-value-label" x={labelWidth + barWidth + 10} y={y + 17}>{valueLabel(value)}</text>
            </g>;
          })}
        </svg>
      </div>
      <ChartTable caption={title} headers={['Category', 'Recorded sales']} rows={items.map(item => [item[labelKey], valueLabel(item[valueKey])])} />
    </> : <p className="muted insight-chart-empty">No records are available for this view.</p>}
  </section>;
}

function PortfolioBrief({ data }) {
  return <section className="insight-brief">
    <div className="insight-brief-copy">
      <p className="eyebrow">Portfolio market brief</p>
      <h2>Built from completed client transactions.</h2>
      <p>These insights summarize properties sold with Gurmeet. They are a transparent portfolio view, not a prediction of the broader market.</p>
    </div>
    <div className="insight-brief-facts">
      <div><strong>{number(data.soldCount)}</strong><span>Sold homes</span></div>
      <div><strong>{squareFeet(data.averageSqft)}</strong><span>Average home size</span></div>
      <div><strong>{number(data.coverage?.withSoldDate)}</strong><span>Recorded sold dates</span></div>
    </div>
    <div className="insight-brief-actions">
      <Link className="btn" href="/home-valuation">Request a home valuation</Link>
      <Link className="insight-text-link" href="/contact">Speak with Gurmeet →</Link>
    </div>
  </section>;
}

function EmptyInsights() {
  return <section className="insight-empty">
    <p className="eyebrow">Portfolio intelligence</p>
    <h1>Market &amp; Portfolio Insights</h1>
    <p>Once completed sales are available, this page will summarize the pricing, size, and location patterns in Gurmeet&apos;s portfolio.</p>
  </section>;
}

export default function MarketInsights({ data }) {
  if (!data || !data.soldCount) return <main className="insights-page"><div className="container"><EmptyInsights /></div></main>;

  const metrics = buildPrimaryMetrics(data);
  const cityItems = groupTopCities(data.byCity || []);
  const priceBands = data.priceBands || [];

  return <main className="insights-page">
    <section className="insight-intro">
      <div className="container">
        <p className="eyebrow">Exclusive portfolio research</p>
        <h1>Market &amp; Portfolio Insights</h1>
        <p>Explore the pricing, scale, and local patterns behind homes sold with Gurmeet. Every metric is calculated from completed portfolio records.</p>
        <span className="insight-source-note">Based on {number(data.soldCount)} sold homes with recorded portfolio data.</span>
      </div>
    </section>
    <div className="container insights-dashboard">
      <section className="insight-kpis" aria-label="Portfolio pricing metrics">
        <Metric label="Median sale price" value={money(metrics.medianSalePrice)} detail="Recorded-price midpoint" />
        <Metric label="Average sale price" value={money(metrics.averageSalePrice)} detail="Across priced sales" />
        <Metric label="Average price / sq ft" value={money(metrics.averagePricePerSqft)} detail="Priced homes with size data" />
        <Metric label="Total sales volume" value={money(metrics.totalSalesVolume)} detail={number(data.coverage?.priced) + ' priced transactions'} />
      </section>
      <PortfolioBrief data={data} />
      <YearChart items={data.byYear || []} />
      <section className="insight-section-intro">
        <SectionTitle eyebrow="Portfolio composition" title="Where the record is strongest" copy="Location and pricing patterns across Gurmeet&apos;s completed transactions." />
      </section>
      <div className="insight-grid insight-grid-two">
        <HorizontalBarChart eyebrow="Local representation" title="Closed homes by city" copy="The eight most represented cities, with remaining locations grouped as Others." items={cityItems} labelKey="city" valueKey="count" valueLabel={value => number(value)} />
        <HorizontalBarChart eyebrow="Sale prices" title="Closed sales by price band" copy="Distribution of recorded sale prices in the portfolio." items={priceBands} labelKey="label" valueKey="count" valueLabel={value => number(value)} />
      </div>
      <section className="insight-profile">
        <SectionTitle eyebrow="Property profile" title="The homes in this portfolio" copy="A high-level view of the properties represented in completed transactions." />
        <div className="insight-profile-stats">
          <Metric label="Average bedrooms" value={number(data.averageBeds)} detail="Recorded home details" />
          <Metric label="Average bathrooms" value={number(data.averageBaths)} detail="Recorded home details" />
          <Metric label="Average home size" value={squareFeet(data.averageSqft)} detail="Homes with size data" />
        </div>
      </section>
      <section className="insight-panel insight-recent">
        <div className="insight-panel-heading">
          <SectionTitle eyebrow="Latest activity" title="Recent sold homes" copy="Newest completed transactions in the portfolio record." />
          <span className="insight-table-count">{number((data.recentSales || []).length)} records</span>
        </div>
        <div className="insight-table-wrap" tabIndex="0" role="region" aria-label="Recent sold homes table. Scroll horizontally to view all columns.">
          <table className="insight-table">
            <caption className="sr-only">Recent sold homes</caption>
            <thead><tr><th scope="col">Address</th><th scope="col">City</th><th scope="col">Sold date</th><th scope="col">Price</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
            <tbody>{(data.recentSales || []).map(sale => <tr key={sale.propertyId}>
              <td>{sale.street || sale.title}</td>
              <td>{sale.city || '—'}</td>
              <td>{date(sale.soldDate)}</td>
              <td>{money(sale.price)}</td>
              <td><Link href={'/properties/' + sale.slug}>View home</Link></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      <p className="insight-coverage">Data coverage: prices are recorded for {number(data.coverage?.priced)} of {number(data.soldCount)} sold homes; square footage for {number(data.coverage?.withSquareFootage)}; and sold dates for {number(data.coverage?.withSoldDate)}. Metrics exclude unavailable fields.</p>
      <section className="insight-advisory">
        <div>
          <p className="eyebrow">Confidential advisory</p>
          <h2>Want context for your neighborhood?</h2>
          <p>Discuss your property, a target area, or your next move directly with Gurmeet.</p>
        </div>
        <div className="insight-advisory-actions">
          <Link className="btn" href="/contact">Connect with Gurmeet</Link>
          <Link className="insight-text-link" href="/home-valuation">Get a home valuation →</Link>
        </div>
      </section>
    </div>
  </main>;
}
