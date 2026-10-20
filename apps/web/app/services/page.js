import Link from 'next/link';
import { Header, Footer } from '../../components/SiteChrome';

export const metadata = { title: 'Services' };

export default function Services() {
  return <>
    <Header />
    <section className="page-hero">
      <p className="eyebrow">A tailored approach</p>
      <h1>Bespoke Real Estate Services</h1>
    </section>
    <main className="container section services-page">
      <section className="grid two services-grid" aria-label="Real estate services">
        <article className="card">
          <img src="/images/luxury-home.png" alt="Luxury home buying" />
          <div className="card-body">
            <p className="eyebrow">For buyers</p>
            <h2>Buying with Gurmeet</h2>
            <p className="muted">A clear, confident search shaped around your priorities, with insightful advice at every decision.</p>
            <Link href="/contact" className="btn alt">Contact Gurmeet</Link>
          </div>
        </article>
        <article className="card">
          <img src="/images/luxury-home.png" alt="Luxury home selling" />
          <div className="card-body">
            <p className="eyebrow">For sellers</p>
            <h2>Selling with Gurmeet</h2>
            <p className="muted">Position your home with intelligent pricing, refined presentation, and carefully managed negotiation.</p>
            <Link href="/home-valuation" className="btn alt">Request Evaluation</Link>
          </div>
        </article>
      </section>

      <section className="services-active-listings" aria-labelledby="active-listings-title">
        <div>
          <p className="eyebrow">Currently available</p>
          <h2 id="active-listings-title">Active Listings</h2>
          <p>Explore the homes currently up for sale and use the available filters to find a property that fits your priorities.</p>
        </div>
        <Link href="/homes-for-sale" className="btn">View Active Listings</Link>
      </section>
    </main>
    <Footer />
  </>;
}
