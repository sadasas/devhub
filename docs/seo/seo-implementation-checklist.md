# DevHub SEO Implementation Checklist

**Quick-Reference Guide** | Created: 2026-09-03 | **Last updated:** 2026-09-24

> **Lampiran Tier-2.** Dokumen ini adalah lampiran [Go-Live Checklist Tier-2](../05-operations/go-live-checklist-tier2.md) (§3 view-source canonical/OG/`lang=id`, §4 robots/sitemap tanpa `/p/*`, §5 GSC). Domain kanonis prod `https://devhub.nrawangbatin.my.id` (bukan `devhub.com`). Harga kanonis IDR seed `249000`/`699000`/`2490000` + `LAUNCH149 149000` (nonaktif) via Pakasir QRIS/VA — semua copy memakai IDR, bukan USD. Riset kata kunci (termasuk klaster ID/QRIS): [Keyword Research](keyword-research-landing-page.md).

---

## 🎯 Priority Keywords (Top 10)

Focus on these first — highest impact, achievable difficulty.

| # | Keyword | Volume | KD | Target Page | Status |
|---|---------|--------|----|-------------|--------|
| 1 | `project management for developers` | 8,100 | 68 | Homepage | ⬜ |
| 2 | `technical documentation tools` | 3,600 | 45 | Homepage | ⬜ |
| 3 | `architecture decision record template` | 1,300 | 38 | /features/adr | ⬜ |
| 4 | `database schema documentation tool` | 1,600 | 42 | /features/schema | ⬜ |
| 5 | `tech stack tracker for teams` | 590 | 32 | /features/tech-stack | ⬜ |
| 6 | `tools for engineering team collaboration` | 2,200 | 55 | Homepage | ⬜ |
| 7 | `how to document architectural decisions` | 1,300 | 40 | FAQ + Blog | ⬜ |
| 8 | `project management software free trial` | 4,400 | 68 | /pricing | ⬜ |
| 9 | `technical memory for engineering teams` | 170 | 22 | Homepage | ⬜ |
| 10 | `ERD diagram generator for teams` | 2,400 | 45 | /features/schema | ⬜ |

---

## ✅ Pre-Launch Checklist

### Technical SEO
- [x] Install Google Analytics 4 (DONE Sep-2026 — consent-gated via `consent.ts`, bake-time `VITE_GA_MEASUREMENT_ID`; lihat go-live §1)
- [ ] Install Google Search Console (verify domain)
- [x] Generate XML sitemap (`/sitemap.xml`, Tier-2 tanpa `/p/*` — DONE; lihat go-live §4)
- [x] Create `robots.txt` (Tier-2: `Allow: /`, `Disallow: /p/`, sitemap absolut — DONE; lihat go-live §4)
- [x] Implement canonical tags on all pages (DONE — domain prod; lihat go-live §3)
- [ ] Set up 301 redirects (if migrating from old URLs)
- [x] Enable HTTPS (DONE — Suga TLS + Cloudflare CDN/WAF)
- [x] Test mobile-friendliness (DONE — Batch 10 mobile support, lihat audit UI-UX)
- [ ] Check Core Web Vitals (PageSpeed Insights — gate go-live §6 per rilis)
- [ ] Implement structured data (JSON-LD)

### On-Page SEO (Per Page)
- [ ] Unique meta title (50–60 chars)
- [ ] Unique meta description (150–160 chars)
- [ ] Single H1 per page (includes primary keyword)
- [ ] H2-H3 hierarchy (logical outline)
- [ ] Internal links (3–5 per page)
- [ ] External links to authoritative sources (2–3 per page)
- [ ] Image alt text (descriptive, includes keywords where natural)
- [ ] Compressed images (<100KB, WebP/AVIF format)
- [ ] Open Graph tags (og:title, og:description, og:image)
- [ ] Twitter Card tags (twitter:card, twitter:title, etc.)

### Schema Markup (JSON-LD)
- [ ] Organization schema (homepage)
- [ ] SoftwareApplication schema (homepage)
- [ ] Product schema (pricing page)
- [ ] FAQPage schema (FAQ page)
- [ ] Article schema (blog posts)
- [ ] BreadcrumbList schema (all pages)

---

## 📄 Meta Tags Implementation

### Homepage
```html
<title>DevHub | Project Management for Developers & Engineering Teams</title>
<meta name="description" content="Track tasks, bugs, test cases, tech stack, schema, and architectural decisions in one workspace. Built for engineering teams from solo builders to 2,000 engineers.">
<link rel="canonical" href="https://devhub.nrawangbatin.my.id/">
```

### Features / Schema
```html
<title>Database Schema Documentation Tool | DevHub ERD Generator</title>
<meta name="description" content="Visual database schema designer with ERD diagrams, pan & zoom, and version control. Document tables, columns, and relationships for your engineering team.">
<link rel="canonical" href="https://devhub.nrawangbatin.my.id/features/schema">
```

