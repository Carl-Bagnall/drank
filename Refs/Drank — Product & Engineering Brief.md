# Drank — Product & Engineering Brief

## Project

Build a mobile-first web application called **Drank**.

Drank is a community-driven catalogue and collection app for soft drinks.

The simplest description of the product is:

> **"Discogs for soft drinks."**

Users can discover soft drinks, add them to their personal collection, rate them, and eventually contribute new drinks to the global catalogue.

The application should feel like a mixture of:
- A product catalogue
- A personal collection tracker
- A rating/review platform
- A lightweight social/collector experience

The initial target audience is people who enjoy discovering unusual soft drinks, different flavours, regional variants, limited editions, and products from both major brands and small independent producers.

The application should be designed **mobile-first**, but should work well on desktop.

---

# Product principles

1. The global drink catalogue and a user's personal collection are separate concepts.
2. A drink should exist once in the global catalogue, even if thousands of users collect it.
3. Users can contribute drinks that do not exist in the catalogue.
4. External APIs should help populate data but must never be required for the application to function.
5. The product should feel fun and collectible rather than corporate or overly serious.
6. The interface should prioritise imagery, discovery and fast interactions.
7. The MVP should be simple enough to launch quickly but architected so that social features, barcode scanning, statistics and gamification can be added later.
8. Avoid over-engineering the first version.
9. Build reusable components and a clean data model.
10. Do not introduce unnecessary third-party services when Cloudflare's native services can provide the functionality.

---

# Core MVP functionality

## 1. User accounts

Users should be able to:
- Create an account
- Log in
- Log out
- View their profile
- Have a private personal collection

Use a simple authentication architecture appropriate for a Cloudflare-hosted application.

Do not build social login initially unless there is a compelling reason.

---

# 2. Drink catalogue

Create a global drinks catalogue.

A drink should support at least:

- id
- name
- brand
- flavour
- category
- country
- region
- volume
- packaging type
- barcode
- description
- image URL
- caffeine status
- sugar status
- created date
- updated date
- created by user
- external source
- external source ID
- status

Do not assume that every field will be populated.

The database must support incomplete products.

For example, a user-created drink may initially only have:

- Name
- Brand
- Flavour
- Image

That is acceptable.

---

# 3. User collection

A user's collection should reference a drink rather than duplicate the drink record.

A collection entry should support:

- id
- user ID
- drink ID
- date added
- personal rating
- personal notes
- favourite status

A user must not be able to add the exact same drink to their collection twice.

If they try, show an appropriate message and take them to the existing collection entry.

---

# 4. Ratings

Users should be able to rate a drink from:

**0–10**

Allow half-point ratings.

Examples:

- 7
- 7.5
- 8
- 8.5
- 9

The user's personal rating should be separate from the global/community rating.

Calculate community rating from submitted user ratings.

Do not store a permanently calculated aggregate unless there is a clear performance reason.

The UI should prominently show:

**Your rating**

and

**Community rating**

as separate concepts.

---

# 5. Drink detail page

Every drink should have a dedicated detail page.

It should display:

- Product image
- Drink name
- Brand
- Flavour
- Category
- Country
- Volume
- Community rating
- Number of ratings
- User's rating if they have rated it
- Add/remove from collection
- Personal notes if collected
- Basic product information

Example:

Coca-Cola Cherry

Coca-Cola  
Cherry  
330ml · UK

8.4 / 10

1,248 ratings

Your rating: 9 / 10

[Add to collection]

The page should be visually strong and mobile-friendly.

---

# 6. Search and discovery

Create a Discover page.

Users should be able to search drinks by:

- Drink name
- Brand
- Flavour
- Category
- Country

Start with a simple search experience.

Do not build an overly complicated search engine for the MVP.

Search results should display:

- Image
- Name
- Brand
- Flavour
- Rating
- Collection status

Provide basic filtering where practical.

---

# 7. Add a drink

Users must be able to manually create a drink.

Create an "Add drink" flow.

Fields:

Required:
- Drink name
- Brand

Optional:
- Flavour
- Category
- Country
- Volume
- Packaging
- Barcode
- Description
- Image

The user should be able to create the drink even when only the required fields are available.

After creation, offer:

**Add to my collection**

and optionally:

**Rate it**

---

# 8. External product lookup

Integrate **Open Food Facts** as an optional external data source.

