// Wikimedia Commons supplies both the image URL and licensing/attribution metadata.
function plain(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity])).trim().slice(0,500);
}
function allowedUrl(value, hostname) {
  try { const url=new URL(value); return url.protocol==='https:'&&url.hostname===hostname&&!url.username&&!url.password&&!url.port ? url.href : null; } catch { return null; }
}
export async function findNewsImage(query, request=fetch) {
  if(typeof query!=='string'||!query.trim())return null;
  const params=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:query.slice(0,120)+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'5',prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'1200'});
  try {
    const response=await request(`https://commons.wikimedia.org/w/api.php?${params}`,{headers:{'User-Agent':'SF13Community/1.0 (software educational articles)'},signal:AbortSignal.timeout(5000)});
    if(!response.ok)return null;
    const data=await response.json();
    const pages=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0));
    for(const page of pages){
      const info=page.imageinfo?.[0];if(!info||!['image/jpeg','image/png','image/webp','image/gif'].includes(info.mime))continue;
      const metadata=info.extmetadata||{};
      const license=plain(metadata.LicenseShortName?.value);
      if(!/^(CC0|Public domain|CC BY(?:-SA)? [1-4]\.0)$/i.test(license))continue;
      const url=allowedUrl(info.thumburl||info.url,'upload.wikimedia.org');
      const sourceUrl=allowedUrl(info.descriptionurl,'commons.wikimedia.org');
      const credit=plain(metadata.Artist?.value);
      const licenseUrl=allowedUrl(metadata.LicenseUrl?.value,'creativecommons.org');
      if(!url||!sourceUrl||!credit||(!licenseUrl&&!/public domain/i.test(license)))continue;
      return {url,sourceUrl,credit,license,licenseUrl,caption:plain(page.title?.replace(/^File:/,'')),provider:'Wikimedia Commons'};
    }
  }catch{/* An unavailable illustration must not prevent publishing a grounded article. */}
  return null;
}
