# GuideHollow 100: SEO, GEO and Coupang Dynamic Banners

## Current monetization
- Google AdSense remains OFF while awaiting approval; existing manual slots remain reserved and invisible.
- Coupang Partners uses ONLY official dynamic banner widgets; no individual product target/image URL is needed.
- The banner locations are homepage after topic cards, guides list bottom, and article after the main solution but before references.
- Only one Coupang unit per page type is prepared. The banner is not shown if unconfigured.
- All ads and published articles remain off while `src/site.json` has `launchReady: false`.

## How to connect the official Coupang dynamic widget
1. Use Coupang Partners' Dynamic Banner generator and select a suitable category or recommendation type for each site.
2. Copy the generated JavaScript or iframe tag without substituting example publisher IDs.
3. In `src/config/monetization.json`, find `coupang.dynamicBanners` and the placement you want.
4. For JavaScript, supply the actual `id` and `trackingCode` from `new PartnersCoupang.G(...)`; keep `mode: script`, and set the banner and global `enabled` flags to true after launch and compliance checks.
5. For an official iframe snippet, use `mode: iframe` and place its original HTTPS `src` into `iframeSrc`, with the two enabled flags true.
6. Do NOT paste arbitrary raw scripts or product links. The site loads the fixed Coupang `https://ads-partners.coupang.com/g.js` library once when a validated JavaScript banner is enabled.
7. The widget is visibly labelled an advertisement with a commission disclosure, separate from editorial recommendations.
8. Test sizing and links on an actual deployed mobile and desktop site before enabling production ads.

## Required publishing and policy checks
- Ensure each domain is accepted/registered as a promotional channel in your Coupang Partners account.
- Review any geographic privacy, cookies, tracking and consent requirements before activating recommendation-based third-party scripts.
- Use truthful and prominent sponsorship statements; do not place the unit as a fake navigation or download control.
- Never enable scripts using unknown tracking IDs or links copied from another affiliate.
- Keep `adsense.enabled: false` until AdSense site approval and updated advertising/consent checks.

## Search optimization
- Existing canonical metadata, structured data, breadcrumb, RSS, article citations and sitemap remain in place.
- Review and publish real user-helpful content one article at a time; avoid commercial-only thin pages.
- Indexing is disabled with `launchReady: false`. Activate only after Pages, DNS, HTTPS and editorial validation.