Use it to:
- Look up products by barcode
- Potentially search for products
- Pre-fill information when available
- Retrieve product images where appropriate

Do not make Open Food Facts the source of truth.

Create an abstraction/service layer such as:

`ProductDataProvider`

so that the application can eventually support additional providers.

The internal Drank catalogue must remain independent of the external API.

If an external API lookup fails, the application should gracefully fall back to manual entry.

Never prevent a user from adding a drink because an API is unavailable.

Use the current Open Food Facts API documentation when implementing the integration.

Respect API requirements, including appropriate identification/User-Agent behaviour.

Do not scrape websites.

---

# 9. Barcode scanning

Design the architecture so barcode scanning can be added cleanly.

For the MVP, if reliable browser-based barcode scanning can be implemented without excessive complexity, support it.

Otherwise:

Create the UI and service abstraction for barcode lookup but do not compromise the rest of the MVP.

The intended future flow is:

Scan barcode
→ Look up product
→ Show matched product
→ Confirm
→ Add to collection
→ Rate

If the barcode is not found:

"No drink found"

[Create it manually]

Do not treat an unknown barcode as an error condition.

---

# 10. Collection page

Create a dedicated Collection page.

Display:

- Total drinks collected
- Total brands
- Total countries
- Average rating
- Recently added drinks

Allow the collection to be viewed as a responsive grid.

Each card should show:

- Product image
- Drink name
- Brand
- User rating

Provide sorting:

- Recently added
- Highest rated
- Lowest rated
- Name

Provide basic filtering:

- Brand
- Category
- Country

The collection should remain fast even with hundreds or thousands of drinks.

Use pagination or appropriate lazy loading where required.

---

# 11. Profile

Create a simple profile page.

Display:

- Username
- Collection count
- Brand count
- Country count
- Average rating
- Favourite drinks

Do not build a full social network yet.

Structure the data so public profiles and following users could be introduced later.

---

# Database architecture

Use **Cloudflare D1**.

Use migrations rather than creating tables manually.

Create a clean relational schema.

At minimum consider:

`users`

`drinks`

`collection_entries`

`ratings`

`drink_images`

Potentially:

`brands`

`categories`

`countries`

Do not normalise everything unnecessarily.

Prefer a pragmatic schema that is easy to query and evolve.

Important relationships:

User
→ Collection Entries
→ Drink

User
→ Ratings
→ Drink

Drink
→ Brand

Drink
→ Images

A user's collection entry and rating should remain conceptually separate even if they are initially presented together in the UI.

---

# Data integrity

Implement:

- Foreign keys where appropriate
- Unique constraints
- Appropriate indexes
- Validation at API and database boundaries
- Sanitisation of user-generated content
- Protection against duplicate catalogue records where possible

Barcode values should be treated as identifiers but should not be assumed to exist for every product.

Do not make barcode mandatory.

---

# API architecture

Create a clear backend API.

Suggested routes:

`GET /api/drinks`

`GET /api/drinks/:id`

`POST /api/drinks`

`PUT /api/drinks/:id`

`GET /api/search`

`GET /api/users/me`

`GET /api/users/me/collection`

`POST /api/users/me/collection`

`DELETE /api/users/me/collection/:drinkId`

`POST /api/drinks/:id/rating`

`GET /api/drinks/:id/ratings`

`GET /api/products/barcode/:barcode`

Keep API logic separate from UI components.

Do not put database queries directly inside presentation components.

---

# Frontend architecture

Use:

- React
- TypeScript
- Vite
- Tailwind CSS

Build reusable components.

Suggested components:

`DrinkCard`

`Rating`

`RatingInput`

`DrinkGrid`

`SearchBar`

`FilterSheet`

`CollectionStats`

`DrinkImage`

`AddDrinkForm`

`BottomNavigation`

`EmptyState`

`LoadingState`

`ErrorState`

Use a mobile-first responsive design.

---

# Navigation

The primary mobile navigation should be:

**Home**
**Discover**
**Scan**
**Collection**
**Profile**

The Scan action can be visually emphasised because it represents an important future interaction.

If barcode scanning is not implemented in the first iteration, the Scan screen should explain that scanning is coming soon rather than leaving a broken interaction.

---

# UX direction

The application should feel:

- Fun
- Collectible
- Modern
- Slightly playful
- Fast
- Image-led
- Simple

Avoid:

