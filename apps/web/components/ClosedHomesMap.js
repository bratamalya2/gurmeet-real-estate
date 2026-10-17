'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { FiMaximize2, FiSearch } from 'react-icons/fi';
import { buildMappableCities } from '../lib/market-insights.mjs';

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
  [['Homes sold', `${number(city.count)} homes`], ['Average price', money(city.averageSalePrice)], ['Mapped records', number(city.coordinateCount)]].forEach(([term, value]) => {
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

export default function ClosedHomesMap({ cities = [], points = [] }) {
  const elementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const boundsRef = useRef(null);
  const [search, setSearch] = useState('');
  const [activeKey, setActiveKey] = useState('');
  const cityHubs = useMemo(() => buildMappableCities(cities, points), [cities, points]);
  const mappedCities = useMemo(() => cityHubs.filter(city => city.coordinateCount), [cityHubs]);
  const filteredCities = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? cityHubs.filter(city => cityKey(city).includes(query)) : cityHubs;
  }, [cityHubs, search]);

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
    if (!city.coordinateCount) return;
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
      <section className="closed-homes-city-list" aria-label="City representation list">
        <div className="closed-homes-map-controls">
          <label>
            <span className="sr-only">Filter cities</span>
            <FiSearch aria-hidden="true" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter by city name…" />
          </label>
          <button type="button" onClick={resetMap} aria-label="Reset map view" title="Reset map view"><FiMaximize2 aria-hidden="true" /></button>
        </div>
        <div className="closed-homes-list-labels"><span>Rank &amp; city</span><span>Volume</span></div>
        <ol>
          {filteredCities.map((city, index) => {
            const key = cityKey(city);
            const active = key === activeKey;
            const maximum = Math.max(...cityHubs.map(item => Number(item.count) || 0), 1);
            const percentage = (Number(city.count) || 0) / maximum * 100;
            return <li key={key}>
              <button type="button" onClick={() => selectCity(city)} disabled={!city.coordinateCount} className={active ? 'active' : ''}>
                <span className="closed-homes-city-row"><i>{String(index + 1).padStart(2, '0')}</i><strong>{city.city}</strong>{!city.coordinateCount && <em>Not mapped</em>}</span>
                <span className="closed-homes-city-volume">{number(city.count)} <small>homes</small></span>
                <span className="closed-homes-city-bar"><b style={{ width: `${percentage}%` }} /></span>
              </button>
            </li>;
          })}
          {!filteredCities.length && <li className="closed-homes-no-results">No cities match “{search}”.</li>}
        </ol>
        <p className="closed-homes-map-footnote">Map points use only stored property coordinates. Cities without coordinates remain in the portfolio totals.</p>
      </section>
      <section className="closed-homes-leaflet-wrap" aria-label="Interactive map of sold portfolio city hubs">
        <div ref={elementRef} className="closed-homes-leaflet" />
        <div className="closed-homes-map-legend"><b>Representation</b><span><i /> City hub</span><small>Marker size reflects homes sold</small></div>
      </section>
    </div>
  </section>;
}
