import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readJson,writeJson,withLock} from '../src/cli/files';
import {accessorySearchTerms,reviewedAccessory} from '../src/cli/full-accessory-review';
import {type Catalog,type Override,effective,importSchema,publicCatalog} from '../src/shared/model';
import {PoliteFetcher,StopCrawl,robotsAllows} from '../src/shared/fetcher';
import {parseProduct,searchPage,itemId} from '../src/shared/parser';
import {parseLikes} from '../src/shared/likes';
import {mergeImport,importStatements,overrideStatement,type Statement} from '../src/shared/storage';

type Source={query:string,url:string,next:string|null,pages:number,totalReported:number|null,ids:string[],visited:string[],complete:boolean};
type State={id:string,startedAt:string,phase:'discovery'|'products'|'likes'|'complete'|'waiting'|'stopped',sources:Source[],queue:string[],cursor:number,likesCursor:number,downloaded:number,cached:number,failed:{id:string,reason:string}[],requests:number,added:string[],retryAt:number,reason:string,updatedAt:string,estimatedFinish:string|null};
const file='data/full-accessories/state.json',delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());
const sources=():Source[]=>[
 {category:'3D装飾品',query:''},
 ...accessorySearchTerms.map(query=>({category:'3D衣装',query}))
].map(({category,query})=>{const u=new URL('https://booth.pm/ja/browse/'+encodeURIComponent(category));if(query)u.searchParams.set('q',query);u.searchParams.set('sort','new');return {query:query||'3D装飾品全体',url:u.href,next:u.href,pages:0,totalReported:null,ids:[],visited:[],complete:false};});
const sql=(ss:Statement[])=>ss.map(s=>{let i=0;return s.sql.replace(/\?/g,()=>{const v=s.params[i++];return v===null?'NULL':typeof v==='number'?String(v):"'"+v.replace(/'/g,"''")+"'";})+';';}).join('\n');
const wrangler=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));

await withLock(async()=>{
 let store=await readJson<Catalog>('data/catalog.json');
 const baseline=publicCatalog(store);
 const state=await readJson<State>(file,{id:crypto.randomUUID(),startedAt:new Date().toISOString(),phase:'discovery',sources:sources(),queue:[],cursor:0,likesCursor:0,downloaded:0,cached:0,failed:[],requests:0,added:[],retryAt:0,reason:'',updatedAt:new Date().toISOString(),estimatedFinish:null});
 if(state.phase==='complete'){console.log('Full collection already complete');return;}
 await writeJson('data/full-accessories/baseline.json',await readJson('data/full-accessories/baseline.json',{at:state.startedAt,total:baseline.products.filter(p=>p.kind==='accessory').length,ids:baseline.products.filter(p=>p.kind==='accessory').map(p=>p.id)}));
 const classified=await readJson<{id:string,category:string,evidence:string,fetchedAt?:string}[]>('config/accessory-classification.json');
 const protectedIds=new Set(classified.map(c=>c.id));
 const avatars=effective(store).avatars.filter(a=>a.review==='verified');
 const changed=new Set<string>(state.added);
 const save=async()=>{
  state.updatedAt=new Date().toISOString();
  const remaining=state.queue.length-state.cursor;
  state.estimatedFinish=state.sources.every(s=>s.complete)?new Date(Date.now()+remaining*4000).toISOString():null;
  await writeJson(file,state);
  await writeJson('data/progress-full-accessories.json',{runId:state.id,phase:state.phase,updatedAt:state.updatedAt,sourcesComplete:state.sources.filter(s=>s.complete).length,sourcesTotal:state.sources.length,pages:state.sources.reduce((n,s)=>n+s.pages,0),discovered:new Set(state.sources.flatMap(s=>s.ids)).size,processed:state.cursor,total:state.queue.length,downloaded:state.downloaded,cached:state.cached,failed:state.failed.length,added:state.added.length,requests:state.requests,estimatedFinish:state.estimatedFinish,retryAt:state.retryAt?new Date(state.retryAt).toISOString():null,reason:state.reason});
 };
 const publish=async()=>{
  if(!changed.size)return;
  await writeJson('data/catalog.json',store);
  const ids=new Set(changed),products=store.products.filter(p=>ids.has(p.id));
  const ss:Statement[]=[];
  for(let i=0;i<products.length;i+=25){const part=products.slice(i,i+25);ss.push(...importStatements({products:part,avatars:[],bodies:[],runs:[],compatibility:store.compatibility.filter(r=>part.some(p=>p.id===r.productId))}));}
  ss.push(...store.overrides.filter(o=>o.entity==='product'?ids.has(o.key):o.entity==='compatibility'&&ids.has(o.key.split(':')[0])).map(overrideStatement));
  const target='data/full-accessories/update.sql';await fs.writeFile(target,sql(ss));
  const result=spawnSync(process.execPath,[wrangler,'d1','execute','catalog','--local','--file',target],{cwd:process.cwd(),encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
  await fs.appendFile('data/logs/full-accessories-import.log',(result.stdout??'')+(result.stderr??''));
  if(result.status!==0)throw new StopCrawl('local database import failed; saved catalog retained');
  await writeJson('config/accessory-classification.json',classified);changed.clear();
 };
 const setOverride=(o:Override)=>{const old=store.overrides.find(x=>x.entity===o.entity&&x.key===o.key);store.overrides=store.overrides.filter(x=>!(x.entity===o.entity&&x.key===o.key));store.overrides.push({...o,patch:{...old?.patch,...o.patch}} as Override);};
 await fs.mkdir('data/raw/full-accessories',{recursive:true});await fs.mkdir('data/logs',{recursive:true});await save();
 while(state.phase!=='complete'){
  if(state.retryAt>Date.now()){
   state.phase='waiting';await save();await delay(Math.min(60000,state.retryAt-Date.now()));continue;
  }
  state.reason='';state.retryAt=0;
  const f=new PoliteFetcher({intervalMs:3000,maxRequests:Infinity,retries:1,timeoutMs:20000},async(input,init)=>{
   const today=day(),b=await readJson(`data/budget-${today}.json`,{used:0});
   if(b.used>=12000){const tomorrow=new Date();tomorrow.setTime(Date.now()+86400000);const next=new Date(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(tomorrow)+'T00:01:00+09:00').getTime();throw new StopCrawl('daily request budget; automatic resume next day',next);}
   b.used++;state.requests++;await writeJson(`data/budget-${today}.json`,b);
   const start=Date.now(),r=await fetch(input,init);await fs.appendFile('data/requests.jsonl',JSON.stringify({runId:state.id,at:new Date().toISOString(),url:String(input),status:r.status,durationMs:Date.now()-start})+'\n');return r;
  });
  try{
   const robots=await f.get('https://booth.pm/robots.txt');await fs.writeFile('data/full-accessories/robots.txt',robots);
   const get=(url:string)=>{if(!robotsAllows(robots,new URL(url).pathname))throw new StopCrawl('robots disallow');return f.get(url);};
   state.phase=state.sources.every(s=>s.complete)?'products':'discovery';await save();
   // 件数・ページ数の打ち切りなし。ページを巡回し、公式の次ページがなくなるまで取得する。
   while(state.sources.some(s=>!s.complete))for(const source of state.sources){
    if(source.complete)continue;
    const url=source.next!;
    if(source.visited.includes(url))throw new StopCrawl('pagination loop; coverage incomplete');
    const html=await get(url),parsed=searchPage(html,url);
    const filename=createHash('sha256').update(url).digest('hex');await fs.writeFile(`data/raw/full-accessories/search-${filename}.html`,html);
    source.totalReported??=parsed.totalReported;source.ids=[...new Set([...source.ids,...parsed.urls.map(itemId)])];source.visited.push(url);source.pages++;source.next=parsed.next;source.complete=!source.next;
    await save();if(state.requests%25===0)console.log(`discovery: ${state.sources.reduce((n,s)=>n+s.pages,0)} pages, ${state.sources.filter(s=>s.complete).length}/${state.sources.length} sources`);
   }
   if(!state.queue.length)state.queue=[...new Set(state.sources.flatMap(s=>s.ids))];
   state.phase='products';await save();console.log(`all search pages exhausted; ${state.queue.length} unique products`);
   let batch=0;
   while(state.cursor<state.queue.length){
    const id=state.queue[state.cursor],url=`https://booth.pm/ja/items/${id}`,raw=`data/raw/${id}.html`;
    const existing=store.products.find(p=>p.id===id);
    try{
     let html:string,fetchedAt:string;
     try{html=await fs.readFile(raw,'utf8');fetchedAt=existing?.fetchedAt??(await fs.stat(raw)).mtime.toISOString();state.cached++;}
     catch(e:any){if(e.code!=='ENOENT')throw e;html=await get(url);fetchedAt=new Date().toISOString();await fs.writeFile(raw,html);state.downloaded++;}
     const parsed=existing?{product:existing,compatibility:store.compatibility.filter(r=>r.productId===id)}:parseProduct(html,url,avatars,fetchedAt);
     if(!existing){const data=importSchema.parse({products:[parsed.product],compatibility:parsed.compatibility.filter(r=>r.targetType==='body'||avatars.some(a=>a.id===r.targetId))});mergeImport(store,data);}
     if(!protectedIds.has(id)){
      const reviewed=reviewedAccessory(html,parsed.product,avatars,store.bodies);
      if(reviewed){
       setOverride({entity:'product',key:id,patch:{kind:'accessory',category:reviewed.category,review:'verified'}});
       for(const r of reviewed.relations)setOverride({entity:'compatibility',key:`${id}:${r.targetType}:${r.targetId}`,patch:{fit:r.fit,review:'verified',evidence:r.evidence,variantNames:r.variantNames}});
       classified.push({id,category:reviewed.category,evidence:'全ページ収集後、作者の対応一覧・販売版を照合。',fetchedAt:parsed.product.fetchedAt});protectedIds.add(id);if(!state.added.includes(id))state.added.push(id);changed.add(id);
      }
     }
    }catch(e){if(e instanceof StopCrawl)throw e;state.failed.push({id,reason:e instanceof Error?e.message.slice(0,200):'unknown'});}
    state.cursor++;batch++;
    if(batch>=50){await publish();await writeJson('data/catalog.json',store);await save();console.log(`products ${state.cursor}/${state.queue.length}, added ${state.added.length}, failed ${state.failed.length}`);batch=0;}
   }
   await publish();await writeJson('data/catalog.json',store);
   state.phase='likes';await save();
   const likeProducts=publicCatalog(store).products.filter(p=>p.kind==='accessory');
   const accountRobots=await f.get('https://accounts.booth.pm/robots.txt');
   if(!robotsAllows(accountRobots,'/wish_lists.json'))throw new StopCrawl('robots disallow wish_lists');
   while(state.likesCursor<likeProducts.length){
    const ids=likeProducts.slice(state.likesCursor,state.likesCursor+24).map(p=>p.id),u=new URL('https://accounts.booth.pm/wish_lists.json');for(const id of ids)u.searchParams.append('item_ids[]',id);
    const counts=parseLikes(await f.get(u.href),ids),at=new Date().toISOString();
    for(const [id,count] of counts){const p=store.products.find(p=>p.id===id)!;p.likes=count;p.likesFetchedAt=at;}
    await writeJson('data/catalog.json',store);state.likesCursor+=ids.length;await save();
   }
   const likesFile='data/full-accessories/likes.sql';
   await fs.writeFile(likesFile,likeProducts.map(item=>{const p=store.products.find(p=>p.id===item.id)!;return `UPDATE products SET payload=json_set(payload,'$.likes',${p.likes??'NULL'},'$.likesFetchedAt','${p.likesFetchedAt}') WHERE id='${p.id}';`;}).join('\n'));
   const result=spawnSync(process.execPath,[wrangler,'d1','execute','catalog','--local','--file',likesFile],{cwd:process.cwd(),windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024});
   await fs.appendFile('data/logs/full-accessories-import.log',(result.stdout??'')+(result.stderr??''));
   if(result.status!==0)throw new StopCrawl('local database likes import failed');
   state.phase='complete';await save();
   const pub=publicCatalog(store),accessories=pub.products.filter(p=>p.kind==='accessory');
   const counts:Record<string,number>={};for(const p of accessories)counts[p.category]=(counts[p.category]??0)+1;
   await writeJson('data/full-accessories/result.json',{finishedAt:new Date().toISOString(),sources:state.sources,uniqueProducts:state.queue.length,downloaded:state.downloaded,cached:state.cached,failed:state.failed,added:state.added,total:accessories.length,counts});
   const lines=['# 小物の全ページ収集結果','',`完了：${new Date().toISOString()} UTC`,`検索起点 ${state.sources.length}件の全ページを走査。商品 ${state.queue.length}件、追加掲載 ${state.added.length}件、小物合計 ${accessories.length}件。`,`取得不能・解析失敗 ${state.failed.length}件は result.json に記録。BOOTH全体の網羅を保証するものではなく、指定カテゴリと検索起点の全ページ収集。`,'','| 種類 | 件数 |','|---|---:|',...Object.entries(counts).map(([k,v])=>`| ${k} | ${v} |`),'','## 検索起点・取得日時','',...state.sources.map(s=>`- [${s.query}](${s.url})：${s.pages}ページ、${s.ids.length}件（更新：${state.updatedAt} UTC）`),'','## 追加商品','',...state.added.map(id=>{const p=accessories.find(p=>p.id===id);return p?`- [${p.name.replaceAll('\n',' ')}](${p.url})：${p.category}、取得 ${p.fetchedAt} UTC`:id;})];
   await fs.writeFile('docs/full-accessory-crawl-result.md',lines.join('\n'));console.log(`COMPLETE: ${accessories.length} accessories`);
  }catch(e){
   if(!(e instanceof Error&&e.message.includes('database')))await publish();await writeJson('data/catalog.json',store);
   state.reason=e instanceof Error?e.message:'unknown';state.retryAt=e instanceof StopCrawl?e.retryAt??0:e instanceof Error&&/network|timeout|HTTP 5\d\d/.test(e.message)?Date.now()+60000:0;
   state.phase=state.retryAt?'waiting':'stopped';await save();console.log(state.reason);
   if(!state.retryAt)break; // robots、認証・challenge・DB障害は自動で回避しない。
  }
 }
});
