'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FiMenu, FiX } from 'react-icons/fi';

const links = [['Home', '/'], ['About', '/about'], ['Services', '/services'], ['Homes for Sale', '/homes-for-sale'], ['Recently Sold', '/recently-sold'], ['Contact', '/contact']];
const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'Homes By Gurmeet';
const brandOwner = process.env.NEXT_PUBLIC_BRAND_OWNER || 'Gurmeet Singh';
const brandLogo = process.env.NEXT_PUBLIC_BRAND_LOGO || '/Homes BY Gurmeet Logo.png';

function Brand() { return brandLogo ? <img className="brand-logo" src={brandLogo} alt={brandName} /> : brandName; }

export function Header() {
  const [open, setOpen] = useState(false);
  return <header className="header"><div className="container head"><Link href="/" className="brand" aria-label={brandName}><Brand /></Link><nav>{links.map(([label, url]) => <Link key={url} href={url}>{label}</Link>)}</nav><Link className="schedule" href="/home-valuation">Home Valuation</Link><button className="menu" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>{open ? <FiX /> : <FiMenu />}</button>{open && <div className="mobile-nav">{links.map(([label, url]) => <Link key={url} href={url} onClick={() => setOpen(false)}>{label}</Link>)}<Link className="btn" href="/home-valuation" onClick={() => setOpen(false)}>Home Valuation</Link></div>}</div></header>;
}

function RedfinBrokerMark() {
  return <div className="redfin-broker" aria-label="Redfin Broker">
    <svg className="redfin-logo" viewBox="0 0 28 28" role="img" aria-hidden="true"><path fill="currentColor" d="M3 3h22v16L14 25 3 19V3Z" /><path fill="#fff" d="M9 8h5.5c3.1 0 5 1.5 5 4.1 0 1.7-.9 3-2.5 3.6l3 4.3h-3.7l-2.4-3.7h-1.6V20H9V8Zm3.3 2.7v3h2c1.2 0 1.9-.5 1.9-1.5s-.7-1.5-1.9-1.5h-2Z" /></svg>
    <span><strong>Redfin</strong><small>Broker</small></span>
  </div>;
}

export function Footer() {
  const social = [['Instagram', process.env.NEXT_PUBLIC_INSTAGRAM_URL], ['LinkedIn', process.env.NEXT_PUBLIC_LINKEDIN_URL], ['Facebook', process.env.NEXT_PUBLIC_FACEBOOK_URL]].filter(([, url]) => url);
  return <footer><div className="container foot"><div><div className="brand"><Brand /></div><p>Exceptional service. Elevated living.</p></div><div><b>Contact</b><p>{process.env.NEXT_PUBLIC_AGENT_PHONE || `Contact ${brandOwner}`}</p><p>{process.env.NEXT_PUBLIC_AGENT_EMAIL || 'Available on request'}</p></div><div className="credentials"><b>Credentials</b><p>California BRE - 206527881</p><RedfinBrokerMark /></div><div><b>Follow</b>{social.length ? social.map(([label, url]) => <p key={label}><a href={url} target="_blank" rel="noreferrer">{label}</a></p>) : <p>Social links coming soon.</p>}</div></div><div className="container copyright">© {new Date().getFullYear()} {brandName}. All rights reserved.</div></footer>;
}
