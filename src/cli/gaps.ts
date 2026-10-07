import fs from 'node:fs/promises';
import {z} from 'zod';
import {publicCatalog} from '../shared/model';
import {PoliteFetcher,StopCrawl,robotsAllows} from '../shared/fetcher';
import {searchPage,itemId} from '../shared/parser';
import {empty,readJson,writeJson} from './files';
import {persistProduct} from './planned';
const schema=z.object({targets:z.array(z.object({id:z.string(),query:z.string()})).min(1).max(20),maxProducts:z.number().int().min(1).max(100),intervalMs:z.number().int().min(3000),maxRequests:z.number().int().min(1).max(150)});
export async function collectGaps(configFile:string){
 const config=schema.parse(await readJson(configFile)),file='data/checkpoint-competitor-gaps.json';
 const store=await readJson('data/catalog.json',empty()),pub=publicCatalog(store);
 for(const t of config.targets)if(!pub.avatars.some(a=>a.id===t.id)&&!pub.bodies.some(b=>b.id===t.id))throw new Error(`unregistered target ${t.id}`);
 let state=await readJson(file,{configFile,startedAt:new Date().toISOString(),phase:'discovery',sources:[] as {id:string,url:string,totalReported:number|null,ids:string[],at:string}[],queue:[] as string[],cursor:0,success:0,failure:0,requests:0,reason:'',retryAt:0});
 if(state.configFile!==configFile)throw new Error('existing gap checkpoint uses a different config');
 if(state.phase==='complete'){console.log('Gap collection complete');return;}
 if(state.retryAt>Date.now()){console.log('Retry-After cooldown');process.exitCode=2;return;}
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),budget=await readJson(`data/budget-${day}.json`,{used:0});
 const save=async()=>{await writeJson(file,state);await writeJson('data/progress-competitor-gaps.json',{...state,storedProducts:store.products.length,publishedClothing:publicCatalog(store).products.filter(p=>p.kind==='clothing').length,estimatedFinish:state.phase==='products'?new Date(Date.now()+Math.max(0,state.queue.length-state.cursor)*(config.intervalMs+500)).toISOString():null});};
 const f=new PoliteFetcher({intervalMs:config.intervalMs,maxRequests:config.maxRequests,retries:1,timeoutMs:20000},async(input,init)=>{
   if(budget.used>=12000)throw new StopCrawl('daily request budget exhausted');budget.used++;state.requests++;await writeJson(`data/budget-${day}.json`,budget);
   const r=await fetch(input,init);await fs.appendFile('data/requests.jsonl',JSON.stringify({runId:'competitor-gaps',url:String(input),at:new Date().toISOString(),status:r.status})+'\n');return r;
 });
 try{
   state.reason='';state.retryAt=0;const robots=await f.get('https://booth.pm/robots.txt');await fs.writeFile('data/competitor-audit/booth-robots.txt',robots);
   const get=async(url:string)=>{if(!robotsAllows(robots,new URL(url).pathname))throw new StopCrawl('robots disallow');return f.get(url);};
   for(const target of config.targets){
     if(state.sources.some(s=>s.id===target.id))continue;
     const u=new URL('https://booth.pm/ja/browse/'+encodeURIComponent('3D衣装'));u.searchParams.set('q',target.query);u.searchParams.set('sort','new');
     const html=await get(u.href),parsed=searchPage(html,u.href);await fs.writeFile(`data/competitor-audit/search-${target.id}.html`,html);
     state.sources.push({id:target.id,url:u.href,totalReported:parsed.totalReported,ids:parsed.urls.map(itemId),at:new Date().toISOString()});await save();
   }
   if(!state.queue.length){
     const known=new Set(store.products.map(p=>p.id));const queues=state.sources.map(s=>s.ids.filter(id=>!known.has(id))),seen=new Set<string>();
     for(let n=0;n<60&&state.queue.length<config.maxProducts;n++)for(const q of queues){const id=q[n];if(id&&!seen.has(id)&&state.queue.length<config.maxProducts){seen.add(id);state.queue.push(id);}}
   }
   state.phase='products';await save();
   while(state.cursor<state.queue.length){
     const id=state.queue[state.cursor],url=`https://booth.pm/ja/items/${id}`;
     try{const html=await get(url);await fs.writeFile(`data/raw/${id}.html`,html);await persistProduct(html,url,store);state.success++;}
     catch(e){if(e instanceof StopCrawl)throw e;state.failure++;const retry=await readJson<string[]>('data/retry.json',[]);await writeJson('data/retry.json',[...new Set([...retry,url])]);await fs.appendFile('data/failures.jsonl',JSON.stringify({id,run:'competitor-gaps',at:new Date().toISOString(),reason:e instanceof Error?e.message:'unknown'})+'\n');}
     state.cursor++;await save();if(state.cursor%10===0)console.log(`gaps ${state.cursor}/${state.queue.length}, failed ${state.failure}`);
   }
   state.phase='complete';console.log(`completed gaps: ${state.success} success, ${state.failure} failure`);
 }catch(e){state.phase='stopped';state.reason=e instanceof Error?e.message:'unknown';if(e instanceof StopCrawl)state.retryAt=e.retryAt??0;process.exitCode=2;console.log(state.reason);}
 finally{await save();}
}