- Corporate dashboards
- Excessive gradients
- Generic SaaS styling
- Excessive cards within cards
- Huge amounts of text
- Complex navigation
- Overly gamified interfaces

The product should feel like something someone would genuinely enjoy using while standing in a shop looking at an interesting drink.

Mobile interaction is extremely important.

Buttons should be comfortable to tap.

Forms should use appropriate mobile input types.

Bottom navigation should remain accessible.

---

# Visual design

Establish a coherent design system before building every screen.

Define:

- Typography
- Spacing
- Border radius
- Shadows
- Buttons
- Form controls
- Cards
- Rating components
- Navigation
- Modal/bottom sheets
- Empty states
- Loading states
- Error states

Do not make the interface visually generic.

The brand name **Drank** should inform the identity.

Explore a distinctive typographic/logo treatment using the word:

**drank**

Keep the branding simple enough that it works as:
- Website header
- Mobile app icon
- Favicon
- Social avatar

Do not spend excessive development time on branding before the product works.

---

# Image handling

The product catalogue is image-led.

For the initial version, allow image URLs.

Architect the application so uploaded images can later be stored in **Cloudflare R2**.

Do not store large binary image data directly in D1.

Images should:
- Maintain sensible aspect ratios
- Use responsive sizing
- Have appropriate alt text
- Have graceful placeholders when unavailable
- Use lazy loading where appropriate

---

# Future features

Do NOT implement all of these in the MVP.

However, design the architecture so they can be added later:

## Gamification

Achievements such as:

- First Sip
- 50 Drinks
- 100 Drinks
- 500 Drinks
- 10 Countries
- Cola Connoisseur
- Brand Hoarder
- Cherry Picker

## Statistics

Examples:

- Drinks collected
- Brands collected
- Countries
- Average rating
- Favourite category
- Favourite brand
- Most common flavour
- Highest-rated drink
- Lowest-rated drink

## Community

Eventually:

- Public profiles
- Following
- Activity feeds
- Reviews
- Likes
- Comments
- Community rankings
- Trending drinks

## Discovery

Eventually:

- Popular drinks
- New drinks
- Trending drinks
- Highly rated drinks
- Hidden gems
- Random drink
- Drinks from a particular country
- Drinks by flavour

## Collection goals

Eventually:

> Try 10 cherry drinks

> Collect 25 different cola variants

> Try a drink from 20 countries

## Product lifecycle

Support the possibility of:

- Current
- Discontinued
- Limited edition
- Seasonal
- Regional
- Unknown

Do not necessarily expose all of this in the MVP.

---

# Security

Treat all user input as untrusted.

Implement:

- Authentication checks
- Authorisation checks
- Input validation
- Rate limiting where appropriate
- Safe database queries
- Protection against injection
- Safe image handling
- No secrets committed to GitHub
- Environment variables for configuration

Never expose API keys to the browser.

External API calls that require secrets should happen server-side.

---

# Cloudflare deployment

The application should be designed for deployment on Cloudflare.

Use:

- Cloudflare Workers for application/server functionality
- Cloudflare D1 for the database
- Cloudflare R2 for future image storage

Use Wrangler for local development and deployment.

Create the appropriate:

`wrangler.jsonc`

configuration.

The repository should contain clear setup instructions for:

1. Installing dependencies
2. Running locally
3. Creating the D1 database
4. Running migrations
5. Configuring environment variables
6. Running the Cloudflare development environment
7. Deploying to Cloudflare

The project should be compatible with GitHub-based deployment.

Do not hard-code Cloudflare account IDs, database IDs, tokens or secrets.

---

# Git workflow

Keep commits small and meaningful.

Use commit messages such as:

`feat: add drink catalogue`

`feat: add collection management`

`feat: add drink ratings`

`fix: prevent duplicate collection entries`

Avoid giant commits containing unrelated changes.

Do not rewrite Git history or delete existing work without explicit instruction.

---

# Development approach

Do not attempt to build the entire application in one enormous implementation.

Work incrementally.

## Phase 1 — Foundation

Set up:

- React
- TypeScript
- Vite
- Tailwind
- Cloudflare
- D1
- Database migrations
- Basic application shell
- Routing
- Design system foundations

Make sure the application runs locally.

## Phase 2 — Catalogue

Build:

- Drink schema
- Drink API
- Drink cards
- Drink detail page
- Search
- Basic discovery

