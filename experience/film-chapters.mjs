// Film chapter switching: a chapter link carries #cut=…&film=<chapter list>&director=1.
export function filmLink(hash){
  const params=new URLSearchParams(String(hash||'').replace(/^#/,'')),film=params.get('film');
  return film?{film,director:params.get('director')==='1'}:null;
}
// Pages resolve against the list's own URL and must stay on this server.
export function cleanFilmChapters(value,base){
  if(!Array.isArray(value?.chapters))throw Error('The film chapter list has no chapters.');
  const origin=new URL(base).origin;
  const chapters=value.chapters.slice(0,200).flatMap((c,i)=>{
    if(typeof c?.page!=='string'||typeof c.id!=='string'||!c.id)return [];
    let url;try{url=new URL(c.page,base);}catch{return [];}
    if(url.origin!==origin)return [];
    const seconds=Number(c.seconds);
    return [{n:Number.isInteger(c.n)?c.n:i+1,id:c.id.slice(0,80),title:typeof c.title==='string'?c.title.slice(0,140):'',seconds:typeof c.seconds!=='boolean'&&c.seconds!=null&&Number.isFinite(seconds)?seconds:null,url:url.href}];
  });
  if(!chapters.length)throw Error('The film chapter list has no chapters.');
  return chapters;
}
export const filmChapterLabel=c=>`${c.n} · ${c.id}${c.seconds==null?'':` (${c.seconds} s)`}`;
export function filmChapterIndex(chapters,shotIds){return chapters?.findIndex(c=>shotIds.includes(c.id))??-1;}
export async function loadFilmChapters(film,base=location.href,fetcher=globalThis.fetch){
  const url=new URL(film,base);if(url.origin!==new URL(base).origin)throw Error('The film chapter list must come from this server.');
  const response=await fetcher(url.href,{cache:'no-store'});if(!response.ok)throw Error(`Film chapter list unavailable (${response.status}).`);
  return cleanFilmChapters(await response.json(),url.href);
}
