import site from '../site.json';
import {getCollection} from 'astro:content';
const escape=(s:string)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export async function GET(){
const posts=site.launchReady?(await getCollection('guides',({data})=>!data.draft&&data.reviewed&&data.language==='ko'&&data.sources.length>0)).sort((a,b)=>b.data.pubDate.valueOf()-a.data.pubDate.valueOf()):[];
const items=posts.map(p=>{const url=new URL('/guides/'+p.id+'/',site.url).href;return '<item><title>'+escape(p.data.title)+'</title><link>'+escape(url)+'</link><guid>'+escape(url)+'</guid><description>'+escape(p.data.description)+'</description><pubDate>'+p.data.pubDate.toUTCString()+'</pubDate></item>';}).join('');
return new Response('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>GuideHollow</title><link>'+escape(site.url)+'</link><description>'+escape(site.description)+'</description><language>ko-KR</language>'+items+'</channel></rss>',{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
}