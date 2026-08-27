# Functional Requirements

## 1. User Roles
* **Guest User:** Any public visitor to the website.
* **Admin:** The real estate agent (Gurmeet) or designated staff.

## 2. Guest User Capabilities
* **Navigation:** Access Home, About Us, Contact Us, and Services pages.
* **Property Viewing:** View properties categorized by 'Homes for Sale', 'Recently Sold', and 'Featured Properties'.
* **Form Submission:** 
    * Submit a 'Property Inquiry Form' on specific listings.
    * Submit a 'Schedule-a-Showing Form' selecting preferred dates/times.
    * Submit a 'Home Valuation Request Form' providing property address and details.
* **External Links:** Navigate to the agent's Google, Zillow, and Redfin review profiles via dedicated links.

## 3. Admin Capabilities (Dashboard)
* **Authentication:** Secure login to the Admin Dashboard.
* **Listing Management:** Add, edit, update, or remove manual property listings, including photographs, prices, descriptions, and statuses.
* **Lead Management:** View details of submitted forms (Inquiries, Showings, Valuations).
* **Scraper Configuration:** View logs or manually trigger the Zillow/Redfin scraping API.

## 4. System Functions
* **Automated Scraping Engine:** The system must periodically (e.g., daily) invoke a specific API to scrape the client's Zillow and Redfin pages.
* **Proxy Management:** The scraping engine must route requests through rotating residential proxies.
* **Data Synchronization:** The system must parse scraped data, identify new vs. existing listings, update statuses (e.g., Unsold to Sold), and store them in the primary database.
* **Responsive Rendering:** The UI must dynamically adapt layouts for mobile, tablet, and desktop viewports.
