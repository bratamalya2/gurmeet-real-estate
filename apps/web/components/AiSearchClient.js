'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FiArrowRight, FiCheck, FiChevronDown, FiCpu, FiDatabase, FiExternalLink, FiHome, FiMapPin, FiPhone, FiRefreshCw, FiSend, FiSliders, FiStar, FiTrendingUp, FiUser } from 'react-icons/fi';
import { publicApiUrl, publicAssetUrl } from '../lib/api';
import { AI_SEARCH_LABEL, buildAiSearchRequest, providerLabel } from '../lib/ai-search.mjs';
import PropertyImage from './PropertyImage';

const agentPhone = process.env.NEXT_PUBLIC_AGENT_PHONE || '';
const agentEmail = process.env.NEXT_PUBLIC_AGENT_EMAIL || '';
const phoneHref = agentPhone ? `tel:${agentPhone.replace(/\D/g, '')}` : '/contact';
const modes = {
  database: { label: 'Website Search', description: 'Search the live Homes By Gurmeet property portfolio.' },
  assistant: { label: AI_SEARCH_LABEL, description: 'Ask for concise buying, selling, or valuation guidance.' },
};
const quickPrompts = {
  database: ['Homes in Fremont', '3 bedroom homes under $1.2M', 'Show sold homes in San Jose', 'Homes with images'],
  assistant: ['How does a home valuation work?', 'What should I prepare before buying?', 'How can Gurmeet help me sell?', 'Contact Gurmeet'],
};

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function actionName(value) {
  return value === 'home_valuation' ? 'valuation' : value;
}

function FormattedText({ text }) {
  return <div className="ai-search-formatted-text">{String(text || '').split('\n').map((line, index) => {
    const value = line.trim();
    if (!value) return <span className="ai-search-text-break" key={index} />;
    if (value.startsWith('### ')) return <h4 key={index}>{value.slice(4)}</h4>;
    if (value.startsWith('## ')) return <h3 key={index}>{value.slice(3)}</h3>;
    if (/^(?:[-*•])\s+/.test(value)) return <p className="ai-search-bullet" key={index}><i />{value.replace(/^(?:[-*•])\s+/, '')}</p>;
    return <p key={index}>{value}</p>;
  })}</div>;
}

function ProviderBadge({ provider }) {
  return <span className="ai-search-provider"><FiCheck aria-hidden="true" /> {providerLabel(provider)}</span>;
}

function PropertyResults({ properties = [] }) {
  if (!properties.length) return null;
  return <div className="ai-search-results">
    <div className="ai-search-results-heading"><p className="ai-search-results-label">Matching properties ({properties.length})</p><Link href="/property-catalogue" className="ai-search-browse-link">Browse full catalogue <FiArrowRight aria-hidden="true" /></Link></div>
    <div className="ai-search-property-grid">{properties.map(property => <article className="ai-search-property-card" key={property.id || property.slug}>
      <PropertyImage src={publicAssetUrl(property.image)} alt={property.title} />
      <div className="ai-search-property-body">
        <div className="ai-search-property-heading"><h3>{property.title}</h3><strong>{property.price ? `$${property.price.toLocaleString()}` : 'Price on request'}</strong></div>
        <p><FiMapPin aria-hidden="true" /> {property.city || 'California portfolio'}{property.status ? ` · ${property.status}` : ''}</p>
        <small>{[property.beds && `${property.beds} beds`, property.baths && `${property.baths} baths`, property.sqft && `${property.sqft.toLocaleString()} sq ft`].filter(Boolean).join(' · ') || 'Details available on the property page'}</small>
        <Link href={`/properties/${property.slug}`} className="ai-search-property-link">View property <FiExternalLink aria-hidden="true" /></Link>
      </div>
    </article>)}</div>
  </div>;
}

