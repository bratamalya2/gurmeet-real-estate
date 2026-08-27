import Link from "next/link";
import { Header, Footer } from "../../components/SiteChrome";
import {
  FiStar,
  FiAward,
  FiMapPin,
  FiCheckCircle,
  FiShield,
  FiTrendingUp,
  FiDollarSign,
  FiGlobe,
  FiUsers,
  FiExternalLink,
  FiPhoneCall,
} from "react-icons/fi";

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Homes By Gurmeet";
const brandOwner = process.env.NEXT_PUBLIC_BRAND_OWNER || "Gurmeet Singh";
const agentPhone = process.env.NEXT_PUBLIC_AGENT_PHONE || "(510) 209-7718";

export const metadata = {
  title: `About ${brandOwner} | Bay Area Realtor® & Real Estate Specialist`,
  description: `Learn about Gurmeet Singh, a trusted Bay Area Realtor® since 2007 (CA DRE #01479256). 19+ years experience, 207+ sales, 5.0-star Zillow rating across 80+ reviews.`,
};

const stats = [
  { value: "19+", label: "Years Experience", sub: "Licensed since 2007" },
  { value: "28+", label: "Years in Bay Area", sub: "Resident since 1998" },
  { value: "207+", label: "Homes Sold", sub: "Buyer & Seller transactions" },
  { value: "5.0 ★", label: "Zillow Client Rating", sub: "Based on 80+ reviews" },
];

const specialties = [
  {
    icon: <FiHome />,
    title: "Buyer Representation",
    description:
      "Strategic search, competitive market analysis, and relentless negotiation to help buyers secure their dream home at optimal value in fast-moving Bay Area markets.",
  },
  {
    icon: <FiTrendingUp />,
    title: "Listing Strategy & Marketing",
    description:
      "Comprehensive listing preparation, modern digital syndication, and high-impact pricing strategies engineered to maximize seller return and minimize days on market.",
  },
  {
    icon: <FiShield />,
    title: "Short Sales & Hardship Negotiation",
    description:
      "Extensive experience negotiating directly with major banks and lenders to deliver positive, dignified solutions for homeowners navigating financial hardship.",
  },
  {
    icon: <FiDollarSign />,
    title: "Loan & Financing Insights",
    description:
      "Dual background in real estate sales (DRE #01479256) and loan agency (License #875333) enables proactive troubleshooting of buyer pre-approvals and underwriting hurdles.",
  },
  {
    icon: <FiGlobe />,
    title: "Multilingual Service",
    description:
      "Fluent in English, Hindi, Punjabi, and Urdu — offering clear, comfortable, and transparent communication across diverse California communities.",
  },
  {
    icon: <FiUsers />,
    title: "Investment & Relocation Guidance",
    description:
      "In-depth analysis of rental yields, neighborhood trajectory, and school districts across Alameda, Contra Costa, San Joaquin, and surrounding counties.",
  },
];

const testimonials = [
  {
    author: "Malkiat Singh",
    location: "Bought in Allendale, Oakland, CA",
    text: "Gurmeet is a true professional in the real estate business. I asked him to show me multiple properties over a period of four months before I finally bought one. He was always available, very responsive, and consistently gave me his honest opinion. He is an excellent negotiator who always put my interests ahead of his commission.",
  },
  {
    author: "JP Singh",
    location: "Bought in Rancho Cordova, CA",
    text: "Gurmeet did an excellent job helping us buy our dream home. He was very knowledgeable about the local market and past trends. He was available whenever we needed him to show us a property and was excellent at dealing with the seller. We were able to buy the house that we wanted with the negotiation skills that Gurmeet brought.",
  },
  {
    author: "Harveer Singh",
    location: "Bought in Manteca, CA",
    text: "We purchased our home through Gurmeet Singh. He helped us so much to get a home and pass a loan. He is very familiar, understanding, and helpful. He guided us through every step and helped us get a wonderful deal.",
  },
  {
    author: "Verified Home Buyer",
    location: "Bought in Spanos Park West, Stockton, CA",
    text: "Gurmeet helped us buy a new home after another agent's deal collapsed over financing. Gurmeet stepped in, negotiated the price with the builder, helped resolve lender questions, and explained all paperwork in detail. We strongly recommend Gurmeet to anyone thinking of buying or selling.",
  },
  {
    author: "Verified Client",
    location: "Bought in Union City, CA",
    text: "From start to finish, it was a great experience working with Mr. Gurmeet Singh in Union City. His negotiation skills were first-rate — he consistently found ways to get me the best deal possible and took care of every detail from disclosures to inspections.",
  },
  {
    author: "Verified Buyer & Investor",
    location: "Bought in Fremont / East Bay, CA",
    text: "Gurmeet pairs extensive market knowledge with steady, patient communication. Whether evaluating contract clauses or analyzing neighborhood property values, his guidance is invaluable.",
  },
];

