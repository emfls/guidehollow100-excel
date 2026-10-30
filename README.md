# GuideHollow Excel

Independent GuideHollow 100 static blog. Other GuideHollow repositories are not used.

## Run

    npm install
    npm run dev
    npm run build

## Deploy
1. Configure Settings > Pages > Source: GitHub Actions.
2. Add the custom domain excel.guidehollow.com in GitHub Pages settings and configure Gabia DNS CNAME to the GitHub Pages hostname.
3. Verify Pages deployment, SSL, domain and content QA.
4. Set launchReady to true in src/site.json only after approval.

## Editorial gate
Guides live under src/content/guides/*.md. Both reviewed: true and draft: false are required, and the site must have launchReady: true.
Notion drafts are NOT imported automatically; no existing publisher is connected.