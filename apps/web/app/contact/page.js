import Link from "next/link";
import { Header, Footer } from "../../components/SiteChrome";
import DirectContactForm from "../../components/DirectContactForm";
import {
  FiPhone,
  FiMail,
  FiMapPin,
  FiAward,
  FiGlobe,
  FiClock,
  FiExternalLink,
  FiCheckCircle,
  FiStar,
  FiHelpCircle,
} from "react-icons/fi";

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Homes By Gurmeet";
const brandOwner = process.env.NEXT_PUBLIC_BRAND_OWNER || "Gurmeet Singh";
const agentPhone = process.env.NEXT_PUBLIC_AGENT_PHONE || "(510) 209-7718";
const agentEmail = process.env.NEXT_PUBLIC_AGENT_EMAIL || "gurmeetrealtor@gmail.com";
const officeAddress = "1 Montgomery St, Ste 800, San Francisco, CA 94104";
const serviceHub = "Fremont & Greater San Francisco Bay Area, CA";
const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

export const metadata = {
  title: `Contact ${brandOwner} | Bay Area Realtor® • Call ${agentPhone}`,
  description: `Get in touch with Gurmeet Singh (CA DRE #01479256). Direct cell: ${agentPhone}, Email: ${agentEmail}. Office at 1 Montgomery St, San Francisco, CA. Serving Fremont, Alameda, and Contra Costa.`,
};

const faqs = [
  {
    q: "How quickly can I expect a response?",
    a: "Gurmeet prides himself on exceptional responsiveness. Direct calls and messages are typically answered immediately or returned within 1 to 2 hours during business hours.",
  },
  {
    q: "Do you offer complimentary home valuations (CMA)?",
    a: "Yes. Gurmeet provides a comprehensive Comparative Market Analysis considering recent neighborhood solds, active market trends, and unique property attributes at no cost or obligation.",
  },
  {
    q: "What languages can we communicate in?",
    a: "Gurmeet is fluent in English, Hindi, Punjabi, and Urdu, ensuring clear and comfortable communication throughout your entire transaction.",
  },
  {
    q: "Can you assist with lender pre-approvals and loans?",
    a: "With a dual background in real estate (DRE #01479256) and loan agency (License #875333), Gurmeet can provide valuable guidance on financing expectations, credit qualifications, and lender coordination.",
  },
];

