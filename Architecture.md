# Technical Architecture

## 1. Technology Stack
Built utilizing standard full-stack JavaScript architectures optimized for high-performance and scalable web applications:
* **Frontend:** React.js, JavaScript, HTML5, CSS3/Tailwind CSS
* **Backend:** Node.js with Express.js
* **Database:** MongoDB (NoSQL document structure is highly flexible for handling diverse property attributes and unstructured scraped data).
* **Scraping Engine:** Custom Node.js microservice utilizing libraries like Puppeteer or Cheerio, integrated with a third-party residential proxy provider (e.g., Bright Data, Smartproxy).

## 2. System Components

### 2.1 Client Application (Frontend)
* Built as a Single Page Application (SPA) or Server-Side Rendered (SSR) app using React.
* Communicates with the Backend via RESTful JSON APIs.
* Implements responsive design principles for seamless mobile, tablet, and desktop experiences.

### 2.2 API Gateway & Application Server (Backend)
* **Node.js/Express.js Server:** Handles all incoming API requests from the frontend.
* **Authentication:** JWT (JSON Web Tokens) for securing the Admin Dashboard.
* **Business Logic Layer:** Processes form submissions, triggers email notifications, and handles database CRUD operations for manual listings.

### 2.3 Data Ingestion Service (Scraping API)
* A specialized, decoupled Node.js service responsible for data extraction.
* **Workflow:**
    1. Initiates HTTP requests routed through a Residential Proxy Pool.
    2. Targets specific Zillow and Redfin URLs belonging to the client.
    3. Parses the DOM/JSON payloads to extract listing data (Sold/Unsold).
    4. Normalizes the data format.
    5. Upserts (Update or Insert) the records into the MongoDB database.

### 2.4 Database (MongoDB)
* **Collections:**
    * `Users` (Admin credentials)
    * `Properties` (Manual and Scraped listings, including status, images, price, source)
    * `Leads` (Form submissions)
    * `SystemLogs` (Scraping job statuses)

## 3. Future Integration (IDX/MLS)
* The architecture is designed with a standard abstraction layer for property data.
* When MLS/IDX credentials are provided and fees paid, a new data ingestion service will be connected to the MLS RETS/WebAPI feed, mapping the official data into the existing `Properties` collection schema without disrupting the frontend UI.
