'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { FiDollarSign, FiHome, FiMapPin, FiMaximize2, FiTag } from 'react-icons/fi';
import {
  buildPortfolioScope,
  buildPrimaryMetrics,
  buildYearChartData,
  groupTopCities,
  projectCaliforniaMapPoints,
} from '../lib/market-insights.mjs';
import { propertyPrimaryImagePath } from '../lib/property-images.mjs';
import { publicAssetUrl } from '../lib/api';

const ClosedHomesMap = dynamic(() => import('./ClosedHomesMap'), {
  ssr: false,
  loading: () => <section className="market-panel closed-homes-map-loading">Loading portfolio map…</section>,
});

const money = value => value ? '$' + Math.round(value).toLocaleString('en-US') : 'Not recorded';
const compactMoney = value => value ? '$' + (value >= 1000000 ? (value / 1000000).toFixed(value % 1000000 ? 1 : 0) + 'M' : Math.round(value / 1000) + 'K') : '—';
const number = value => value ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'Not recorded';
const count = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '—';
const squareFeet = value => value ? number(value) + ' sq ft' : 'Not recorded';
const date = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
const shortLabel = value => String(value).length > 19 ? String(value).slice(0, 17) + '…' : value;

function MetricCard({ icon: Icon, tone, label, value, detail }) {
  return <article className="market-metric-card">
    <span className={'market-metric-icon ' + tone} aria-hidden="true"><Icon /></span>
    <div>
      <span className="market-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  </article>;
}

function PanelTitle({ eyebrow, title, children }) {
  return <header className="market-panel-title">
    {eyebrow && <p>{eyebrow}</p>}
    <h2>{title}</h2>
    {children}
  </header>;
}

function ChartTable({ caption, headers, rows }) {
  return <details className="market-chart-data">
    <summary>View chart data</summary>
    <div className="market-table-scroll">
      <table className="market-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={caption + rowIndex}>{row.map((cell, cellIndex) => <td key={caption + rowIndex + cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </details>;
}

function YearTrend({ items }) {
  const chart = buildYearChartData(items, 720, 282);
  const chartId = 'portfolio-sales-trend';
  const gridLines = [0, .25, .5, .75, 1];
  const linePoints = chart.points.map(point => point.x + ',' + point.lineY).join(' ');

  return <section className="market-panel market-trend-panel">
    <PanelTitle eyebrow="Portfolio trend" title="Annual sales performance">
      <div className="market-legend" aria-label="Chart legend"><span><i className="bar" />Homes sold</span><span><i className="line" />Average price</span></div>
    </PanelTitle>
    {chart.points.length ? <>
      <div className="market-chart-wrap">
        <svg className="market-year-chart" viewBox={'0 0 ' + chart.width + ' ' + chart.height} role="img" aria-labelledby={chartId}>
          <title id={chartId}>Annual sold homes and average sale price</title>
          <desc>Blue bars represent homes sold. The green line represents average sale price.</desc>
          {gridLines.map(ratio => {
            const y = chart.padding.top + chart.chartHeight * (1 - ratio);
            return <g key={ratio}>
              <line className="market-gridline" x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={y} y2={y} />
              <text className="market-axis-label" x={chart.padding.left - 9} y={y + 4} textAnchor="end">{Math.round(chart.maxCount * ratio)}</text>
              <text className="market-axis-label market-axis-price" x={chart.width - chart.padding.right + 9} y={y + 4}>{compactMoney(chart.maxAveragePrice * ratio)}</text>
            </g>;
          })}
          {chart.points.map(point => <g key={point.year}>
            <rect className="market-year-bar" x={point.barX} y={point.barY} width={point.barWidth} height={point.barHeight} rx="3"><title>{`${point.year}: ${point.count} sold homes`}</title></rect>
            <text className="market-year-label" x={point.x} y={chart.height - 15} textAnchor="middle">{point.year}</text>
          </g>)}
          <polyline className="market-price-line" points={linePoints} />
          {chart.points.map(point => <circle className="market-price-dot" key={'dot-' + point.year} cx={point.x} cy={point.lineY} r="3.7"><title>{`${point.year}: ${money(point.averageSalePrice)} average sale price`}</title></circle>)}
        </svg>
      </div>
      <ChartTable caption="Annual sales performance" headers={['Year', 'Homes sold', 'Average sale price']} rows={chart.points.map(point => [point.year, point.count, money(point.averageSalePrice)])} />
    </> : <p className="market-empty-note">No recorded transaction dates are available for the annual trend.</p>}
  </section>;
}

