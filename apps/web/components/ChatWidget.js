'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FiHome, FiMessageCircle, FiSend, FiTrendingUp, FiUser, FiX } from 'react-icons/fi';
import { usePathname } from 'next/navigation';
import { publicApiUrl, publicAssetUrl } from '../lib/api';
import PropertyImage from './PropertyImage';

const now = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const welcomeMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hello! I’m Gurmeet’s AI property assistant. I can help you explore portfolio homes, buying or selling questions, and home valuation options.',
  time: now(),
};
const quickPrompts = ['Homes in Fremont', '3 bedroom homes', 'What is my home worth?', 'Contact Gurmeet'];

function ActionCard({ action, close }) {
  if (!action) return null;
  const valuation = action === 'valuation';
  return <div className="chat-action-card">
    <div className="chat-action-icon">{valuation ? <FiTrendingUp aria-hidden="true" /> : <FiMessageCircle aria-hidden="true" />}</div>
    <div>
      <strong>{valuation ? 'Complimentary home valuation' : 'Connect with Gurmeet'}</strong>
      <p>{valuation ? 'Request a personalized home valuation and selling strategy.' : 'Share your question or arrange a conversation with Gurmeet.'}</p>
      <Link className="chat-action-link" href={valuation ? '/home-valuation' : '/contact'} onClick={close}>
        {valuation ? 'Request a valuation' : 'Contact Gurmeet'}
      </Link>
    </div>
  </div>;
}

function PropertyMatches({ properties = [], close }) {
  if (!properties.length) return null;
  return <div className="chat-property-results">
    <p>Portfolio matches</p>
    {properties.map(property => <Link className="chat-property-card" href={`/properties/${property.slug}`} key={property.id || property.slug} onClick={close}>
      <PropertyImage src={publicAssetUrl(property.image)} alt={property.title} />
      <span>
        <strong>{property.title}</strong>
        <small>{[property.city, property.beds && `${property.beds} beds`, property.baths && `${property.baths} baths`].filter(Boolean).join(' · ')}</small>
        <b>{property.price ? `$${property.price.toLocaleString()}` : 'Price on request'}</b>
      </span>
    </Link>)}
  </div>;
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    if (open) end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (pathname?.startsWith('/admin')) return null;

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
        body: JSON.stringify({ message: content, history }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The assistant is unavailable right now.');
      setMessages(current => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.reply || 'I can help you explore homes or connect with Gurmeet.',
        time: now(),
        properties: result.properties || [],
        action: result.action || null,
      }]);
    } catch (error) {
      setMessages(current => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: error.message || 'I’m unable to respond right now. Please contact Gurmeet directly for help.',
        time: now(),
        action: 'contact',
      }]);
    } finally {
      setLoading(false);
    }
  }

  return <aside className="chat-widget">
    {!open && <button className="chat-launcher" type="button" aria-label="Open Gurmeet’s AI property assistant" onClick={() => setOpen(true)}>
      <FiMessageCircle aria-hidden="true" />
      <span>Ask Gurmeet</span>
    </button>}
    {open && <section className="chat-panel" role="dialog" aria-modal="false" aria-label="Gurmeet’s AI property assistant">
      <header className="chat-header">
        <div><span className="chat-bot-mark"><FiHome aria-hidden="true" /></span><span><strong>Gurmeet’s AI Assistant</strong><small>Portfolio &amp; real estate guidance</small></span></div>
        <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}><FiX aria-hidden="true" /></button>
      </header>
      <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map(message => <div className={`chat-message ${message.role}`} key={message.id}>
          {message.role === 'assistant' && <span className="chat-avatar"><FiHome aria-hidden="true" /></span>}
          <div>
            <p>{message.content}</p>
            <time>{message.time}</time>
            <PropertyMatches properties={message.properties} close={() => setOpen(false)} />
            <ActionCard action={message.action} close={() => setOpen(false)} />
          </div>
          {message.role === 'user' && <span className="chat-avatar user"><FiUser aria-hidden="true" /></span>}
        </div>)}
        {messages.length < 3 && !loading && <div className="chat-prompts"><span>Suggested questions</span>{quickPrompts.map(prompt => <button type="button" key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}</div>}
        {loading && <div className="chat-loading"><span /><span /><span /> Gurmeet’s assistant is thinking…</div>}
        <div ref={end} />
      </div>
      <form className="chat-form" onSubmit={event => { event.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="property-chat-message">Ask a question</label>
        <input id="property-chat-message" value={input} maxLength="1200" onChange={event => setInput(event.target.value)} placeholder="Ask about homes, selling, or value…" disabled={loading} />
        <button type="submit" aria-label="Send chat message" disabled={!input.trim() || loading}><FiSend aria-hidden="true" /></button>
      </form>
      <p className="chat-disclosure">AI responses may be inaccurate. Verify property details with Gurmeet.</p>
    </section>}
  </aside>;
}