### Features / ADR
```html
<title>Architecture Decision Record (ADR) Log | DevHub</title>
<meta name="description" content="Record architectural decisions with context, options, and consequences. Never lose technical knowledge. Built for software teams who document everything.">
<link rel="canonical" href="https://devhub.nrawangbatin.my.id/features/adr">
```

### Features / Tech Stack
```html
<title>Tech Stack Tracker for Engineering Teams | DevHub</title>
<meta name="description" content="Track technology versions, dependencies, and upgrade status. Maintain a living ledger of your stack. Perfect for teams managing multiple projects.">
<link rel="canonical" href="https://devhub.nrawangbatin.my.id/features/tech-stack">
```

### Pricing
```html
<title>DevHub Pricing | Free Project Management for Developers</title>
<meta name="description" content="Free forever for small teams (2 members, 3 projects). Pro Rp 249.000/30 hari via QRIS/VA Pakasir. No per-seat tax. Start free trial today — no credit card.">
<link rel="canonical" href="https://devhub.nrawangbatin.my.id/pricing">
```

### FAQ
```html
<title>FAQ | DevHub Project Management for Engineering Teams</title>
<meta name="description" content="Answers to common questions about DevHub: How is it different from Jira? Can I export data? Is there a free plan? Technical documentation for developers.">
<link rel="canonical" href="https://devhub.nrawangbatin.my.id/faq">
```

---

## 🏗️ Schema Markup Templates

### Organization + SoftwareApplication (Homepage)
```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "DevHub",
  "applicationCategory": "ProjectManagementApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "IDR"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "127"
  },
  "description": "Project management for developers. Track tasks, bugs, test cases, tech stack, schema, and architectural decisions.",
  "featureList": "Task Board, Issue Tracking, Test Cases, Schema ERD, ADR Log, Tech Stack Tracker",
  "audience": {
    "@type": "Audience",
    "audienceType": "Engineering Teams"
  }
}
</script>
```

### FAQPage (FAQ Page)
```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How is DevHub different from Jira or Linear?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "DevHub is built specifically for engineering teams who need technical depth — schema management, ADR logging, tech stack tracking — that general-purpose PM tools don't provide. Think of it as a complementary layer, not a replacement."
      }
    },
    {
      "@type": "Question",
      "name": "Can I export my data if I want to leave?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. DevHub provides full JSON export/import for all projects. You own your data and can export it at any time."
      }
    },
    {
      "@type": "Question",
      "name": "Is there a free plan?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. The Free plan includes 3 projects, 2 team members, and all core features. Free forever — no credit card required."
      }
    }
  ]
}
</script>
```

### Product (Pricing Page)
```json
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "DevHub Pro",
  "description": "Professional project management for engineering teams",
  "offers": {
    "@type": "Offer",
    "price": "249000",
    "priceCurrency": "IDR",
    "priceValidUntil": "2027-01-01",
    "availability": "https://schema.org/InStock"
  }
}
</script>
```

---

## 🔗 Internal Linking Map

### Homepage → Feature Pages
```
Homepage H1: "Project Management for Developers"
  ├─ Link to /features/schema (anchor: "database schema documentation")
  ├─ Link to /features/adr (anchor: "architectural decision records")
  ├─ Link to /features/tech-stack (anchor: "tech stack tracking")
  ├─ Link to /features/test-cases (anchor: "test case management")
  ├─ Link to /features/issues (anchor: "issue tracking")
  └─ Link to /pricing (anchor: "start free trial")
```

### Feature Pages → Homepage + Siblings
```
/features/schema
  ├─ → Homepage (anchor: "DevHub features")
  ├─ → /features/adr (anchor: "document why you chose this schema")
  ├─ → /features/tech-stack (anchor: "track technologies")
  └─ → Blog: "ERD Diagram Tutorial"

/features/adr
  ├─ → Homepage (anchor: "technical memory features")
  ├─ → /features/schema (anchor: "connect to data model")
  ├─ → /features/tech-stack (anchor: "document technology choices")
  └─ → Blog: "ADR Template Guide"

/features/tech-stack
  ├─ → Homepage (anchor: "all features")
  ├─ → /features/adr (anchor: "record technology decisions")
  ├─ → /features/schema (anchor: "map to database")
  └─ → Blog: "Dependency Management Guide"
```

### Blog → Product Pages
```
Every blog post should include:
  ├─ 1 link to relevant feature page (contextual)
  ├─ 1 link to homepage (brand anchor)
  └─ 1 link to pricing (if commercial intent)
```

---

## 📝 Content Implementation Order

### Week 1: Foundation
- [ ] Homepage (optimize H1, subhead, CTAs)
- [ ] /features/schema (full page content)
- [ ] /features/adr (full page content)
- [ ] /features/tech-stack (full page content)
- [ ] Submit sitemap to Search Console

### Week 2: Conversion Pages
- [ ] /pricing (optimize for transactional keywords)
- [ ] /faq (implement FAQ schema)
- [ ] /features/test-cases
- [ ] /features/issues
- [ ] Build internal links between all pages