function BarPanel({ eyebrow, title, copy, items, labelKey, valueKey, valueLabel, tone = 'blue' }) {
  const maximum = Math.max(...items.map(item => Number(item[valueKey]) || 0), 1);
  return <section className="market-panel market-bar-panel">
    <PanelTitle eyebrow={eyebrow} title={title}><p className="market-panel-copy">{copy}</p></PanelTitle>
    {items.length ? <>
      <ol className="market-bar-list">
        {items.map(item => {
          const value = Number(item[valueKey]) || 0;
          return <li key={String(item[labelKey])}>
            <div><span>{shortLabel(item[labelKey])}</span><strong>{valueLabel(value)}</strong></div>
            <i className="market-bar-track"><b className={tone} style={{ width: `${value / maximum * 100}%` }} /></i>
          </li>;
        })}
      </ol>
      <ChartTable caption={title} headers={['Category', 'Value']} rows={items.map(item => [item[labelKey], valueLabel(item[valueKey])])} />
    </> : <p className="market-empty-note">No records are available for this view.</p>}
  </section>;
}

function Snapshot({ data, scope, mapPointCount, approximateMapPointCount }) {
  return <section className="market-panel market-snapshot-panel">
    <PanelTitle eyebrow="Portfolio snapshot" title="Data at a glance" />
    <dl className="market-snapshot-list">
      <div><dt>Priced sales</dt><dd>{count(scope.pricedHomes)} <span>of {count(data.soldCount)}</span></dd></div>
      <div><dt>Recorded sale dates</dt><dd>{count(scope.datedHomes)} <span>of {count(data.soldCount)}</span></dd></div>
      <div><dt>Cities represented</dt><dd>{count(scope.cityCount)}</dd></div>
      <div><dt>Map locations</dt><dd>{count(mapPointCount)}</dd></div>
      {approximateMapPointCount > 0 && <div><dt>Approximate city-center locations</dt><dd>{count(approximateMapPointCount)}</dd></div>}
    </dl>
    <p>Insights reflect only the completed portfolio records and fields currently available.</p>
  </section>;
}

function RecentSales({ sales }) {
  return <section className="market-panel market-recent-panel">
    <PanelTitle eyebrow="Recent properties" title="Latest completed transactions" />
    {sales.length ? <div className="market-recent-scroll" tabIndex="0" role="region" aria-label="Recent sold homes. Scroll horizontally to view all columns.">
      <table className="market-table market-recent-table">
        <caption className="sr-only">Recent completed portfolio transactions</caption>
        <thead><tr><th scope="col">Property</th><th scope="col">Location</th><th scope="col">Sold date</th><th scope="col">Sale price</th><th scope="col"><span className="sr-only">View property</span></th></tr></thead>
        <tbody>{sales.map(sale => {
          const image = publicAssetUrl(propertyPrimaryImagePath({ images: sale.image ? [sale.image] : [] }));
          return <tr key={sale.propertyId}>
            <td><span className="market-property-cell"><img src={image} alt="" /><span>{sale.street || sale.title}</span></span></td>
            <td>{sale.city || '—'}</td>
            <td>{date(sale.soldDate)}</td>
            <td>{money(sale.price)}</td>
            <td><Link href={'/properties/' + sale.slug}>View <span aria-hidden="true">↗</span></Link></td>
          </tr>;
        })}</tbody>
      </table>
    </div> : <p className="market-empty-note">No completed sales are available yet.</p>}
  </section>;
}

function EmptyInsights() {
  return <main className="market-dashboard-page"><div className="container"><section className="market-empty-state"><p>Portfolio intelligence</p><h1>Portfolio Market Analysis</h1><span>Once completed sales are available, this dashboard will summarize Gurmeet&apos;s sold portfolio.</span></section></div></main>;
}

