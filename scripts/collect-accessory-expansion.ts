import fs from 'node:fs/promises';
import {withLock,readJson,writeJson} from '../src/cli/files';
import {type Catalog} from '../src/shared/model';
import {PoliteFetcher,StopCrawl,robotsAllows} from '../src/shared/fetcher';
import {searchPage,itemId} from '../src/shared/parser';
import {persistProduct} from '../src/cli/planned';

// 少ない売り場を優先。各検索から同じ件数を取り、靴だけに偏らせない。
const terms=['ネックレス','チョーカー','手袋','指輪','帽子','バッグ','ブレスレット','ハーネス','マスク','尻尾','ヘッドホン','ヘアピン','眼鏡','ピアス'];
const queries=terms.flatMap(term=>[`VRChat ${term}`,`狛乃 ${term}`]);
await withLock(async()=>{
 const store=await readJson<Catalog>('data/catalog.json');
 const state=await readJson('data/accessory-expansion-crawl.json',{startedAt:new Date().toISOString(),sources:[] as {query:string,url:string,at:string,ids:string[]}[],queue:[] as string[],cursor:0,success:0,failure:0,requests:0,status:'running',reason:'',retryAt:0});
 if(state.status==='complete'){console.log('already complete');return;}
 if(state.retryAt>Date.now()){console.log('Retry-After cooldown');process.exitCode=2;return;}
 state.status='running';state.reason='';state.retryAt=0;
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
 const budget=await readJson(`data/budget-${day}.json`,{used:0});
 const f=new PoliteFetcher({intervalMs:3000,maxRequests:230,retries:1,timeoutMs:20000},async(input,init)=>{
  if(budget.used>=12000)throw new StopCrawl('daily request budget exhausted');
  budget.used++;state.requests++;await writeJson(`data/budget-${day}.json`,budget);
  const r=await fetch(input,init);await fs.appendFile('data/requests.jsonl',JSON.stringify({runId:'accessory-expansion',at:new Date().toISOString(),url:String(input),status:r.status})+'\n');return r;
 });
 const save=async()=>{await writeJson('data/accessory-expansion-crawl.json',state);};
 try{
  const robots=await f.get('https://booth.pm/robots.txt');await fs.writeFile('data/accessory-expansion-robots.txt',robots);
  const get=(url:string)=>{if(!robotsAllows(robots,new URL(url).pathname))throw new StopCrawl('robots disallow');return f.get(url);};
  for(const query of queries){
   if(state.sources.some(s=>s.query===query))continue;
   const u=new URL('https://booth.pm/ja/search/'+encodeURIComponent(query));u.searchParams.set('sort','wish_lists');
   const html=await get(u.href),parsed=searchPage(html,u.href);
   await fs.writeFile(`data/raw/accessory-expansion-search-${state.sources.length}.html`,html);
   state.sources.push({query,url:u.href,at:new Date().toISOString(),ids:parsed.urls.map(itemId)});await save();
  }
  if(!state.queue.length){
   const known=new Set(store.products.map(p=>p.id));
   const lanes=state.sources.map(s=>s.ids.filter(id=>!known.has(id)).slice(0,7));
   for(let i=0;i<7;i++)for(const lane of lanes){const id=lane[i];if(id&&!state.queue.includes(id))state.queue.push(id);}
   await save();console.log(`discovery complete: ${state.sources.length} queries, ${state.queue.length} new products`);
  }
  while(state.cursor<state.queue.length){
   const id=state.queue[state.cursor],url=`https://booth.pm/ja/items/${id}`;
   try{const html=await get(url);await fs.writeFile(`data/raw/${id}.html`,html);await persistProduct(html,url,store,undefined,false);state.success++;}
   catch(e){if(e instanceof StopCrawl)throw e;state.failure++;console.log('preserved failure',id);}
   state.cursor++;await writeJson('data/catalog.json',store);await save();
   if(state.cursor%10===0)console.log(`accessories ${state.cursor}/${state.queue.length}`);
  }
  state.status='complete';console.log(JSON.stringify({success:state.success,failure:state.failure,requests:state.requests}));
 }catch(e){state.status='stopped';state.reason=e instanceof Error?e.message:'unknown';if(e instanceof StopCrawl)state.retryAt=e.retryAt??0;process.exitCode=2;console.log(state.reason);}
 finally{await save();}
});
