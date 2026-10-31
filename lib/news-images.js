// Only Wikimedia-hosted images with usable licensing and attribution are accepted.
function plain(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[entity])).trim().slice(0,500);
}
function allowedUrl(value, hostname) {
  try {
    const url=new URL(value);
    if(!['http:','https:'].includes(url.protocol)||url.hostname!==hostname||url.username||url.password||url.port)return null;
    url.protocol='https:';return url.href;
  }catch{return null;}
}
function chooseImage(data) {
  const pages=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0));
  for(const page of pages){
    const info=page.imageinfo?.[0];if(!info)continue;
    const raster=['image/jpeg','image/png','image/webp','image/gif'].includes(info.mime);
    const svgThumbnail=info.mime==='image/svg+xml'&&/\.(png|jpe?g|webp)(?:\?|$)/i.test(info.thumburl||'');
    if(!raster&&!svgThumbnail)continue;
    const metadata=info.extmetadata||{};
    const license=plain(metadata.LicenseShortName?.value);
    if(!/^(CC0(?: 1\.0)?|Public domain|CC BY(?:-SA)? [1-4]\.0)$/i.test(license))continue;
    const url=allowedUrl(info.thumburl||info.url,'upload.wikimedia.org');
    const sourceUrl=allowedUrl(info.descriptionurl,'commons.wikimedia.org');
    const credit=plain(metadata.Artist?.value||metadata.Credit?.value);
    const licenseUrl=allowedUrl(metadata.LicenseUrl?.value,'creativecommons.org');
    if(!url||!sourceUrl||!credit||(!licenseUrl&&!/public domain/i.test(license)))continue;
    return {url,sourceUrl,credit,license,licenseUrl,caption:plain(page.title?.replace(/^File:/,'')),provider:'Wikimedia Commons'};
  }
  return null;
}
export async function findNewsImage(query, request=fetch, report=()=>{}) {
  if(typeof query!=='string'||!query.trim()){report('no_query');return null;}
  const signal=AbortSignal.timeout(7000);
  const get=async(host,params)=>{
    const response=await request(`https://${host}/w/api.php?${new URLSearchParams({action:'query',format:'json',...params})}`,{headers:{'User-Agent':'SF13Community/1.0 (https://dday-five-lac.vercel.app; software educational articles)'},signal});
    if(!response.ok)throw Error('Image service unavailable');
    const data=await response.json();if(data.error)throw Error('Image search rejected');return data;
  };
  const imageProps={prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'1200'};
  try {
    const search=await get('commons.wikimedia.org',{generator:'search',gsrsearch:query.slice(0,120),gsrnamespace:'6',gsrlimit:'5',...imageProps});
    let image=chooseImage(search);
    if(!image){
      // A topic's Wikipedia image is often easier to find than a Commons filename.
      // Fetch its licensing from Commons as well; local/fair-use Wikipedia files are not reused.
      const language=/[A-Za-z]/.test(query)?'en':'ko';
      const pages=await get(`${language}.wikipedia.org`,{generator:'search',gsrsearch:query.slice(0,120),gsrlimit:'1',prop:'pageimages',piprop:'name'});
      const name=Object.values(pages.query?.pages||{})[0]?.pageimage;
      if(name)image=chooseImage(await get('commons.wikimedia.org',{titles:`File:${name}`,...imageProps}));
    }
    report(image?'found':'no_match');return image;
  }catch{report('unavailable');return null;}
}