### Week 3–4: Blog Launch
- [ ] Pillar Post 1: "Project Management for Developers: Ultimate Guide"
- [ ] Pillar Post 2: "Database Schema Documentation Best Practices"
- [ ] Cluster Post 1: "ADR Template + Examples"
- [ ] Cluster Post 2: "ERD Diagram Tutorial"
- [ ] Interlink all blog posts + product pages

### Week 5–8: Authority Building
- [ ] Pillar Post 3: "Complete Guide to Architecture Decision Records"
- [ ] Cluster Posts 3–6 (see content calendar)
- [ ] Guest post outreach (5–10 sites)
- [ ] Monitor rankings + adjust content

---

## 🚫 Cannibalization Prevention

**BEFORE publishing ANY page:**

1. Search existing pages for target keyword in:
   - `<title>` tag
   - `<h1>` heading
   - Meta description
   - First 100 words of content

2. If keyword is already used:
   - ✅ Use long-tail modifier (e.g., add "for startups", "free", "template")
   - ✅ Make it a secondary keyword (not primary)
   - ✅ Link to the existing page instead (consolidate authority)
   - ❌ Do NOT create competing content

3. Keyword ownership (DO NOT duplicate):

| Keyword | Owner | Do Not Use On |
|---------|-------|---------------|
| `project management for developers` | Homepage | Feature pages (use as secondary only) |
| `database schema documentation tool` | /features/schema | Homepage, Blog (use modifiers) |
| `architecture decision record template` | /features/adr | All other pages |
| `tech stack tracker for teams` | /features/tech-stack | All other pages |
| `project management software free trial` | /pricing | Homepage (CTA copy only) |

---

## 📊 Tracking Setup

### Google Analytics 4 Events
```javascript
// Track CTA clicks
gtag('event', 'click', {
  event_category: 'CTA',
  event_label: 'Start Free Trial',
  value: 1
});

// Track feature page engagement
gtag('event', 'page_view', {
  event_category: 'Engagement',
  event_label: 'Schema Feature Page',
  value: 1
});

// Track form submissions (signup)
gtag('event', 'submit', {
  event_category: 'Form',
  event_label: 'Signup Form',
  value: 1
});
```

### Search Console Queries to Monitor
- `project management for developers`
- `technical documentation tools`
- `database schema documentation`
- `architecture decision record`
- `devhub` (branded)

### Ranking Tracking Spreadsheet
| Keyword | Current Position | Target Position | Week 1 | Week 2 | Week 3 | Week 4 |
|---------|-----------------|-----------------|--------|--------|--------|--------|
| project management for developers | — | 10 | | | | |
| technical documentation tools | — | 10 | | | | |
| database schema documentation tool | — | 10 | | | | |

---

## 🎯 Success Metrics (90 Days)

| Metric | Baseline | Target | Stretch |
|--------|----------|--------|---------|
| Organic sessions/month | 0 | 500 | 1,000 |
| Keyword rankings (top 20) | 0 | 15 | 25 |
| Keyword rankings (top 10) | 0 | 8 | 15 |
| Organic signups/month | 0 | 20 | 40 |
| Backlinks earned | 0 | 10 | 25 |
| Blog post avg. traffic | 0 | 100/post | 250/post |

---

## 🔧 Tools Required

| Tool | Purpose | Cost | Priority |
|------|---------|------|----------|
| Google Search Console | Index monitoring, query data | Free | P0 |
| Google Analytics 4 | Traffic tracking | Free | P0 |
| Ahrefs / SEMrush | Keyword research, competitor analysis | $99/mo | P1 |
| Screaming Frog | Technical audit | Free (500 URLs) | P1 |
| PageSpeed Insights | Core Web Vitals | Free | P0 |
| Rich Results Test | Schema validation | Free | P0 |
| Looker Studio | Dashboard/reporting | Free | P2 |

---

---

## Lampiran Tier-2 — status Sep-2026

Checklist ini menginduk ke [Go-Live Checklist Tier-2](../05-operations/go-live-checklist-tier2.md). Gate SEO (§3 view-source canonical/OG/`lang=id`, §4 robots/sitemap tanpa `/p/*`, §5 GSC, §1 consent GA) diverifikasi di sana sebelum domain publik diumumkan; riset kata kunci (termasuk klaster ID/QRIS) ada di [Keyword Research](keyword-research-landing-page.md). Harga seed kanonis `server/src/db/seeds/001_pro_pricing_2026-09-13.sql`: `249000`/`699000`/`2490000` + `LAUNCH149 149000` (nonaktif). Yang sudah DONE dicentang `[x]` di § Pre-Launch; sisanya (blog, backlink, FAQ schema penuh) tetap terbuka.

---

**Last Updated:** 2026-09-24 (domain prod + harga IDR + status Tier-2)  
**Owner:** SEO Lead  
**Next Review:** 2026-12-24
