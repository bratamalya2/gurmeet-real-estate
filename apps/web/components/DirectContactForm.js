'use client';

import { useState } from 'react';

const recipient = process.env.NEXT_PUBLIC_FORMSUBMIT_EMAIL || process.env.NEXT_PUBLIC_AGENT_EMAIL || 'gurmeetrealtor@gmail.com';

export default function DirectContactForm() {
  const [status, setStatus] = useState('');

  async function submit(event) {
    event.preventDefault();
    setStatus('loading');

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Unable to send your message. Please try again.');
      form.reset();
      setStatus('success');
    } catch (error) {
      setStatus(error.message || 'Unable to send your message. Please try again.');
    }
  }

  return (
    <form className="fields" onSubmit={submit}>
      <input type="hidden" name="_subject" value="New direct contact message from Homes By Gurmeet" />
      <input type="hidden" name="_template" value="table" />
      <input type="text" name="_honey" tabIndex="-1" autoComplete="off" style={{ display: 'none' }} />
      <input required name="name" placeholder="Full name" />
      <input required name="email" type="email" placeholder="Email address" />
      <input required name="phone" placeholder="Phone number" />
      <textarea required name="message" placeholder="How can Gurmeet help?" />
      {status === 'success' ? (
        <p className="notice">Thank you. Gurmeet will be in touch shortly.</p>
      ) : (
        <button className="btn" disabled={status === 'loading'}>
          {status === 'loading' ? 'Sending…' : 'Send message'}
        </button>
      )}
      {status && !['success', 'loading'].includes(status) && <p className="error">{status}</p>}
    </form>
  );
}
