'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { FiMaximize2 } from 'react-icons/fi';
import { buildMappableCities, groupTopCities } from '../lib/market-insights.mjs';

const money = value => value ? '$' + Math.round(value).toLocaleString('en-US') : 'Not recorded';
const number = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—';

function cityKey(city) {
  return String(city?.city || '').trim().toLocaleLowerCase();
}

function popupContent(city) {
  const wrapper = document.createElement('div');
  wrapper.className = 'closed-homes-popup';
  const label = document.createElement('span');
  label.textContent = 'City representation';
  const heading = document.createElement('h3');
  heading.textContent = city.city;
  const facts = document.createElement('dl');
  [['Homes sold', `${number(city.count)} homes`], ['Average price', money(city.averageSalePrice)], ['Map location', 'City location'], ['Mapped records', number(city.coordinateCount)]].forEach(([term, value]) => {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    row.append(dt, dd);
    facts.appendChild(row);
  });
  wrapper.append(label, heading, facts);
  return wrapper;
}

const donutColors = ['#2d74d1', '#34a566', '#c59b27', '#7b7de8', '#e27d45', '#4aa9b8', '#8a6db5', '#6d879e', '#b7a36b'];

function CityDonut({ items, onSelect, activeKey }) {
  const total = items.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
  if (!total) return <p className="market-empty-note">No city records are available.</p>;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;
  const segments = items.map((item, index) => {
    const count = Number(item.count) || 0;
    const length = count / total * circumference;
    const segment = { ...item, color: donutColors[index % donutColors.length], length, offset: cumulative };
    cumulative += length;
    return segment;
  });

  return <div className="closed-homes-city-chart">
    <div className="closed-homes-donut-wrap">
      <svg className="closed-homes-donut" viewBox="0 0 200 200" role="img" aria-labelledby="closed-homes-donut-title closed-homes-donut-description">
        <title id="closed-homes-donut-title">Sold homes by city</title>
        <desc id="closed-homes-donut-description">A donut chart showing the distribution of sold homes across the eight leading cities and an Others group.</desc>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#edf1f5" strokeWidth="28" />
        {segments.map(segment => <circle key={segment.city} cx="100" cy="100" r={radius} fill="none" stroke={segment.color} strokeWidth="28" strokeDasharray={`${segment.length} ${circumference - segment.length}`} strokeDashoffset={-segment.offset} transform="rotate(-90 100 100)" />)}
        <text x="100" y="96" textAnchor="middle" className="closed-homes-donut-total">{total}</text>
        <text x="100" y="114" textAnchor="middle" className="closed-homes-donut-label">homes sold</text>
      </svg>
    </div>
    <div className="closed-homes-donut-legend">
      {segments.map(segment => {
        const key = String(segment.city).toLocaleLowerCase();
        const mapped = segment.coordinateCount || segment.approximate;
        return <button key={segment.city} type="button" className={activeKey === key ? 'active' : ''} onClick={() => onSelect(segment)} disabled={!mapped}>
          <span><i style={{ background: segment.color }} />{segment.city}</span>
          <strong>{segment.count} <small>{Math.round(segment.count / total * 100)}%</small></strong>
        </button>;
      })}
    </div>
    <details className="market-chart-data closed-homes-city-data">
      <summary>View city data</summary>
      <div className="market-table-scroll">
        <table className="market-table">
          <caption className="sr-only">Sold homes by city</caption>
          <thead><tr><th scope="col">City</th><th scope="col">Homes sold</th><th scope="col">Share</th></tr></thead>
          <tbody>{segments.map(segment => <tr key={`table-${segment.city}`}><td>{segment.city}</td><td>{segment.count}</td><td>{Math.round(segment.count / total * 100)}%</td></tr>)}</tbody>
        </table>
      </div>
    </details>
  </div>;
}