Seed the database with realistic sample drinks for development.

Use fictional/sample data if necessary.

## Phase 3 — Accounts & collection

Build:

- Authentication
- User profile
- Collection
- Add/remove drink
- Collection sorting/filtering

## Phase 4 — Ratings

Build:

- Rating input
- Personal ratings
- Community ratings
- Rating display

## Phase 5 — External product lookup

Implement Open Food Facts integration.

Start with barcode lookup.

Create a provider abstraction so the external service can be replaced later.

## Phase 6 — Polish

Improve:

- Mobile UX
- Empty states
- Loading states
- Error states
- Accessibility
- Performance
- Responsive behaviour
- Visual consistency

## Phase 7 — Deployment

Prepare:

- Production environment
- D1 production database
- Cloudflare configuration
- GitHub integration
- Production deployment

---

# Important development rules

Before writing significant amounts of code:

1. Inspect the existing repository.
2. Explain the proposed architecture briefly.
3. Identify anything that should be clarified.
4. Prefer sensible defaults rather than blocking on minor questions.
5. Build the smallest useful implementation.
6. Test each feature before moving on.
7. Do not introduce dependencies without a reason.
8. Keep the code understandable to a developer who is learning the project.
9. Avoid premature abstraction.
10. Do not build future functionality unless it is required by the current feature.

When you encounter a design or technical decision with multiple reasonable approaches, choose the simplest approach that keeps the application extensible.

---

# Testing

Implement tests for important business logic.

At minimum test:

- Creating a drink
- Preventing duplicate collection entries
- Adding/removing collection entries
- Rating a drink
- Calculating community rating
- Searching drinks
- Barcode lookup handling
- Unauthenticated requests
- Invalid input

Also perform basic end-to-end testing of the primary user journey:

**Create account → Discover drink → Add to collection → Rate drink → View collection**

---

# Accessibility

Target WCAG 2.2 AA where practical.

Pay particular attention to:

- Colour contrast
- Keyboard navigation
- Focus states
- Form labels
- Screen-reader labels
- Touch target sizes
- Error messaging
- Image alt text
- Reduced motion

Do not rely solely on colour to communicate ratings or statuses.

---

# Performance

The application should feel fast on mobile connections.

Consider:

- Lazy-loading images
- Optimised images
- Small JS bundles
- Pagination
- Efficient database queries
- Appropriate indexes
- Avoiding unnecessary API requests
- Caching external product lookups where appropriate

---

# Seed data

Create development seed data representing a mixture of:

Major brands:
- Coca-Cola
- Pepsi
- Fanta
- Sprite
- Dr Pepper
- 7UP
- Mountain Dew
- Irn-Bru
- Red Bull

And smaller/independent brands.

Include multiple flavours for the same brand so the catalogue demonstrates the concept of collecting variants.

For example:

Coca-Cola
Coca-Cola Zero Sugar
Coca-Cola Cherry
Coca-Cola Vanilla

These are separate drinks in the catalogue.

Do not assume brand = drink.

---

# Definition of done for MVP

The MVP is complete when a user can:

1. Open Drank on a mobile device.
2. Create an account.
3. Search the catalogue.
4. Open a drink.
5. Add it to their collection.
6. Give it a rating.
7. See their rating.
8. See the community rating.
9. Browse their collection.
10. Create a drink manually if it does not exist.
11. Optionally populate a new drink using external product data.
12. Remove a drink from their collection.
13. View basic collection statistics.
14. Use the application comfortably on desktop and mobile.
15. Run the application locally.
16. Deploy the application to Cloudflare.
17. Push changes to GitHub and have the production/preview deployment workflow work correctly.

---

# First task

Do NOT immediately build every feature in this document.

Start by:

1. Inspecting the repository.
2. Determining whether the repository is empty or already contains an application.
3. Proposing the initial project structure.
4. Proposing the D1 schema.
5. Proposing the Cloudflare architecture.
6. Identifying the minimum dependencies required.
7. Setting up the initial application.
8. Getting a basic mobile-first Drank shell running locally.
9. Creating the first database migration.
10. Creating realistic seed data.
11. Verifying that the application runs successfully.

After completing the foundation, stop and report:

- What was created
- How to run it locally
- What database tables exist
- What remains to build
- Any decisions that need my input

Do not continue automatically into every future phase.

The priority is to establish a clean, working foundation that we can build on iteratively.