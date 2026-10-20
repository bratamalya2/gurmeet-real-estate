'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FiArrowRight, FiCpu, FiHome, FiMaximize2, FiMessageCircle, FiPhone, FiSend, FiTrendingUp, FiUser, FiX } from 'react-icons/fi';
import { usePathname } from 'next/navigation';
import { publicApiUrl, publicAssetUrl } from '../lib/api';
import PropertyImage from './PropertyImage';

const agentPhone = process.env.NEXT_PUBLIC_AGENT_PHONE || '';
const phoneHref = agentPhone ? `tel:${agentPhone.replace(/\D/g, '')}` : '/contact';
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const quickQuestions = ['Homes in Fremont', '3 bedroom homes', "What's my home worth?", 'Contact Gurmeet'];
const welcome = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hello! I’m AI Search. I can help you explore portfolio homes, understand the buying or selling process, or start a home valuation.',
  time: now(),
};

function actionName(value) {
  return value === 'home_valuation' ? 'valuation' : value;
}

function PropertyMatches({ properties = [], close }) {
  if (!properties.length) return null;
  return <div className="chat-property-results">
    <p>Matching portfolio properties</p>
    {properties.map(property => <article className="chat-property-card" key={property.id || property.slug}>
      <PropertyImage src={publicAssetUrl(property.image)} alt={property.title} />
      <div className="chat-property-card-body">
        <div className="chat-property-card-heading"><strong>{property.title}</strong><b>{property.price ? `$${property.price.toLocaleString()}` : 'Price on request'}</b></div>
        <small>{[property.city, property.beds && `${property.beds} beds`, property.baths && `${property.baths} baths`].filter(Boolean).join(' · ') || 'Portfolio property'}</small>
        <Link href={`/properties/${property.slug}`} onClick={close} className="chat-property-link">View property <FiArrowRight aria-hidden="true" /></Link>
      </div>
    </article>)}
  </div>;
}

function ActionCard({ action, close }) {
  if (!action) return null;
  const valuation = action === 'valuation';
  return <div className="chat-action-card">
    <div className="chat-action-icon">{valuation ? <FiTrendingUp aria-hidden="true" /> : <FiMessageCircle aria-hidden="true" />}</div>
    <div className="chat-action-copy">
      <strong>{valuation ? 'Complimentary Home Valuation' : 'Connect with Gurmeet'}</strong>
      <p>{valuation ? 'Request a personalized valuation and selling strategy.' : 'Share your question or arrange a private conversation.'}</p>
      <div className="chat-action-links">
        <Link className="chat-action-link" href={valuation ? '/home-valuation' : '/contact'} onClick={close}>{valuation ? 'Open valuation form' : 'Contact Gurmeet'} <FiArrowRight aria-hidden="true" /></Link>
        <a className="chat-action-phone" href={phoneHref}>{agentPhone ? <><FiPhone aria-hidden="true" /> {agentPhone}</> : 'Contact details'}</a>
      </div>
    </div>
  </div>;
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([welcome]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (pathname?.startsWith('/admin') || pathname === '/ai-search') return null;

  async function send(explicitMessage) {
    const content = String(explicitMessage || input).trim();
    if (!content || loading) return;
    const userMessage = { id: `user-${Date.now()}`, role: 'user', content, time: now() };
    const history = messages.slice(-6).map(message => ({ role: message.role, content: message.content }));
    setMessages(current => [...current, userMessage]);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch(publicApiUrl('chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history, mode: 'database' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The assistant is unavailable right now.');
      setMessages(current => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.reply || 'I can help you explore homes or connect with Gurmeet.',
        time: now(),
        properties: result.properties || [],
        action: actionName(result.action || result.actionType),
      }]);
    } catch (error) {
      setMessages(current => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', content: error.message || 'Please contact Gurmeet directly for help.', time: now(), action: 'contact' }]);
    } finally {
      setLoading(false);
    }
  }

  return <aside className="chat-widget">
    {!open && <button className="chat-launcher chat-launcher-round" type="button" aria-label="Open AI Search" onClick={() => setOpen(true)}>
      <FiMessageCircle aria-hidden="true" /><span className="chat-status-dot" aria-hidden="true" />
    </button>}
    {open && <section className="chat-panel" role="dialog" aria-modal="false" aria-label="AI Search">
      <header className="chat-header">
        <div className="chat-header-identity"><span className="chat-bot-mark"><FiCpu aria-hidden="true" /><span className="chat-status-dot" aria-hidden="true" /></span><span><strong>AI Search</strong><small>Homes By Gurmeet</small></span></div>
        <div className="chat-header-actions"><Link href="/ai-search" onClick={() => setOpen(false)} className="chat-full-page-link" aria-label="Open full AI Search"><FiMaximize2 aria-hidden="true" /><span>Full Page</span></Link><button type="button" aria-label="Close chat" onClick={() => setOpen(false)}><FiX aria-hidden="true" /></button></div>
      </header>
      <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map(message => <div className={`chat-message ${message.role}`} key={message.id}>
          {message.role === 'assistant' && <span className="chat-avatar"><FiCpu aria-hidden="true" /></span>}
          <div className="chat-message-content"><p>{message.content}</p><time>{message.time}</time><PropertyMatches properties={message.properties} close={() => setOpen(false)} /><ActionCard action={message.action} close={() => setOpen(false)} /></div>
          {message.role === 'user' && <span className="chat-avatar user"><FiUser aria-hidden="true" /></span>}
        </div>)}
        {messages.length < 3 && !loading && <div className="chat-prompts"><span>Suggested questions</span>{quickQuestions.map(question => <button type="button" key={question} onClick={() => send(question)}>{question}</button>)}</div>}
        {loading && <div className="chat-loading"><span className="chat-loading-avatar"><FiCpu aria-hidden="true" /></span><span>AI Search is searching the portfolio…</span><i /><i /><i /></div>}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={event => { event.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="property-chat-message">Ask a question</label>
        <input id="property-chat-message" value={input} maxLength={1200} onChange={event => setInput(event.target.value)} placeholder="Search homes, prices, or ask a question…" disabled={loading} />
        <button type="submit" aria-label="Send chat message" disabled={!input.trim() || loading}><FiSend aria-hidden="true" /></button>
      </form>
      <p className="chat-disclosure">AI responses may be inaccurate. Verify property details with Gurmeet.</p>
    </section>}
  </aside>;
}
