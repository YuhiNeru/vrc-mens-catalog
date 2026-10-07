import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Catalog, Run, avatarSchema, effective, importSchema, publicCatalog } from '../shared/model';
import { PoliteFetcher, StopCrawl, robotsAllows } from '../shared/fetcher';
import { itemId, parseProduct, searchPage } from '../shared/parser';
import { confirmListedVariants } from '../shared/listing';
import { checkReferences, mergeImport } from '../shared/storage';
import { empty, readJson, writeJson } from './files';

const file='data/coverage-plan.json';
type Source={avatarId:string,name:string,url:string,next:string|null,totalReported:number|null,pages:number,ids:string[],status:'pending'|'complete'|'limited'};
type Plan={id:string,createdAt:string,phase:'planning'|'discovery'|'products'|'complete'|'stopped',sources:Source[],queue:string[],cursor:number,success:number,failure:number,requests:number,startedAt:string|null,endedAt:string|null,retryAt?:number,reason:string,dailyLimitExempt?:boolean};
const configSchema=z.object({intervalMs:z.number().int().min(1000),maxRequests:z.number().int().min(1).max(20000),maxPagesPerSource:z.number().int().min(1).max(200),maxProducts:z.number().int().min(1).max(10000),dailyLimitExemptPlanId:z.string().uuid().optional()});
async function config(){return configSchema.parse(await readJson('config/crawl-comprehensive.json'));}
async function local(){return readJson<Catalog>('data/catalog.json',empty());}
export function avatarSearchNames(a:Pick<Catalog['avatars'][number],'name'|'aliases'>):string[]{
 const result:string[]=[];
 for(const original of [a.name,...a.aliases]){
  if(/共通.*素体|PREFAB|グローブ|靴ナシ|Neobody/i.test(original))continue;
  const name=original.replace(/【[^】]*】|\[[^\]]*\]/g,' ').replace(/オリジナル(?:3D)?(?:男性)?(?:モデル|アバター)|VRChatアバター.*|\s+-VRChat.*|\s*\/\s*オリジナル.*|\s+-\s+by\s+.*$/gi,' ').replace(/[「」『』｢｣✤#｜]/g,' ').trim();
  const parts=name.split(/\s*[\/／|()（）]\s*|\s+-\s*|\s+-([A-Za-z][A-Za-z0-9 ]*)-/).filter(Boolean);
  for(const part of [name,...parts]){
   const q=part.trim().replace(/^[\s-]+|[\s-]+$/g,'');
   if(!q||q.length>50||/モデル|アバター|素体|追加衣装|VRChat|VRM|^RE$|旧モデル/i.test(q))continue;
   if(!result.some(n=>n.toLocaleLowerCase()===q.toLocaleLowerCase()))result.push(q);
  }
 }
 return result.length?result:[a.name];
}
function sources(avatars:Catalog['avatars']):Source[]{
 return avatars.flatMap(a=>avatarSearchNames(a).map(name=>{
  const u=new URL('https://booth.pm/ja/browse/'+encodeURIComponent('3D衣装'));u.searchParams.set('q',a.id==='leu'?'LEU':name);u.searchParams.set('sort','new');
  return {avatarId:a.id,name,url:u.href,next:u.href,totalReported:null,pages:0,ids:[],status:'pending' as const};
 }));
}
async function network(plan:Plan){
 const c=await config(),day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
 const budget=await readJson(`data/budget-${day}.json`,{used:0});
 const exempt=c.dailyLimitExemptPlanId===plan.id;
 if(exempt)plan.dailyLimitExempt=true;
 const f=new PoliteFetcher({intervalMs:c.intervalMs,maxRequests:exempt?Infinity:c.maxRequests,retries:2,timeoutMs:20000},async(input,init)=>{
   if(!exempt&&budget.used>=c.maxRequests)throw new StopCrawl('daily request budget exhausted');
   budget.used++;plan.requests++;await writeJson(`data/budget-${day}.json`,budget);
   const started=Date.now(),r=await fetch(input,init);await fs.appendFile('data/requests.jsonl',JSON.stringify({runId:plan.id,at:new Date().toISOString(),url:String(input),status:r.status,durationMs:Date.now()-started})+'\n');return r;
 });
 const robots=await f.get('https://booth.pm/robots.txt');await fs.writeFile('data/robots.txt',robots);
 return async(url:string)=>{if(!robotsAllows(robots,new URL(url).pathname))throw new StopCrawl('robots disallow');return f.get(url);};
}
async function save(plan:Plan){
 await writeJson(file,plan);
 const store=await local(),pub=publicCatalog(store),elapsed=plan.startedAt?(Date.now()-Date.parse(plan.startedAt))/1000:0;
 const remaining=plan.queue.length-plan.cursor,per=plan.cursor?elapsed/Math.max(1,plan.requests):1.1;
 await writeJson('data/progress-comprehensive.json',{phase:plan.phase,updatedAt:new Date().toISOString(),sources:plan.sources.map(s=>({avatar:s.name,reported:s.totalReported,pages:s.pages,discovered:s.ids.length,status:s.status})),discoveredUnique:new Set(plan.sources.flatMap(s=>s.ids)).size,queued:plan.queue.length,processed:plan.cursor,success:plan.success,failure:plan.failure,requests:plan.requests,storedProducts:store.products.length,publishedClothing:pub.products.filter(p=>p.kind==='clothing').length,estimatedFinish:plan.phase==='products'?new Date(Date.now()+remaining*Math.max(1.05,per)*1000).toISOString():null,reason:plan.reason});
}
async function page(plan:Plan,s:Source,get:(url:string)=>Promise<string>){
 if(!s.next)return;
 const url=s.next,html=await get(url);await fs.mkdir('data/raw/search',{recursive:true});await fs.writeFile(`data/raw/search/${createHash('sha256').update(url).digest('hex').slice(0,20)}.html`,html);
 const parsed=searchPage(html,url);s.totalReported??=parsed.totalReported;s.ids=[...new Set([...s.ids,...parsed.urls.map(itemId)])];s.next=parsed.next;s.pages++;if(!s.next)s.status='complete';await save(plan);
}
export async function planCoverage(addedOnly=false,refreshAll=false){
 let plan=await readJson<Plan|null>(file,null);
 let existingAvatars=new Set<string>();
 if((addedOnly||refreshAll)&&plan){
  if(plan.phase!=='complete')throw new Error('finish the existing coverage plan before adding targets');
  if(addedOnly)existingAvatars=new Set(plan.sources.map(s=>s.avatarId));await fs.mkdir('data/coverage-history',{recursive:true});
  await fs.copyFile(file,`data/coverage-history/${plan.id}.json`);plan=null;
 }
 if(plan&&plan.phase!=='planning'){console.log('Existing coverage plan: data/coverage-plan.json');return;}
 if(plan?.retryAt&&Date.now()<plan.retryAt){console.log('Retry-After cooldown');process.exitCode=2;return;}
 if(!plan){const av=publicCatalog(await local()).avatars.filter(a=>!existingAvatars.has(a.id));if(!av.length)throw new Error('no new public avatars to plan');plan={id:crypto.randomUUID(),createdAt:new Date().toISOString(),phase:'planning',sources:sources(av),queue:[],cursor:0,success:0,failure:0,requests:0,startedAt:null,endedAt:null,reason:''};await save(plan);}
 try{plan.reason='';plan.retryAt=undefined;const get=await network(plan);for(const s of plan.sources)if(!s.pages)await page(plan,s,get);plan.phase='discovery';}
 catch(e){plan.reason=e instanceof Error?e.message:'planning error';if(e instanceof StopCrawl)plan.retryAt=e.retryAt;process.exitCode=2;}
 finally{await save(plan);}
 console.log(JSON.stringify(plan.sources.map(s=>({avatar:s.name,reported:s.totalReported,pagesEstimated:s.totalReported?Math.ceil(s.totalReported/60):null})),null,2));
}
export async function persistProduct(html:string,url:string,store:Catalog,fetchedAt?:string,persistStore=true){
 const avatars=z.array(avatarSchema).parse(await readJson('config/avatars.json'));
 const parsed=parseProduct(html,url,avatars,fetchedAt);
 const registered=new Set(store.avatars.map(a=>a.id));
 const confirmed=confirmListedVariants(html,parsed.product,avatars,store.bodies).filter(r=>r.targetType==='body'||registered.has(r.targetId));
 const keys=new Set(confirmed.map(r=>r.targetId));
 const relations=[...parsed.compatibility.filter(r=>registered.has(r.targetId)&&!keys.has(r.targetId)),...confirmed];
 if(confirmed.length||parsed.outsideFloorTarget)parsed.product.review='verified';
 const data=importSchema.parse({products:[parsed.product],avatars:avatars.filter(a=>a.productId===parsed.product.id),compatibility:relations});
 checkReferences(data,store);await fs.mkdir('data/outbox',{recursive:true});await writeJson(`data/outbox/${Date.now()}-${crypto.randomUUID()}.json`,data);mergeImport(store,data);if(persistStore)await writeJson('data/catalog.json',store);
}
export async function relistSaved(){
 const store=await local();let count=0;
 for(const p of [...store.products])if(p.kind==='clothing'){
   const html=await fs.readFile(`data/raw/${p.id}.html`,'utf8');await persistProduct(html,p.url,store,p.fetchedAt,false);count++;
   if(count%25===0){await writeJson('data/catalog.json',store);console.log('relisted',count);}
 }
 await writeJson('data/catalog.json',store);
 console.log('Relisted saved clothing',count,'published',publicCatalog(store).products.filter(p=>p.kind==='clothing').length);
}
export async function collectCoverage(){
 const plan=await readJson<Plan>(file),c=await config();
 if(plan.phase==='complete'){console.log('Plan complete; see data/progress-comprehensive.json');return;}
 if(plan.phase==='planning')throw new Error('finish plan first');
 if(plan.retryAt&&Date.now()<plan.retryAt){console.log('Retry-After cooldown');process.exitCode=2;return;}
 plan.startedAt??=new Date().toISOString();plan.reason='';plan.retryAt=undefined;
 for(const s of plan.sources)if(s.status==='limited'&&s.pages<c.maxPagesPerSource)s.status='pending';
 try{
   const get=await network(plan);
   plan.phase=plan.sources.some(s=>s.next&&s.status!=='limited')?'discovery':'products';
   // 各アバターを1ページずつ回し、1体だけ先に網羅して残りを落とさない。
   while(plan.sources.some(s=>s.next&&s.status!=='limited'))for(const s of plan.sources){
     if(!s.next||s.status==='limited')continue;
     if(s.pages>=c.maxPagesPerSource){s.status='limited';await save(plan);continue;}
     await page(plan,s,get);
   }
   {const known=new Set((await local()).products.map(p=>p.id)),queued=new Set(plan.queue);const ids=[...new Set(plan.sources.flatMap(s=>s.ids))].filter(id=>!known.has(id)&&!queued.has(id));plan.queue.push(...ids);}
   plan.phase='products';await save(plan);
   const store=await local();
   let processedThisCall=0;
   while(plan.cursor<plan.queue.length&&processedThisCall<c.maxProducts){
     const id=plan.queue[plan.cursor],url=`https://booth.pm/ja/items/${id}`;
     try{const html=await get(url);await fs.writeFile(`data/raw/${id}.html`,html);await persistProduct(html,url,store);plan.success++;}
     catch(e){if(e instanceof StopCrawl)throw e;plan.failure++;const retry=await readJson<string[]>('data/retry.json',[]);await writeJson('data/retry.json',[...new Set([...retry,url])]);await fs.appendFile('data/failures.jsonl',JSON.stringify({id,run:plan.id,at:new Date().toISOString(),reason:e instanceof Error?e.message.slice(0,200):'unknown'})+'\n');}
     plan.cursor++;processedThisCall++;await save(plan);if(plan.cursor%25===0)console.log(`products ${plan.cursor}/${plan.queue.length}; success ${plan.success}`);
   }
   if(plan.cursor<plan.queue.length||plan.sources.some(s=>s.status==='limited')){plan.phase='stopped';plan.reason=plan.cursor<plan.queue.length?'product batch limit reached; resume collect-plan':'search page limit reached; inspect source coverage';process.exitCode=2;}
   else{plan.phase='complete';plan.endedAt=new Date().toISOString();}
 }catch(e){plan.phase='stopped';plan.reason=e instanceof Error?e.message:'collection failed';if(e instanceof StopCrawl)plan.retryAt=e.retryAt;process.exitCode=2;console.log(plan.reason);}
 finally{
   // この計画への例外は完了時に取り除き、次回以降には引き継がない。
   if(plan.phase==='complete'){
     const current=await config();
     if(current.dailyLimitExemptPlanId===plan.id){delete current.dailyLimitExemptPlanId;await writeJson('config/crawl-comprehensive.json',current);}
   }
   await save(plan);const store=await local();const run:Run={id:plan.id,location:'local',startedAt:plan.startedAt!,endedAt:plan.endedAt??new Date().toISOString(),status:plan.phase==='complete'?'complete':'stopped',success:plan.success,failure:plan.failure,updated:plan.success,cursor:plan.cursor,reason:plan.reason};store.runs=store.runs.filter(r=>r.id!==run.id).concat(run);await writeJson('data/catalog.json',store);
 }
}

export async function reportCoverage(){
 const plan=await readJson<Plan>(file);
 if(plan.phase!=='complete')throw new Error('coverage report requires a completed crawl');
 const pub=publicCatalog(await local()),clothes=pub.products.filter(p=>p.kind==='clothing');
 const checkedAt=new Date().toISOString(),base='http://127.0.0.1:8787';
 const response=await fetch(base+'/api/avatars',{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('local floor unavailable');
 const avatars=(await response.json() as {items:{id:string,name:string,clothingCount:number}[]}).items;
 const counts=await fetch(base+'/api/products?audience=all',{signal:AbortSignal.timeout(30000)});
 if(!counts.ok||(await counts.json() as {total:number}).total!==clothes.length||avatars.length!==pub.avatars.length)throw new Error('local floor snapshot has not been published');
 const baseline=await readJson<any>('data/avatar-name-recrawl-baseline.json',null);
 const requests=(await fs.readFile('data/requests.jsonl','utf8')).trim().split('\n').map(l=>JSON.parse(l)).filter(r=>r.runId===plan.id);
 const latest=new Map<string,string>();for(const r of requests)latest.set(r.url,r.at);
 const cell=(s:unknown)=>String(s??'不明').replace(/\|/g,'／').replace(/\n/g,' ');
 const normal=clothes.filter(p=>p.audience!=='unisex').length,unisex=clothes.length-normal;
 const summary={planId:plan.id,checkedAt,startedAt:plan.createdAt,endedAt:plan.endedAt,avatars:avatars.length,queries:plan.sources.length,searchPages:plan.sources.reduce((n,s)=>n+s.pages,0),discoveredUnique:new Set(plan.sources.flatMap(s=>s.ids)).size,newProducts:plan.success,failedProducts:plan.failure,requests:plan.requests,clothing:clothes.length,regular:normal,unisex,baseline,avatarCounts:avatars};
 await writeJson('data/avatar-name-recrawl-result.json',summary);
 await fs.writeFile('docs/avatar-name-recrawl-2026-10-07.md',`# アバター名を起点にした衣装の再収集\n\n開始 ${plan.createdAt}、完了 ${plan.endedAt}、ローカルフロア確認 ${checkedAt}（UTC）。${avatars.length}体・${plan.sources.length}検索語・${summary.searchPages}検索ページを確認。商品IDで重複除去して${summary.discoveredUnique}商品を発見、保存済みを除いた新規${plan.success}商品を取得、商品取得失敗${plan.failure}件。${plan.requests}リクエスト。逐次取得・robots・アクセス制限を遵守。${plan.dailyLimitExempt?"今回の初回計画はユーザー指定で日次上限を免除し、完了時に通常設定へ戻す。":"日次上限を遵守。"}検索結果は対応確認を保証せず、作者の対応一覧・販売対象版に対象が確認できた衣装だけ掲載。女性・98体以外への対応を確認した衣装は男女兼用枠に掲載し、98体への対応がないものも含む。画像はBOOTHの元URL、男女兼用は別枠。\n\n| 掲載対象 | 再収集前 | 反映後 | 取得元 |\n|---|---:|---:|---|\n| アバター | ${baseline?.avatars??'不明'} | ${avatars.length} | ${base}/api/avatars |\n| 通常衣装 | ${baseline?.regular??'不明'} | ${normal} | ${base}/api/products |\n| 男女兼用衣装 | ${baseline?.unisex??'不明'} | ${unisex} | ${base}/api/products?audience=unisex |\n| 衣装合計 | ${baseline?.clothing??'不明'} | ${clothes.length} | ${base}/api/products?audience=all |\n\n## アバター別の対応衣装（全件）\n\n取得日時 ${checkedAt}（UTC）。複数対応の衣装はアバターごとに重複して数える。確認済み共通素体対応を含む。\n\n| アバター | 対応衣装数 | 取得元 |\n|---|---:|---|\n${avatars.map(a=>`| ${cell(a.name)} | ${a.clothingCount} | ${base}/api/avatars/${a.id} |`).join('\n')}\n\n## 検索範囲と表示件数\n\n表示件数は検索のヒット数であり、そのアバターへの対応衣装数ではない。各検索語の件数は足し合わせない。取得日時は当該URLの取得ログに基づく。\n\n| 検索語 | 表示件数 | 取得ページ数 | 商品ID数 | 状態 | 取得元 | 取得日時（UTC） |\n|---|---:|---:|---:|---|---|---|\n${plan.sources.map(s=>`| ${cell(s.name)} | ${s.totalReported??'不明'} | ${s.pages} | ${s.ids.length} | ${s.status} | ${s.url} | ${latest.get(s.url)??'不明'} |`).join('\n')}\n`);
 console.log(JSON.stringify(summary));
 await(await import('./export-floor-tagged')).exportFloorTagged();
}
