# Business Logic: HomesByGurmeet.com

## 1. Overview
The core business logic of the platform revolves around real estate lead generation, automated property showcasing, and seamless client-agent communication. The system serves as a digital storefront and an automated operational tool for the real estate agent.

## 2. Core Business Workflows

### 2.1 Lead Generation & Routing
* **Workflow:** A prospective buyer or seller visits the site and fills out a form (Property Inquiry, Schedule-a-Showing, or Home Valuation).
* **Logic:** Upon submission, the system validates the data, stores the lead information in the database, and instantly dispatches an email/SMS notification to the Admin (Agent).

### 2.2 Property Listing Management
* **Manual Workflow:** The Admin logs into the dashboard to manually create, read, update, or delete (CRUD) property listings.
* **Logic:** Changes made in the dashboard immediately update the database and reflect on the public-facing Property Listings page. Listing statuses (e.g., 'Active', 'Pending', 'Sold') dictate which category the property appears in.

### 2.3 Automated Property Ingestion (Scraping Pipeline)
* **Workflow:** The system autonomously fetches the agent's properties from third-party platforms (Zillow and Redfin) to reduce manual data entry.
* **Logic:** 
    1. A scheduled job triggers a specific API call.
    2. The request is routed through a residential proxy network to prevent IP blocking or rate limiting.
    3. The scraper targets the agent's specific profiles/listings on Zillow and Redfin.
    4. Extracted data (price, status, description, images) is parsed, standardized, and stored/updated in the application database.
    5. Properties are automatically categorized as 'Sold' or 'Unsold' based on the scraped status.

### 2.4 MLS/IDX Integration (Future Phase)
* **Logic:** Upon client provision of approved credentials and fee payments, the proprietary scraping pipeline will be supplemented or replaced by official IDX/MLS data feeds for real-time market-wide listing synchronization.
