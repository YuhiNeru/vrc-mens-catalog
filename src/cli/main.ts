import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { Avatar, Catalog, ImportData, Override, Run, avatarSchema, importSchema, overrideSchema, productSchema, relationKey, effective } from '../shared/model';
import { checkReferences, mergeImport, sqlExport, validateOverride } from '../shared/storage';
import { PoliteFetcher, StopCrawl, robotsAllows } from '../shared/fetcher';
import { discover, itemId, parseProduct } from '../shared/parser';
import { confirmListedVariants } from '../shared/listing';
import { empty, readJson, withLock, writeJson } from './files';

const storePath='data/catalog.json';
async function loadStore(){return readJson<Catalog>(storePath,empty());}
async function seeds(){return z.array(avatarSchema).parse(await readJson('config/avatars.json'));}
function batch(product:ReturnType<typeof parseProduct>,avatars:Avatar[]):ImportData {
  return importSchema.parse({products:[product.product],avatars:avatars.filter(a=>a.productId===product.product.id),compatibility:product.compatibility});
}
async function queue(data:ImportData) {
  await writeJson(`data/outbox/${Date.now()}-${crypto.randomUUID()}.json`,data);
}
async function saveParsed(parsed:ReturnType<typeof parseProduct>,avatars:Avatar[],store:Catalog,html?:string) {
  if(parsed.outsideFloorTarget)parsed.product.review='verified';
  if(html){const confirmed=confirmListedVariants(html,parsed.product,avatars,store.bodies);const ids=new Set(confirmed.filter(r=>r.targetType==='avatar').map(r=>r.targetId));parsed.compatibility=[...parsed.compatibility.filter(r=>!ids.has(r.targetId)),...confirmed];if(confirmed.length)parsed.product.review='verified';}
  const b=batch(parsed,avatars);
  const registered=new Set([...store.avatars,...b.avatars].map(a=>a.id));
  b.compatibility=b.compatibility.filter(r=>r.targetType!=='avatar'||registered.has(r.targetId));
  checkReferences(b,store);
  // outboxを先に保存。途中停止後はreplayしてローカル保存と再送を完了できる。
  await queue(b);mergeImport(store,b);await writeJson(storePath,store);
}
async function replay(store:Catalog) {
  await fs.mkdir('data/outbox',{recursive:true});
  for(const file of (await fs.readdir('data/outbox')).filter(f=>f.endsWith('.json')).sort())mergeImport(store,importSchema.parse(await readJson(`data/outbox/${file}`)));
  await writeJson(storePath,store);
}
async function importSaved() {
  const avatars=await seeds(),store=await loadStore();
  // アバター本体を先に追加。失敗した商品は以前の記録を変更しない。
  const ids=(await fs.readdir('data/raw')).filter(f=>/^\d+\.html$/.test(f)).map(f=>f.replace('.html','')).sort((a,b)=>Number(!avatars.some(v=>v.productId===a))-Number(!avatars.some(v=>v.productId===b)));
  for(const id of ids) {
    try {const file=`data/raw/${id}.html`,stat=await fs.stat(file),html=await fs.readFile(file,'utf8');await saveParsed(parseProduct(html,`https://booth.pm/ja/items/${id}`,avatars,store.products.find(p=>p.id===id)?.fetchedAt??stat.mtime.toISOString()),avatars,store,html);console.log('parsed',id);}
    catch(e) {console.log('parse failed; preserved',id,e instanceof Error?e.message.slice(0,500):'unknown');}
  }
}
const configSchema=z.object({products:z.array(z.string()),discovery:z.array(z.string()),intervalMs:z.number().int().min(1000),maxRequests:z.number().int().min(1).max(500),concurrency:z.literal(1),refreshDays:z.number().positive(),discoveryLimit:z.number().int().min(0).max(100),maxProducts:z.number().int().min(1).max(10000).default(10000)});
export async function crawl(mode:'initial'|'daily',configFile='config/crawl.json') {
  const c=configSchema.parse(await readJson(configFile));
  c.intervalMs=Number(process.env.CRAWL_INTERVAL_MS??c.intervalMs);c.maxRequests=Number(process.env.CRAWL_MAX_REQUESTS??c.maxRequests);c.refreshDays=Number(process.env.CRAWL_REFRESH_DAYS??c.refreshDays);c.concurrency=Number(process.env.CRAWL_CONCURRENCY??c.concurrency) as 1;
  configSchema.parse(c);
  const avatars=await seeds(),store=await loadStore();await replay(store);
  const profile=configFile==='config/crawl.json'?'':'-'+path.basename(configFile,'.json').replace(/[^a-zA-Z0-9_-]/g,'');
  const stateFile=`data/checkpoint-${mode}${profile}.json`;
  type State={run:Run;queue:string[];discovery:string[];discoveryCursor:number;cursor:number;retryAt?:number};
  let state=await readJson<State|null>(stateFile,null);
  if(!state || state.run.status==='complete') {
    const stale=store.products.filter(p=>Date.now()-Date.parse(p.fetchedAt)>=c.refreshDays*86400000).sort((a,b)=>a.fetchedAt.localeCompare(b.fetchedAt)).map(p=>p.url);
    const known=new Set(store.products.map(p=>p.id));
    state={run:{id:crypto.randomUUID(),location:'local',startedAt:new Date().toISOString(),endedAt:null,status:'running',success:0,failure:0,updated:0,cursor:0,reason:''},queue:(mode==='initial'?c.products.filter(u=>!known.has(itemId(u))):stale).slice(0,c.maxProducts),discovery:[...c.discovery],discoveryCursor:0,cursor:0};
  }
  if(state.retryAt && Date.now()<state.retryAt){console.log('Retry-After: resume after',new Date(state.retryAt).toISOString());process.exitCode=2;return;}
  state.retryAt=undefined;state.run.status='running';state.run.endedAt=null;state.run.reason='';
  const checkpoint=async()=>{
    state!.run.cursor=state!.cursor;await writeJson(stateFile,state);store.runs=store.runs.filter(r=>r.id!==state!.run.id).concat(state!.run);await writeJson(storePath,store);
    const elapsed=(Date.now()-Date.parse(state!.run.startedAt))/1000;
    const processed=state!.cursor+state!.discoveryCursor;
    const secondsPerRequest=processed?Math.max(c.intervalMs/1000,elapsed/processed):c.intervalMs/1000;
    const remaining=state!.queue.length-state!.cursor+state!.discovery.length-state!.discoveryCursor;
    await writeJson(`data/progress${profile}.json`,{runId:state!.run.id,status:state!.run.status,updatedAt:new Date().toISOString(),success:state!.run.success,failure:state!.run.failure,discoveryDone:state!.discoveryCursor,discoveryTotal:state!.discovery.length,processed:state!.cursor,total:state!.queue.length,catalogProducts:store.products.length,elapsedSeconds:Math.round(elapsed),estimatedFinish:state!.discoveryCursor===state!.discovery.length?new Date(Date.now()+remaining*secondsPerRequest*1000).toISOString():null,reason:state!.run.reason});
  };
  await checkpoint();
  // 1日全体の上限をローカルに保存。再開、手動実行、再試行を合算。
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
  const budget=await readJson(`data/budget-${day}.json`,{used:0});
  const transport:typeof fetch=async(input,init)=>{
    if(budget.used>=c.maxRequests)throw new StopCrawl('daily request budget exhausted');budget.used++;await writeJson(`data/budget-${day}.json`,budget);
    const started=Date.now();const response=await fetch(input,init);
    await fs.appendFile('data/requests.jsonl',JSON.stringify({runId:state!.run.id,at:new Date().toISOString(),url:String(input),status:response.status,durationMs:Date.now()-started})+'\n');
    return response;
  };
  const f=new PoliteFetcher({intervalMs:c.intervalMs,maxRequests:c.maxRequests,retries:2,timeoutMs:20000},transport);
  const failed=await readJson<string[]>('data/retry.json',[]);
  try {
    const robots=await f.get('https://booth.pm/robots.txt');await fs.writeFile('data/robots.txt',robots);
    const get=async(url:string)=>{if(!robotsAllows(robots,new URL(url).pathname))throw new StopCrawl('robots disallow');return f.get(url);};
    while(state.discoveryCursor<state.discovery.length) {
      const url=state.discovery[state.discoveryCursor];
      const html=await get(url);await fs.writeFile(`data/raw/discovery-${state.discoveryCursor}.html`,html);
      const known=new Set([...store.products.map(p=>p.id),...state.queue.map(itemId)]);
      const fresh=discover(html,url).filter(u=>!known.has(itemId(u))).slice(0,Math.min(c.discoveryLimit,Math.max(0,c.maxProducts-state.queue.length)));
      if(mode==='daily')state.queue.unshift(...fresh);else state.queue.push(...fresh);state.discoveryCursor++;await checkpoint();
    }
    // 日次は新着を優先し、古い商品の大量キューで翌日の検索を塞がない。
    if(mode==='daily'&&state.cursor===0){state.queue=state.queue.slice(0,Math.max(0,c.maxRequests-1-c.discovery.length));await checkpoint();}
    while(state.cursor<state.queue.length) {
      const url=state.queue[state.cursor],id=itemId(url);
      try {
        const html=await get(url);await fs.writeFile(`data/raw/${id}.html`,html);
        const p=parseProduct(html,url,avatars);await saveParsed(p,avatars,store,html);
        state.run.success++;state.run.updated++;const i=failed.findIndex(u=>itemId(u)===id);if(i>=0)failed.splice(i,1);console.log('updated',id);
      }catch(e) {if(e instanceof StopCrawl)throw e;state.run.failure++;if(!failed.includes(url))failed.push(url);console.log('failed; preserved',id);await fs.appendFile('data/failures.jsonl',JSON.stringify({id,run:state.run.id,at:new Date().toISOString(),reason:e instanceof Error?e.message.slice(0,200):'unknown'})+'\n');}
      await writeJson('data/retry.json',failed);
      state.cursor++;await checkpoint();
    }
    state.run.status='complete';
    await writeJson('data/retry.json',failed);
  }catch(e) {state.run.status='stopped';state.run.reason=e instanceof StopCrawl?e.message:'discovery/network/parse error; inspect saved HTML';if(e instanceof StopCrawl)state.retryAt=e.retryAt;process.exitCode=2;console.log(state.run.reason);}
  finally {state.run.endedAt=new Date().toISOString();await checkpoint();await queue(importSchema.parse({products:[],runs:[state.run]}));}
}
async function adminRequest(route:string,value?:unknown) {
  const base=process.env.CATALOG_API_URL,token=process.env.CATALOG_ADMIN_TOKEN;
  if(!base||!token||token.length<32)throw new Error('set CATALOG_API_URL and CATALOG_ADMIN_TOKEN (32+ chars)');
  const u=new URL(base);if(u.protocol!=='https:' && !(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw new Error('API requires HTTPS');
  const r=await fetch(new URL(`/api/admin/${route}`,u),{method:value===undefined?'GET':'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value),redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`admin API HTTP ${r.status}; outbox retained`);
  return r.json();
}
export async function sync() {
  const store=await loadStore();await replay(store);
  // 全アバター本体を先に送信し、別商品の対応関係に参照エラーを出さない。
  const avatarProducts=store.products.filter(p=>store.avatars.some(a=>a.productId===p.id));
  for(let i=0;i<avatarProducts.length;i+=50) {
    const products=avatarProducts.slice(i,i+50),selected=store.avatars.filter(a=>products.some(p=>p.id===a.productId));
    await adminRequest('import',{products,avatars:selected,bodies:store.bodies.filter(b=>selected.some(a=>a.bodyId===b.id)),compatibility:[],runs:[]});
  }
  for(const file of (await fs.readdir('data/outbox')).filter(f=>f.endsWith('.json')).sort()) {
    const data=importSchema.parse(await readJson(`data/outbox/${file}`));await adminRequest('import',data);await fs.unlink(`data/outbox/${file}`);console.log('sent',file);
  }
  for(const o of store.overrides)await adminRequest('override',o);
}
async function applyOverrides(file:string) {
  const list=z.array(overrideSchema).parse(await readJson(file)),store=await loadStore();
  for(const o of list) {
    validateOverride(o,store);
    const old=store.overrides.find(v=>v.entity===o.entity && v.key===o.key);
    store.overrides=store.overrides.filter(v=>!(v.entity===o.entity && v.key===o.key));store.overrides.push({...o,patch:{...old?.patch,...o.patch}} as Override);
  }
  await writeJson(storePath,store);console.log('saved overrides',list.length);
}
async function main() {
  const [command,arg]=process.argv.slice(2);
  if(command==='help'||!command){console.log('extract-description-avatars | publish-description-avatars | reclassify-audience | tag-floor-scope | export-floor-tagged | coverage-report | expand-avatars | plan | plan-more | plan-refresh | collect-plan | collect-gaps CONFIG | relist-saved | snapshot-local | initial | daily | parse-saved | import FILE | review | override FILE | export | sync | probe-cloudflare | retry');return;}
  // 原子的に保存されたカタログを読むだけなので、取得中もローカル表示へ反映できる。
  if(command==='snapshot-local'){await fs.writeFile('data/local-snapshot.sql',sqlExport(await loadStore()));await(await import('./export-floor-tagged')).exportFloorTagged();console.log('data/local-snapshot.sql');return;}
  if(command==='export-floor-tagged'){await (await import('./export-floor-tagged')).exportFloorTagged();return;}
  if(command==='probe-cloudflare'){console.log(await adminRequest('probe',{}));return;}
  await withLock(async()=>{
    if(command==='refresh-likes'){if(arg&&arg!=='accessory')throw new Error('refresh-likes accepts accessory only');await (await import('./refresh-likes')).refreshLikes(arg);return;}
    if(command==='tag-floor-scope'){await (await import('./export-floor-tagged')).exportFloorTagged(true);return;}
    if(command==='reclassify-audience'){await (await import('./reclassify-audience')).reclassifyAudience();return;}
    if(command==='coverage-report'){await (await import('./planned')).reportCoverage();return;}
    if(command==='publish-description-avatars'){await (await import('./publish-description-avatars')).publishDescriptionAvatars();return;}
    if(command==='extract-description-avatars'){await (await import('./extract-description-avatars')).extractDescriptionAvatars();return;}
    if(command==='collect-gaps'){if(!arg)throw new Error('gap config required');await (await import('./gaps')).collectGaps(arg);return;}
    if(command==='expand-avatars'){await (await import('./expand-avatars')).expandAvatars();return;}
    if(['plan','plan-more','plan-refresh','collect-plan','relist-saved'].includes(command)){const planned=await import('./planned');if(command==='plan'||command==='plan-more'||command==='plan-refresh')await planned.planCoverage(command==='plan-more',command==='plan-refresh');else if(command==='collect-plan')await planned.collectCoverage();else await planned.relistSaved();}
    else if(command==='initial'||command==='daily')await crawl(command,arg);
    else if(command==='parse-saved')await importSaved();
    else if(command==='import') {
      if(!arg)throw new Error('import JSON file required');const store=await loadStore(),data=importSchema.parse(await readJson(arg));checkReferences(data,store);await queue(data);mergeImport(store,data);await writeJson(storePath,store);console.log('imported',data.products.length);
    }
    else if(command==='override'){if(!arg)throw new Error('override JSON file required');await applyOverrides(arg);}
    else if(command==='export') {const store=await loadStore();await replay(store);await fs.writeFile('data/import.sql',sqlExport(store));console.log('data/import.sql');}
    else if(command==='sync')await sync();
    else if(command==='review') {const d=effective(await loadStore());console.log(JSON.stringify({products:d.products,avatars:d.avatars,compatibility:d.compatibility,runs:d.runs},null,2));}
    else if(command==='retry') {
      const urls=await readJson<string[]>('data/retry.json',[]);if(!urls.length){console.log('no failed products');return;}
      const configFile=arg??'config/crawl.json';
      const profile=configFile==='config/crawl.json'?'':'-'+path.basename(configFile,'.json').replace(/[^a-zA-Z0-9_-]/g,'');
      const file=`data/checkpoint-daily${profile}.json`;
      const previous=await readJson<any>(file,null);
      // 初回収集だけ実行したPCでもretryを利用できる。通常dailyの再開位置を上書きしない。
      if(previous?.run.status==='running'||previous?.run.status==='stopped')throw new Error('daily checkpoint unfinished; resume daily before retry');
      const state={queue:urls,cursor:0,discovery:[],discoveryCursor:0,run:{id:crypto.randomUUID(),location:'local',startedAt:new Date().toISOString(),endedAt:null,status:'stopped',success:0,failure:0,updated:0,cursor:0,reason:''}};
      await writeJson(file,state);await crawl('daily',configFile);
    } else throw new Error('unknown command; run help');
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e instanceof Error?e.message:'failed');process.exitCode=1;});
