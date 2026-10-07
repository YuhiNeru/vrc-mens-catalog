import fs from 'node:fs/promises';
import {load} from 'cheerio/slim';
import {PoliteFetcher,StopCrawl,robotsAllows} from '../shared/fetcher';
import {Avatar,avatarSchema,importSchema,Product} from '../shared/model';
import {parseProduct} from '../shared/parser';
import {mergeImport} from '../shared/storage';
import {empty,readJson,writeJson} from './files';

export async function expandAvatars(){
 const list=await readJson<{id:string,name:string,productId:string,referenceUrl:string}[]>('config/avatar-expansion.json');
 const store=await readJson('data/catalog.json',empty()),seeds=await readJson<Avatar[]>('config/avatars.json');
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
 const budget=await readJson(`data/budget-${day}.json`,{used:0}),runId='avatar-expansion-'+crypto.randomUUID();
 const fetcher=new PoliteFetcher({intervalMs:1000,maxRequests:12000,retries:2,timeoutMs:20000},async(input,init)=>{
  if(budget.used>=12000)throw new StopCrawl('daily request budget exhausted');budget.used++;await writeJson(`data/budget-${day}.json`,budget);
  const r=await fetch(input,init);await fs.appendFile('data/requests.jsonl',JSON.stringify({runId,at:new Date().toISOString(),url:String(input),status:r.status})+'\n');return r;
 });
 const robots=await fetcher.get('https://booth.pm/robots.txt');
 const results:unknown[]=[];
 for(const c of list){
  if(store.avatars.some(a=>a.productId===c.productId))continue;
  const url=`https://booth.pm/ja/items/${c.productId}`;
  try{
   if(!robotsAllows(robots,new URL(url).pathname))throw new StopCrawl('robots disallow');
   const html=await fetcher.get(url);await fs.writeFile(`data/raw/${c.productId}.html`,html);
   const $=load(html);const ld=$('script[type="application/ld+json"]').map((_,e)=>{try{return JSON.parse($(e).text());}catch{return null;}}).get().find(x=>x?.['@type']==='Product');
   const description=String(ld?.description??'');
   const line=description.split(/\n/).map(l=>l.trim()).find(l=>/男性|男の子|少年|青年|お兄さん|男アバター|male\b|boy\b/i.test(l)&&!/^https?:/.test(l));
   const candidate:Avatar=avatarSchema.parse({id:c.id,productId:c.productId,name:c.name,aliases:[c.id],author:'',bodyId:null,bodyEvidence:'',genderEvidence:line?.slice(0,500)??'',ageGroup:/少年|男の子|boy\b/i.test(line??'')?'少年':/青年/.test(line??'')?'青年':'未分類',review:'candidate'});
   const p=parseProduct(html,url,[...seeds,candidate]).product;
   candidate.author=p.shop;
   // バージョン名・SALE・型番をアバター別名へ混ぜない。
   if(c.id==='licht')candidate.aliases.push('リヒト');
   if(c.id==='ay6')candidate.aliases.push('Ayumu');
   if(c.id==='renjo')candidate.aliases.push('連成さん','連成');
   results.push({id:c.id,name:c.name,productId:c.productId,title:p.name,shop:p.shop,genderLine:line??null,review:'candidate'});
   const data=importSchema.parse({products:[p],avatars:[candidate]});
   await writeJson(`data/outbox/${Date.now()}-${crypto.randomUUID()}.json`,data);mergeImport(store,data);await writeJson('data/catalog.json',store);
   if(!seeds.some(a=>a.id===candidate.id))seeds.push(candidate);await writeJson('config/avatars.json',seeds);
   console.log('avatar candidate',c.name,line?'explicit gender evidence':'needs review');
  }catch(e){if(e instanceof StopCrawl)throw e;results.push({id:c.id,error:e instanceof Error?e.message:'unknown'});console.log('preserved/failed',c.name);}
  await writeJson('data/avatar-expansion-review.json',results);
 }
}
