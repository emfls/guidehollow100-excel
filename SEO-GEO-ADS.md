# SEO, GEO and advertising integration

Sites are independent GuideHollow 100 Astro deployments. Existing GuideHollow publishing infrastructure is not connected.

## Search and AI search
- Semantic headings, canonical URL, Open Graph/Twitter, article BlogPosting JSON-LD, breadcrumb JSON-LD and site WebSite schema.
- On-article table of contents and visible source links from frontmatter. RSS and Astro sitemap.
- Each published guide must be reviewed, not a draft, and have at least one source in frontmatter.
- GEO/AEO is not guaranteed AI ranking. Google recommends ordinary SEO, unique useful answers and reliable sources, not special AI files.
- Keep `launchReady:false` in `src/site.json` until deployment and DNS/HTTPS verification. Robots noindex remains active.

## Advertising
- Config: `src/config/monetization.json`; renderer: `src/components/AdPlacement.astro`.
- Home: AdSense after topics; Coupang after guides. Guide list: AdSense below list.
- Article: AdSense after intro and after full text; Coupang after full text.
- Disabled placements are invisible `<template>` markers. No third-party ad scripts or fake empty ad panels.
- AdSense: obtain approval for this site, supply real `ca-pub-...` and numeric slot IDs, then set `enabled:true`.
- Coupang: only insert verified approved affiliate image URL, target URL, alt text, approved:true, then enable the network.
- Always separate ads from navigation; display clear advertisement labels and affiliate disclosure.
- Review privacy/cookie/consent requirements before activation; `ads.txt` intentionally absent until the real publisher ID is supplied.

## Launch check
1. Enable GitHub Pages using GitHub Actions; verify successful deploy.
2. Configure intended Gabia CNAME and Pages custom domain; confirm HTTPS.
3. Review factual accuracy, visible sources, accessibility and any ad suitability.
4. Add approved content and then set launchReady:true; submit sitemap to Search Console.
