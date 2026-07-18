# VAHN — Next.js Headless Storefront

A fully migrated headless Next.js 14 storefront for VAHN Bespoke Teamwear, powered by the Shopify Storefront API.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local` and fill in your Shopify credentials:

```bash
# .env.local
NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your-storefront-access-token
```

**To get your Storefront API token:**
1. Go to Shopify Admin → Apps → Develop Apps
2. Create or select your app
3. Under "Configuration", enable Storefront API access
4. Under "API credentials", copy the **Storefront API access token**

### 3. Add Assets

Place these files in `/public/`:
- `logo.png` — VAHN primary colour logo (from your Shopify shop images)
- `logo-white.png` — VAHN white inverse logo
- `favicon.ico` — VAHN favicon
- `hero-poster.jpg` — Video poster frame for hero section
- `videos/main-banner-desktop.mp4` — Your hero video

> Assets can be downloaded from your Shopify Admin → Files section.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
nextjs-vahn/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (Header + Footer + CartDrawer)
│   ├── page.tsx                  # Homepage (Hero video + products)
│   ├── not-found.tsx             # 404 page
│   ├── cart/page.tsx             # Full cart page
│   ├── search/page.tsx           # Search results
│   ├── password/page.tsx         # Coming soon page
│   ├── products/[handle]/        # Product detail page
│   ├── collections/[handle]/     # Collection page with filters
│   ├── collections/page.tsx      # All collections
│   ├── blogs/[blog]/             # Blog listing
│   ├── blogs/[blog]/[article]/   # Blog article
│   └── pages/[handle]/          # Static pages (Contact, FAQ, etc.)
├── components/
│   ├── layout/
│   │   ├── Header.tsx            # Sticky transparent header
│   │   ├── Footer.tsx            # Footer with menus + newsletter
│   │   ├── CartDrawer.tsx        # Slide-in cart drawer
│   │   ├── SearchModal.tsx       # Predictive search
│   │   └── MobileNav.tsx         # Mobile navigation drawer
│   ├── home/
│   │   ├── HeroVideo.tsx         # Fullscreen video hero
│   │   ├── FeaturedProducts.tsx  # Product grid for homepage
│   │   └── MarqueeStrip.tsx      # Scrolling marquee
│   ├── product/
│   │   ├── ProductMediaGallery.tsx # Image gallery with thumbnails
│   │   └── ProductInfo.tsx       # Title, variants, add-to-cart
│   ├── collection/
│   │   ├── ProductCard.tsx       # Product card with hover
│   │   └── CollectionFilters.tsx # Faceted filter sidebar
│   └── ui/
│       ├── FAQAccordion.tsx      # Animated FAQ accordion
│       └── ContactForm.tsx       # Contact form
├── context/
│   └── CartContext.tsx           # Cart state management
├── lib/
│   └── shopify/
│       ├── client.ts             # Shopify GraphQL client
│       ├── queries.ts            # All GraphQL queries/mutations
│       ├── index.ts              # API helper functions
│       └── types.ts              # TypeScript types
└── styles/
    └── globals.css               # VAHN brand design system
```

## Pages

| Route | Description |
|---|---|
| `/` | Homepage with hero video and featured products |
| `/products/[handle]` | Product detail with gallery, variants, add to cart |
| `/collections/[handle]` | Collection with filters and sort |
| `/collections` | All collections listing |
| `/cart` | Full cart page |
| `/search?q=` | Search results |
| `/blogs/[blog]` | Blog listing |
| `/blogs/[blog]/[article]` | Blog article |
| `/pages/contact` | Contact form |
| `/pages/faqs-page` | FAQ accordion |
| `/pages/catalogue-page` | Catalogue download |
| `/pages/[handle]` | Any other static page |
| `/password` | Coming soon page |

## Brand

| Token | Value |
|---|---|
| Primary (Maroon) | `#a42325` |
| Secondary (Navy) | `#3a3699` |
| Heading font | Tilt Warp |
| Body font | Instrument Serif |
| UI font | Urbanist |
| Accent font | Dela Gothic One |

## Deployment

Deploy to Vercel:
```bash
npm i -g vercel
vercel --prod
```

Set environment variables in the Vercel dashboard.

## Shopify Setup Notes

- **Checkout**: Uses Shopify's native hosted checkout (`cart.checkoutUrl`)
- **Cart**: Persisted in `localStorage` using the Storefront Cart API
- **Images**: Served from `cdn.shopify.com` via Next.js `<Image>`
- **Navigation**: Nav links are hardcoded (update `components/layout/Header.tsx` to match your Shopify navigation menus)
- **Revalidation**: Pages use ISR with cache tags — implement webhook at `/api/revalidate` if needed
