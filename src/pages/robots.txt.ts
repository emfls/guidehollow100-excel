import site from '../site.json';
export function GET(){
return new Response(['User-agent: *',site.launchReady?'Allow: /':'Disallow: /','Sitemap: '+site.url+'sitemap-index.xml',''].join('\n'),{headers:{'Content-Type':'text/plain; charset=utf-8'}});
}
