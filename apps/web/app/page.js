import Link from "next/link";
import { Header, Footer } from "../components/SiteChrome";
import PropertyGrid from "../components/PropertyGrid";

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Homes By Gurmeet";
const brandOwner = process.env.NEXT_PUBLIC_BRAND_OWNER || "Gurmeet Singh";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="container">
            <p className="eyebrow">{brandName}</p>
            <h1>Elevating Your Standard of Living</h1>
            <p>
              Thoughtful real estate guidance for the homes, neighborhoods, and
              next chapters that matter most.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
              <Link className="btn" href="/homes-for-sale">
                Explore Listings
              </Link>
              <Link
                className="btn alt"
                style={{ color: "#fff", borderColor: "#fff" }}
                href="/contact"
              >
                Work with {brandOwner}
              </Link>
            </div>
          </div>
        </section>
        <section className="section container">
          <div className="feature-head">
            <div>
              <p className="eyebrow">Curated collection</p>
              <h2 style={{ fontSize: 42 }}>Featured Residences</h2>
            </div>
            <Link className="btn alt" href="/homes-for-sale">
              View all homes
            </Link>
          </div>
          <PropertyGrid featured />
        </section>
        <section className="dark-section section">
          <div className="container two">
            <div>
              <p className="eyebrow">Experience matters</p>
              <h2 style={{ fontSize: 44, marginTop: 12 }}>
                Expertise Driven by Experience.
              </h2>
            </div>
            <p style={{ fontSize: 18, lineHeight: 1.7, color: "#cbd5e1" }}>
              From a first conversation to a successful close, {brandOwner} pairs
              rigorous market knowledge with a personal, considered approach.
            </p>
          </div>
        </section>
        <section className="service-showcase">
          <div className="container service-showcase-panel">
            <div>
              <p className="eyebrow">Elevating real estate service</p>
              <h2>Elevating Real Estate Service</h2>
            </div>
            <div className="service-showcase-copy">
              <p>
                Whether you are buying, selling, or simply considering what is
                next, {brandOwner} brings local perspective, steady communication,
                and thoughtful strategy to every step.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