export default function Contact() {
  const mapQuery = encodeURIComponent(serviceHub);

  return (
    <>
      <Header />
      <main>
        {/* Page Hero */}
        <section className="page-hero">
          <div className="container">
            <span className="about-hero-badge">
              <FiStar style={{ fill: "var(--gold)" }} /> Top Rated Bay Area Realtor® • 80+ 5-Star Reviews
            </span>
            <h1>Get in Touch with {brandOwner}</h1>
            <p style={{ maxWidth: 700, margin: "16px auto 0", fontSize: 18, color: "#94a3b8", lineHeight: 1.6 }}>
              Whether you are preparing to sell, ready to tour homes, or exploring financing options, personalized guidance is just a call or message away.
            </p>
          </div>
        </section>

        {/* Quick Contact Cards */}
        <section className="section container" style={{ paddingBottom: 0 }}>
          <div className="contact-cards-grid">
            <div className="contact-card-tile">
              <div className="contact-card-icon">
                <FiPhone />
              </div>
              <div>
                <p className="eyebrow" style={{ fontSize: 11 }}>Direct Cell Phone</p>
                <h3 style={{ margin: "4px 0 8px" }}>{agentPhone}</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Call or text 7 days a week</p>
              </div>
              <a href={`tel:${agentPhone.replace(/\D/g, "")}`}>
                Call Now →
              </a>
            </div>

            <div className="contact-card-tile">
              <div className="contact-card-icon">
                <FiMail />
              </div>
              <div>
                <p className="eyebrow" style={{ fontSize: 11 }}>Direct Email</p>
                <h3 style={{ margin: "4px 0 8px", fontSize: 16 }}>{agentEmail}</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Fast email responses & inquiries</p>
              </div>
              <a href={`mailto:${agentEmail}`}>
                Send Email →
              </a>
            </div>

            <div className="contact-card-tile">
              <div className="contact-card-icon">
                <FiMapPin />
              </div>
              <div>
                <p className="eyebrow" style={{ fontSize: 11 }}>Brokerage & Hub</p>
                <h3 style={{ margin: "4px 0 8px", fontSize: 16 }}>Redfin • 1 Montgomery St</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Ste 800, San Francisco, CA 94104</p>
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=1+Montgomery+St+Ste+800+San+Francisco+CA+94104"
                target="_blank"
                rel="noreferrer"
              >
                Get Directions →
              </a>
            </div>
          </div>
        </section>

        {/* Contact Details + Interactive Lead Form */}
        <section className="container section two" style={{ paddingTop: 20 }}>
          <div>
            <p className="eyebrow">Direct Representation</p>
            <h2 style={{ fontSize: 38, margin: "12px 0 16px" }}>
              Start Your Conversation Today
            </h2>
            <p className="muted" style={{ lineHeight: 1.8, fontSize: 16 }}>
              Gurmeet Singh delivers focused, high-touch service tailored to your timeline. Reach out directly for advice on current Bay Area home values, off-market opportunities, or scheduling private property showings.
            </p>

            <div style={{ marginTop: 28, display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ color: "var(--gold)", fontSize: 20, marginTop: 2 }}><FiAward /></div>
                <div>
                  <b style={{ color: "var(--navy)", fontSize: 15 }}>Licensing & Credentials</b>
                  <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 14 }}>
                    CA DRE #01479256 (Licensed since 2007) • Loan Agent #875333
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ color: "var(--gold)", fontSize: 20, marginTop: 2 }}><FiGlobe /></div>
                <div>
                  <b style={{ color: "var(--navy)", fontSize: 15 }}>Multilingual Support</b>
                  <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 14 }}>
                    English, Hindi, Punjabi, Urdu
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ color: "var(--gold)", fontSize: 20, marginTop: 2 }}><FiClock /></div>
                <div>
                  <b style={{ color: "var(--navy)", fontSize: 15 }}>Availability & Office Hours</b>
                  <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: 14 }}>
                    Monday – Sunday: 8:00 AM – 8:00 PM PST (Available 7 Days)
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ color: "var(--gold)", fontSize: 20, marginTop: 2 }}><FiCheckCircle /></div>
                <div>
                  <b style={{ color: "var(--navy)", fontSize: 15 }}>Verified Portals</b>
                  <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                    <a
                      href="https://www.zillow.com/profile/Gurmeet%20Singh"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gold)", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      Zillow Profile (80+ Reviews) <FiExternalLink />
                    </a>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <a
                      href="https://www.facebook.com/510gurmeetsingh/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gold)", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      Facebook <FiExternalLink />
                    </a>
                    <span style={{ color: "#cbd5e1" }}>•</span>
                    <a
                      href="https://www.linkedin.com/in/gurmeet-singh-2a846941"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gold)", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      LinkedIn <FiExternalLink />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28 }}>
              <Link className="btn alt" href="/home-valuation" style={{ width: "100%", justifyContent: "center" }}>
                Request a Complimentary Home Valuation
              </Link>
            </div>

            {/* Embedded Interactive Map */}
            <div style={{ marginTop: 28, borderRadius: 4, overflow: "hidden", border: "1px solid var(--line)", background: "#f8fafc" }}>
              <div style={{ padding: "10px 14px", background: "#f1f5f9", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  📍 Service Hub: Fremont & Bay Area, CA
                </span>
                <a
                  href="https://maps.google.com/maps?q=Fremont,+CA+94536"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}
                >
                  Open in Maps ↗
                </a>
              </div>
              <iframe
                title="Gurmeet Singh Fremont and Bay Area Service Map"
                style={{ width: "100%", height: 260, border: 0, display: "block" }}
                loading="lazy"
                src="https://maps.google.com/maps?q=Fremont,+CA+94536&t=&z=11&ie=UTF8&iwloc=&output=embed"
              />
            </div>
          </div>

          {/* Form Card */}
          <div className="card" style={{ boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)" }}>
            <div className="card-body" style={{ padding: 32 }}>
              <p className="eyebrow">Direct Contact Form</p>
              <h2 style={{ fontSize: 30, margin: "8px 0 20px" }}>Send a Direct Message</h2>
              <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
                Fill out the form below and Gurmeet will get back to you promptly.
              </p>
              <DirectContactForm />
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="section" style={{ background: "#f8fafc", borderTop: "1px solid var(--line)" }}>
          <div className="container">
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 36px" }}>
              <p className="eyebrow">Frequently Asked Questions</p>
              <h2 style={{ fontSize: 34, marginTop: 8 }}>Common Inquiries</h2>
            </div>
            <div className="faq-grid">
              {faqs.map((faq, idx) => (
                <div key={idx} className="faq-card">
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <FiHelpCircle style={{ color: "var(--gold)", fontSize: 20, marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <h3>{faq.q}</h3>
                      <p>{faq.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