function ActionCard({ action }) {
  if (!action) return null;
  const valuation = action === 'valuation';
  return <section className="ai-search-action-card">
    <div className="ai-search-action-icon">{valuation ? <FiTrendingUp aria-hidden="true" /> : <FiPhone aria-hidden="true" />}</div>
    <div><h3>{valuation ? 'Complimentary Home Valuation' : 'Connect with Gurmeet'}</h3><p>{valuation ? 'Request a personalized valuation and selling strategy.' : 'Share your question or arrange a private conversation.'}</p><div className="ai-search-action-links"><Link href={valuation ? '/home-valuation' : '/contact'}>{valuation ? 'Open Home Valuation' : 'Contact Gurmeet'} <FiArrowRight aria-hidden="true" /></Link>{agentPhone && <a href={phoneHref}><FiPhone aria-hidden="true" /> {agentPhone}</a>}</div></div>
  </section>;
}

export default function AiSearchClient() {
  const [mode, setMode] = useState('database');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ city: '', beds: '', maxPrice: '' });
  const [error, setError] = useState('');
  const resultsEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!loading && history.length) inputRef.current?.focus();
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length, loading]);

  function updateFilter(event) {
    setFilters(current => ({ ...current, [event.target.name]: event.target.value }));
  }

  function resetSession() {
    setHistory([]);
    setMessage('');
    setError('');
    setFilters({ city: '', beds: '', maxPrice: '' });
  }

  async function submit(explicitMessage) {
    const query = String(explicitMessage ?? message).trim();
    if (!query || loading) return;
    const userTurn = { id: `user-${Date.now()}`, role: 'user', content: query, time: timeLabel() };
    setHistory(current => [...current, userTurn]);
    setMessage('');
    setLoading(true);
    setError('');
    try {
      const response = await fetch(publicApiUrl('ai-search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAiSearchRequest({ message: query, mode, history, filters })),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The assistant could not process that request.');
      setHistory(current => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', content: result.reply || 'I can help you explore the portfolio or connect with Gurmeet.', time: timeLabel(), properties: result.properties || [], provider: result.provider, action: actionName(result.action || result.actionType) }]);
    } catch (requestError) {
      setError(requestError.message || 'The assistant is temporarily unavailable.');
      setHistory(current => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', content: 'I’m unable to complete that search right now. Please contact Gurmeet directly for help.', time: timeLabel(), action: 'contact', provider: 'local_fallback' }]);
    } finally {
      setLoading(false);
    }
  }

  return <main className="ai-search-page">
    <section className="ai-search-hero">
      <div className="container ai-search-hero-inner">
        <div className="ai-search-hero-badge"><FiStar aria-hidden="true" /> AI Search Real Estate Suite</div>
        <p className="eyebrow">California portfolio search</p>
        <h1>AI Search Property Assistant</h1>
        <p>Explore verified Homes By Gurmeet properties or use AI Search for clear guidance on buying, selling, and home valuation.</p>
        <div className="ai-search-contact-strip"><span><FiHome aria-hidden="true" /> Homes By Gurmeet</span>{agentPhone && <a href={phoneHref}><FiPhone aria-hidden="true" /> {agentPhone}</a>}{agentEmail && <a href={`mailto:${agentEmail}`}>{agentEmail}</a>}</div>
      </div>
    </section>

    <section className="ai-search-main">
      <div className="container ai-search-container">
        <div className="ai-search-console">
          <div className="ai-search-console-heading"><div><p className="eyebrow">Search engine console</p><h2>Select your search mode</h2><p>Use structured website filters or ask AI Search a natural-language question.</p></div>{history.length > 0 && <button className="ai-search-reset" type="button" onClick={resetSession}><FiRefreshCw aria-hidden="true" /> New search session</button>}</div>
          <div className="ai-search-mode-toggle" role="tablist" aria-label="AI Search mode">
            {Object.entries(modes).map(([key, value]) => <button key={key} type="button" role="tab" aria-selected={mode === key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}><span className="ai-search-mode-icon">{key === 'database' ? <FiDatabase aria-hidden="true" /> : <FiCpu aria-hidden="true" />}</span><span><strong>{value.label}</strong><small>{value.description}</small></span>{mode === key && <FiCheck className="ai-search-mode-check" aria-hidden="true" />}</button>)}
          </div>
          <div className="ai-search-filter-bar"><button type="button" onClick={() => setShowFilters(value => !value)} aria-expanded={showFilters}><FiSliders aria-hidden="true" /> {showFilters ? 'Hide property filters' : 'Show property filters'} <FiChevronDown className={showFilters ? 'rotated' : ''} aria-hidden="true" /></button>{Object.values(filters).some(Boolean) && <button type="button" className="ai-search-clear" onClick={() => setFilters({ city: '', beds: '', maxPrice: '' })}>Clear filters</button>}<Link href="/property-catalogue" className="ai-search-catalogue-link">Browse full catalogue <FiArrowRight aria-hidden="true" /></Link></div>
          {showFilters && <div className="ai-search-filters"><label>City<select name="city" value={filters.city} onChange={updateFilter}><option value="">All cities</option><option>Fremont</option><option>Union City</option><option>Hayward</option><option>San Jose</option><option>San Ramon</option><option>Dublin</option><option>Newark</option><option>Tracy</option></select></label><label>Minimum bedrooms<select name="beds" value={filters.beds} onChange={updateFilter}><option value="">Any bedrooms</option><option value="2">2+ bedrooms</option><option value="3">3+ bedrooms</option><option value="4">4+ bedrooms</option><option value="5">5+ bedrooms</option></select></label><label>Maximum price<select name="maxPrice" value={filters.maxPrice} onChange={updateFilter}><option value="">Any price</option><option value="500000">$500K</option><option value="750000">$750K</option><option value="1000000">$1M</option><option value="1500000">$1.5M</option><option value="2000000">$2M</option></select></label></div>}
        </div>

        <div className="ai-search-conversation" aria-live="polite">
          {!history.length && <div className="ai-search-empty"><span className="ai-search-empty-icon"><FiCpu aria-hidden="true" /></span><h2>What would you like to explore?</h2><p>Ask about portfolio homes, use the filters above, or get connected with Gurmeet.</p></div>}
          {history.map(turn => <article className={`ai-search-turn ${turn.role}`} key={turn.id}><div className="ai-search-turn-header">{turn.role === 'assistant' ? <><span className="ai-search-turn-avatar"><FiCpu aria-hidden="true" /></span><ProviderBadge provider={turn.provider} /></> : <><span className="ai-search-turn-avatar user"><FiUser aria-hidden="true" /></span><strong>You</strong></>}<time>{turn.time}</time></div><div className="ai-search-turn-body"><FormattedText text={turn.content} /><PropertyResults properties={turn.properties} /><ActionCard action={turn.action} /></div></article>)}
          {loading && <div className="ai-search-loading"><span className="ai-search-turn-avatar"><FiRefreshCw aria-hidden="true" /></span><span>AI Search is searching the portfolio…</span></div>}
          {error && <p className="error ai-search-error">{error}</p>}
          <div ref={resultsEndRef} />
        </div>

        <div className="ai-search-composer"><div className="ai-search-suggestions"><span>Suggested questions</span>{quickPrompts[mode].map(prompt => <button type="button" key={prompt} onClick={() => submit(prompt)} disabled={loading}>{prompt}</button>)}</div><form onSubmit={event => { event.preventDefault(); submit(); }}><label className="sr-only" htmlFor="ai-search-input">Ask AI Search</label><input ref={inputRef} id="ai-search-input" value={message} onChange={event => setMessage(event.target.value)} maxLength={1200} placeholder={mode === 'database' ? 'Search by city, beds, price, or address…' : 'Ask AI Search about buying, selling, or home valuation…'} disabled={loading} /><button type="submit" disabled={!message.trim() || loading} aria-label="Submit AI Search question"><FiSend aria-hidden="true" /></button></form><p className="ai-search-disclosure">AI responses may be inaccurate. Property information is drawn from the current Homes By Gurmeet portfolio and should be verified.</p></div>
      </div>
    </section>
  </main>;
}
