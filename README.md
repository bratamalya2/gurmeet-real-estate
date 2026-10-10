# HomesByGurmeet

Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then run `npm.cmd install` and `npm.cmd run dev`. For Docker, run `docker compose up --build`.

The API is at `http://localhost:4000`; the web app is at `http://localhost:3000`. Add the bootstrap admin values before signing in.

## API documentation

The backend OpenAPI 3.0 document is at `apps/api/openapi.yaml`. Import it into [Swagger Editor](https://editor.swagger.io/) or your preferred API client to browse and test the API. For authenticated endpoints, sign in through `POST /api/auth/login` first so the client retains the `hbg_session` cookie.

## Authorized Decodo scraping

`POST /api/admin/scrape` uses Decodo Scraper API only for HTTPS hosts explicitly listed in the backend `AUTHORIZED_SCRAPE_HOSTS` environment variable. Set `DECODO_SCRAPER_BASIC_TOKEN` to the rotated Basic-auth token value supplied by Decodo, without the `Basic ` prefix. The raw provider response is never stored in MongoDB; the endpoint returns a bounded preview for an administrator to inspect.

## Workbook import

The Docker MongoDB service runs as a one-node replica set (`rs0`) so the complete listing replacement is transactional. Set `MONGODB_URI=mongodb://mongo:27017/homesbygurmeet?replicaSet=rs0` in the API environment before starting the stack.

The command-line importer uses the same parser and replacement logic: `docker compose run --rm api npm run import:workbook -- "/app/data/Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx"`.

The Admin dashboard **Sync** tab accepts `Homes By Gurmeet — Bought & Sold Photos (251 listings).xlsx`. The workbook is validated completely before one transaction stores its snapshot and replaces the public `Property` collection. Every valid portfolio row is retained, including distinct rows with the same address. Properties absent from the workbook are removed.

For matching properties, the import preserves listing fields that are not present in the workbook, such as price, dimensions, coordinates, descriptions, and transaction dates. Unmatched rows are created as sold properties with empty unavailable fields. The workbook supplies the title, address, image, buyer/seller classification, verification metadata, and portfolio source information.

The Admin dashboard **Analytics** tab reports current inventory, pricing, lead activity, workbook freshness, and first-party page/listing views. Traffic events are anonymous, contain no query strings or personal data, and are retained for 24 months.
