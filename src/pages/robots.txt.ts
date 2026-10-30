import site from '../site.json';
/** Keep pages crawlable so prelaunch noindex meta directives can be seen. */
export function GET() {
  return new Response(['User-agent: *','Allow: /','Sitemap: '+site.url+'sitemap-index.xml',''].join('\n'), { headers: {'Content-Type':'text/plain; charset=utf-8'} });
}