export default function ClosedHomesMap({ cities = [], points = [] }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const boundsRef = useRef(null);
  const [activeKey, setActiveKey] = useState('');
  const cityItems = useMemo(() => groupTopCities(cities), [cities]);
  const visibleCities = useMemo(() => cityItems.filter(city => city.city !== 'Others'), [cityItems]);
  const cityHubs = useMemo(() => buildMappableCities(visibleCities, points), [visibleCities, points]);
  const mappedCities = useMemo(() => cityHubs.filter(city => city.coordinateCount), [cityHubs]);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return undefined;

    const map = L.map(elementRef.current, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    mapRef.current = map;
    const fallbackView = [37.55, -121.95];
    map.setView(fallbackView, 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    if (mappedCities.length) {
      const maximum = Math.max(...mappedCities.map(city => Number(city.count) || 0), 1);
      const bounds = [];
      mappedCities.forEach(city => {
        const key = cityKey(city);
        const radius = 8 + Math.round((Number(city.count) || 0) / maximum * 10);
        const marker = L.circleMarker([city.latitude, city.longitude], {
          radius,
          color: '#ffffff',
          weight: 2,
          fillColor: '#c59b27',
          fillOpacity: .96,
          className: 'closed-homes-marker',
        }).addTo(map).bindPopup(popupContent(city), { closeButton: true, maxWidth: 240 });
        marker.bindTooltip(`${city.city}: ${number(city.count)} homes`, {
          direction: 'top',
          offset: [0, -radius],
          permanent: true,
          className: 'closed-homes-tooltip closed-homes-city-label',
        });
        marker.on('click', () => setActiveKey(key));
        markersRef.current.set(key, marker);
        bounds.push([city.latitude, city.longitude]);
      });
      boundsRef.current = L.latLngBounds(bounds).pad(.22);
      map.fitBounds(boundsRef.current, { padding: [28, 28] });
    }

    return () => {
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [mappedCities]);

  function selectCity(city) {
    if (!city.coordinateCount && !city.approximate) return;
    const key = cityKey(city);
    const marker = markersRef.current.get(key);
    if (!marker || !mapRef.current) return;
    setActiveKey(key);
    mapRef.current.flyTo([city.latitude, city.longitude], 11, { animate: true, duration: .7 });
    marker.openPopup();
  }

  function resetMap() {
    setActiveKey('');
    if (mapRef.current && boundsRef.current) {
      mapRef.current.fitBounds(boundsRef.current, { padding: [28, 28], animate: true });
      mapRef.current.closePopup();
    }
  }

  const totalHomes = cityHubs.reduce((sum, city) => sum + (Number(city.count) || 0), 0);
  const topMarket = cityHubs[0];

  return <section className="market-panel closed-homes-map-panel" aria-label="Closed homes by city map">
    <div className="closed-homes-map-heading">
      <div>
        <p>Local representation</p>
        <h2>Closed homes by city</h2>
        <span>Explore cities represented in Gurmeet&apos;s sold portfolio.</span>
      </div>
      <div className="closed-homes-map-badges">
        <span><b>Top market</b><strong>{topMarket?.city || 'Not recorded'}</strong></span>
        <span><b>Total closings</b><strong>{number(totalHomes)}</strong></span>
      </div>
    </div>
    <div className="closed-homes-map-shell">
      <section className="closed-homes-leaflet-wrap" aria-label="Interactive map of sold portfolio city hubs">
        <button className="closed-homes-map-reset" type="button" onClick={resetMap} aria-label="Reset map view" title="Reset map view"><FiMaximize2 aria-hidden="true" /></button>
        <div ref={elementRef} className="closed-homes-leaflet" />
        <div className="closed-homes-map-legend"><b>Representation</b><span><i /> City hub</span><small>Marker size reflects homes sold</small></div>
      </section>
      <section className="closed-homes-city-list closed-homes-donut-panel" aria-label="Sold homes by city chart">
        <div>
          <p className="closed-homes-donut-eyebrow">City distribution</p>
          <h3>Sold homes by city</h3>
          <span>Top eight cities, with remaining cities grouped as Others.</span>
        </div>
        <CityDonut items={cityItems.map(item => cityHubs.find(city => cityKey(city) === cityKey(item)) || item)} onSelect={selectCity} activeKey={activeKey} />
        <p className="closed-homes-map-footnote">Markers use stored property coordinates when available. City-center locations are for portfolio orientation only.</p>
      </section>
    </div>
  </section>;
}
