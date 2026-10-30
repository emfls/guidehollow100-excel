# GuideHollow 100: Coupang Dynamic Banners and AdSense Auto ads

## Approved widget parameters supplied 30 October 2026
- Main page: Coupang dynamic JavaScript widget `id: 1044908`.
- Individual article: widget `id: 1044909`.
- Both widgets use `template: "carousel"`, `trackingCode: "AF2560572"`, `width: "680"`, `height: "140"`, `tsource: ""`.
- The same two widgets are configured for all ten GuideHollow 100 topic sites. The user must verify each intended promotional domain is accepted in their Coupang Partners channel settings.
- Only the home and article pages contain Coupang placements; the guide list does not load a third banner.

## AdSense Auto ads only (not manual ad units)
- `src/config/monetization.json` contains `adsense: {enabled:false, mode:"auto", client:""}`.
- No manual AdSense `<ins>` units, slot IDs or page-level placeholder components remain.
- After site and AdSense approval, provide the real `ca-pub-...` publisher ID, enable AdSense in the config, and activate **Auto ads** in the AdSense site dashboard. The shared layout then loads the official script once per page in `<head>`.
- Optimize overlays, in-page load and excluded areas in the AdSense Auto ads dashboard. Review conflict/density with Coupang banners.
- AdSense remains OFF pending approval and appropriate privacy/consent setup.

## Coupang activation, publication and privacy guard
- `coupang.enabled:true` and both placement flags are configured, but widget scripts are gated by `site.launchReady`. `src/site.json` remains `launchReady:false`, therefore no widget is loaded while sites are not launched.
- The external `https://ads-partners.coupang.com/g.js` script is loaded once in the shared layout on launched pages; each unit emits only its matching `new PartnersCoupang.G(...)`.
- Advertisements are labelled, carry the Korean/English commission notice, and do not masquerade as official instructions or product endorsements.
- Before setting `launchReady:true`, verify GitHub Pages, DNS, HTTPS, Coupang channel domain permissions, privacy/cookie/consent requirements, and editorial content review.
- Device-width testing is essential: original 680-pixel Coupang widget can require horizontal scroll or a separately generated mobile creative.

## SEO and GEO
Canonical tags, structured data, visible sources, topic layout, RSS and sitemap are unchanged. Keep drafts and indexing blocked until ready. No SEO or generative-AI search placement is guaranteed.