export default function MarketInsights({ data }) {
  if (!data || !data.soldCount) return <EmptyInsights />;

  const metrics = buildPrimaryMetrics(data);
  const scope = buildPortfolioScope(data);
  const cityItems = groupTopCities(data.byCity || []);
  const mapPoints = projectCaliforniaMapPoints(data.mapPoints || []);
  const approximateMapPointCount = mapPoints.filter(point => point.approximate).length;
  const storedMapPointCount = mapPoints.length - approximateMapPointCount;

  return <main className="market-dashboard-page">
    <section className="market-dashboard-header">
      <div className="container">
        <div>
          <p className="market-kicker"><FiMapPin aria-hidden="true" /> California portfolio</p>
          <h1>Portfolio Market Analysis</h1>
          <span>Verified insights from homes bought and sold with Gurmeet.</span>
        </div>
        <p className="market-dashboard-date">All recorded completed transactions<br /><small>Coverage updates as portfolio fields are added</small></p>
      </div>
    </section>
    <div className="container market-dashboard-content">
      <section className="market-kpi-grid" aria-label="Portfolio key performance indicators">
        <MetricCard icon={FiHome} tone="blue" label="Median sale price" value={money(metrics.medianSalePrice)} detail="Across priced portfolio sales" />
        <MetricCard icon={FiTag} tone="green" label="Average price / sq ft" value={money(metrics.averagePricePerSqft)} detail="Homes with price and size data" />
        <MetricCard icon={FiMapPin} tone="purple" label="Homes sold" value={count(data.soldCount)} detail="Completed portfolio transactions" />
        <MetricCard icon={FiDollarSign} tone="teal" label="Total sales volume" value={money(metrics.totalSalesVolume)} detail={count(scope.pricedHomes) + ' recorded sale prices'} />
        <MetricCard icon={FiMaximize2} tone="gold" label="Average home size" value={squareFeet(data.averageSqft)} detail="Homes with square footage" />
      </section>
      <section className="market-dashboard-grid">
        <ClosedHomesMap cities={data.byCity || []} points={data.mapPoints || []} />
        <YearTrend items={data.byYear || []} />
        <Snapshot data={data} scope={scope} mapPointCount={mapPoints.length} approximateMapPointCount={approximateMapPointCount} />
        <BarPanel eyebrow="Location mix" title="Sold homes by city" copy="Top eight cities, with remaining cities grouped as Others." items={cityItems} labelKey="city" valueKey="count" valueLabel={value => number(value) + ' homes'} />
        <BarPanel eyebrow="Price distribution" title="Sales by price band" copy="Recorded sale prices in the completed portfolio." items={data.priceBands || []} labelKey="label" valueKey="count" valueLabel={value => number(value) + ' homes'} tone="green" />
        <section className="market-panel market-profile-panel">
          <PanelTitle eyebrow="Property profile" title="Portfolio home characteristics" />
          <div className="market-profile-stats">
            <div><span>Average beds</span><strong>{number(data.averageBeds)}</strong></div>
            <div><span>Average baths</span><strong>{number(data.averageBaths)}</strong></div>
            <div><span>Average size</span><strong>{squareFeet(data.averageSqft)}</strong></div>
          </div>
          <p>Calculated only from records where the corresponding property detail is available.</p>
        </section>
      </section>
      <RecentSales sales={data.recentSales || []} />
      <p className="market-coverage-note">Data coverage: prices are recorded for {count(data.coverage?.priced)} of {count(data.soldCount)} sold homes; square footage for {count(data.coverage?.withSquareFootage)}; transaction dates for {count(data.coverage?.withSoldDate)}; stored California coordinates for {count(storedMapPointCount)} and approximate city-center locations for {count(approximateMapPointCount)}. Unavailable fields are excluded from their metrics.</p>
      <section className="market-dashboard-cta">
        <div><p>Private advisory</p><h2>Need a clearer view of your local market?</h2><span>Talk directly with Gurmeet about your home, your target neighborhood, or your next move.</span></div>
        <div><Link className="btn" href="/home-valuation">Request a valuation</Link><Link href="/contact">Connect with Gurmeet <span aria-hidden="true">→</span></Link></div>
      </section>
    </div>
  </main>;
}