const serviceAreas = [
  "Fremont, CA",
  "Newark, CA",
  "Union City, CA",
  "Hayward, CA",
  "San Leandro, CA",
  "Castro Valley, CA",
  "San Lorenzo, CA",
  "San Ramon, CA",
  "Alameda County",
  "Contra Costa County",
  "Tracy, CA",
  "Manteca, CA",
  "Lathrop, CA",
  "Oakland, CA",
];

function FiHome() {
  return (
    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  );
}

export default function About() {
  return (
    <>
      <Header />
      <main>
        {/* Page Hero */}
        <section className="page-hero">
          <div className="container">
            <span className="about-hero-badge">
              <FiAward /> Licensed California Realtor® • CA DRE #01479256
            </span>
            <h1>Dedicated Real Estate Leadership in the Bay Area</h1>
            <p style={{ maxWidth: 740, margin: "16px auto 0", fontSize: 18, color: "#94a3b8", lineHeight: 1.6 }}>
              Deep roots since 1998, over 19 years of licensed market expertise, and more than 200 successful residential transactions.
            </p>
          </div>
        </section>

        {/* Agent Profile & Biography */}
        <section className="section container">
          <div className="agent-profile-section">
            <div className="agent-photo-box">
              <img
                src="/images/gurmeet-singh.jpg"
                alt="Gurmeet Singh - Bay Area Realtor"
              />
              <div className="agent-floating-badge">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>Gurmeet Singh</span>
                  <span style={{ color: "#f59e0b", display: "flex", alignItems: "center", gap: 3, fontWeight: 700, fontSize: 14 }}>
                    <FiStar style={{ fill: "#f59e0b" }} /> 5.0 / 5.0
                  </span>
                </div>
                <p style={{ fontSize: 12, margin: 0, color: "#cbd5e1" }}>
                  80+ Verified 5-Star Reviews on Zillow • 207+ Homes Sold
                </p>
              </div>
            </div>

            <div>
              <p className="eyebrow">Meet Your Realtor®</p>
              <h2 style={{ fontSize: 40, margin: "12px 0 20px" }}>
                Proven Experience. Trusted Guidance. Genuine Dedication.
              </h2>

              <div className="pill-row">
                <span className="pill-badge highlight">
                  <FiAward /> CA DRE #01479256
                </span>
                <span className="pill-badge highlight">
                  <FiShield /> Loan Agent #875333
                </span>
                <span className="pill-badge primary">
                  <FiGlobe /> English, Hindi, Punjabi, Urdu
                </span>
                <span className="pill-badge primary">
                  <FiMapPin /> Bay Area Resident Since 1998
                </span>
              </div>

              <div style={{ fontSize: 16, lineHeight: 1.8, color: "#334155" }}>
                <p>
                  <strong>Gurmeet Singh</strong> has been a proud resident of the San Francisco Bay Area since 1998, giving him deep personal roots, detailed neighborhood familiarity, and firsthand insight into the region’s evolving real estate landscape.
                </p>
                <p style={{ marginTop: 14 }}>
                  He began his real estate career in 2007 and has since established himself as a respected, client-first professional assisting families and investors with residential purchases, high-yield investments, and luxury home sales across Alameda County, Contra Costa County, the Tri-Valley, and Central Valley corridors.
                </p>
                <p style={{ marginTop: 14 }}>
                  With extensive listing experience across multiple market cycles, Gurmeet has also successfully assisted homeowners navigating financial hardship — negotiating directly with lenders and banks on complex short sales to secure positive, confident outcomes.
                </p>
              </div>

              {/* Quick Contact Bar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 32 }}>
                <a className="btn" href={`tel:${agentPhone.replace(/\D/g, "")}`}>
                  <FiPhoneCall style={{ marginRight: 8 }} /> Call {agentPhone}
                </a>
                <Link className="btn alt" href="/contact">
                  Schedule a Consultation
                </Link>
                <a
                  className="btn alt"
                  href="https://www.zillow.com/profile/Gurmeet%20Singh"
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  View Zillow Profile <FiExternalLink />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Matrix Banner */}
        <section className="dark-section section">
          <div className="container">
            <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto 40px" }}>
              <p className="eyebrow" style={{ color: "var(--gold)" }}>By The Numbers</p>
              <h2 style={{ fontSize: 36, color: "#fff", marginTop: 8 }}>
                A Track Record of Continuous Results
              </h2>
            </div>
            <div className="stats-matrix-dark">
              {stats.map((stat, idx) => (
                <div key={idx} className="stat-card-dark">
                  <b>{stat.value}</b>
                  <span>{stat.label}</span>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#94a3b8" }}>{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Specialties */}
        <section className="section container">
          <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 48px" }}>
            <p className="eyebrow">Comprehensive Real Estate Services</p>
            <h2 style={{ fontSize: 38, marginTop: 10 }}>
              Specialized Expertise for Every Step
            </h2>
            <p style={{ fontSize: 16, color: "#64748b", marginTop: 12 }}>
              From initial market research and mortgage pre-approval navigation to closing negotiations and post-sale support.
            </p>
          </div>

          <div className="specialty-grid">
            {specialties.map((item, idx) => (
              <div key={idx} className="specialty-card">
                <div>
                  <div className="specialty-icon">{item.icon}</div>
                  <h3 style={{ fontSize: 20, fontFamily: "Hanken Grotesk", fontWeight: 700, marginBottom: 12, color: "var(--navy)" }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "#64748b", margin: 0 }}>
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Verified Zillow Client Reviews */}
        <section className="section" style={{ background: "#f8fafc", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
          <div className="container">
            <div className="feature-head">
              <div>
                <p className="eyebrow">Client Feedback</p>
                <h2 style={{ fontSize: 38, marginTop: 8 }}>Verified 5-Star Reviews</h2>
                <p style={{ color: "#64748b", marginTop: 6, fontSize: 15 }}>
                  Real testimonials published by clients on Zillow.
                </p>
              </div>
              <a
                className="btn alt"
                href="https://www.zillow.com/profile/Gurmeet%20Singh#reviews"
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                Read All 80+ Reviews <FiExternalLink />
              </a>
            </div>

            <div className="testimonials-grid">
              {testimonials.map((review, idx) => (
                <div key={idx} className="testimonial-box">
                  <div>
                    <div className="testimonial-rating">
                      {[...Array(5)].map((_, i) => (
                        <FiStar key={i} style={{ fill: "#f59e0b" }} />
                      ))}
                    </div>
                    <p className="testimonial-quote">"{review.text}"</p>
                  </div>
                  <div className="testimonial-meta">
                    <div>
                      <div className="testimonial-author">{review.author}</div>
                      <div className="testimonial-tag">{review.location}</div>
                    </div>
                    <span className="pill-badge" style={{ background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0", fontSize: 11 }}>
                      <FiCheckCircle /> Verified
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Service Areas */}
        <section className="section container">
          <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto 30px" }}>
            <p className="eyebrow">Geographic Coverage</p>
            <h2 style={{ fontSize: 36, marginTop: 8 }}>Bay Area & Regional Service Markets</h2>
            <p style={{ color: "#64748b", marginTop: 10 }}>
              Specialized local market advisory across premier Alameda, Contra Costa, and Central Valley communities.
            </p>
          </div>

          <div className="service-areas-wrap" style={{ justifyContent: "center" }}>
            {serviceAreas.map((area, idx) => (
              <span key={idx} className="service-area-pill">
                <FiMapPin style={{ color: "var(--gold)" }} /> {area}
              </span>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="dark-section section" style={{ textAlign: "center" }}>
          <div className="container" style={{ maxWidth: 760 }}>
            <p className="eyebrow" style={{ color: "var(--gold)" }}>Begin Your Real Estate Journey</p>
            <h2 style={{ fontSize: 40, color: "#fff", marginTop: 12 }}>
              Ready to Discuss Your Next Move?
            </h2>
            <p style={{ fontSize: 17, color: "#cbd5e1", lineHeight: 1.7, margin: "16px auto 32px" }}>
              Whether you are buying your first residence, selling for top value, or seeking an expert market opinion, Gurmeet Singh is ready to provide dedicated, professional representation.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
              <Link className="btn" style={{ background: "var(--gold)", borderColor: "var(--gold)", color: "#fff" }} href="/contact">
                Contact Gurmeet Directly
              </Link>
              <Link className="btn alt" style={{ color: "#fff", borderColor: "#fff" }} href="/home-valuation">
                Request Free Home Valuation
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
