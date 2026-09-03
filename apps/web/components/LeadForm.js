'use client';

import { useEffect, useRef, useState } from 'react';
import { publicApiUrl } from '../lib/api';

const labels = { contact: 'Send message', inquiry: 'Request information', showing: 'Request showing', valuation: 'Request valuation' };

export default function LeadForm({ type = 'contact', property }) {
  const [form, setForm] = useState({ type, name: '', email: '', phone: '', message: '', property, preferredDate: '', propertyAddress: '', squareFootage: '', condition: '' });
  const [status, setStatus] = useState('');
  const captcha = useRef();
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!sitekey || !captcha.current) return undefined;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => window.turnstile?.render(captcha.current, { sitekey, callback: token => setForm(value => ({ ...value, turnstileToken: token })), 'expired-callback': () => setForm(value => ({ ...value, turnstileToken: '' })) });
    document.head.append(script);
    return () => script.remove();
  }, [sitekey]);

  const update = event => setForm({ ...form, [event.target.name]: event.target.value });
  async function submit(event) {
    event.preventDefault();
    setStatus('loading');
    try {
      const response = await fetch(publicApiUrl('leads'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send your request.');
      setStatus('success');
    } catch (error) { setStatus(error.message || 'Unable to send your request.'); }
  }

  return <form className="fields" onSubmit={submit}><input required name="name" placeholder="Full name" value={form.name} onChange={update} /><input required name="email" type="email" placeholder="Email address" value={form.email} onChange={update} /><input required name="phone" placeholder="Phone number" value={form.phone} onChange={update} />{type === 'showing' && <label>Preferred date and time<input required name="preferredDate" type="datetime-local" value={form.preferredDate} onChange={update} /></label>}{type === 'valuation' && <><input required name="propertyAddress" placeholder="Property address" value={form.propertyAddress} onChange={update} /><input name="squareFootage" type="number" min="1" placeholder="Approximate square feet" value={form.squareFootage} onChange={update} /><select name="condition" value={form.condition} onChange={update}><option value="">Property condition (optional)</option><option>Excellent</option><option>Good</option><option>Fair</option><option>Needs updates</option></select></>}<textarea name="message" placeholder="How can Gurmeet help?" value={form.message} onChange={update} />{sitekey && <div ref={captcha} />}{status === 'success' ? <p className="notice">Thank you. Gurmeet will be in touch shortly.</p> : <button className="btn" disabled={status === 'loading'}>{status === 'loading' ? 'Sending…' : labels[type]}</button>}{status && !['success', 'loading'].includes(status) && <p className="error">{status}</p>}</form>;
}


