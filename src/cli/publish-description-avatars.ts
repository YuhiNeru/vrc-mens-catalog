import fs from 'node:fs/promises';
import {load} from 'cheerio/slim';
import {Avatar,avatarSchema,importSchema,publicCatalog} from '../shared/model';
import {authorDescription,extractDescriptionTargets} from '../shared/description-avatars';
import {parseProduct} from '../shared/parser';
import {PoliteFetcher,StopCrawl,robotsAllows} from '../shared/fetcher';
import {checkReferences,mergeImport} from '../shared/storage';
import {empty,readJson,writeJson} from './files';

export async function publishDescriptionAvatars(){
 const list=(await readJson<any>('config/description-avatar-candidates.json')).candidates;
 const state=await readJson<any>('data/description-avatar-publication.json',{startedAt:new Date().toISOString(),phase:'review',cursor:0,results:[],reason:'',retryAt:0});
 if(state.phase==='complete'){console.log('Description avatar publication complete');return;}
 if(state.retryAt>Date.now()){console.log('Retry-After cooldown');process.exitCode=2;return;}
 const store=await readJson('data/catalog.json',empty()),seeds=await readJson<Avatar[]>('config/avatars.json');
 // 抽出時の区分を信用せず、現在の解析で作者の対応一覧を再確認する。
 const sourceTargets=new Map<string,ReturnType<typeof extractDescriptionTargets>>();
 const femaleIds=new Set((await readJson<any[]>('config/female-targets.json',[])).map(v=>v.productId));
 for(const sourceId of new Set<string>(list.flatMap((c:any)=>c.sources.map((s:any)=>s.productId)))){
   const targets=extractDescriptionTargets(await fs.readFile(`data/raw/${sourceId}.html`,'utf8'),[]);
   sourceTargets.set(sourceId,targets);
   for(const target of targets)if(target.gender==='female'&&!target.planned&&target.productId)femaleIds.add(target.productId);
 }
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date()),budget=await readJson(`data/budget-${day}.json`,{used:0});
 const f=new PoliteFetcher({intervalMs:3000,maxRequests:150,retries:1,timeoutMs:20000},async(input,init)=>{
   if(budget.used>=12000)throw new StopCrawl('daily request budget exhausted');budget.used++;await writeJson(`data/budget-${day}.json`,budget);
   const r=await fetch(input,init);await fs.appendFile('data/requests.jsonl',JSON.stringify({runId:'description-avatar-publication',at:new Date().toISOString(),url:String(input),status:r.status})+'\n');return r;
 });
 const save=async()=>{await writeJson('data/description-avatar-publication.json',state);await writeJson('data/progress-avatar-floor.json',{phase:state.phase,processed:new Set(state.results.map((x:any)=>x.productId)).size,total:list.length,published:state.results.filter((x:any)=>x.status==='published').length,held:state.results.filter((x:any)=>x.status!=='published').length,totalFloorAvatars:publicCatalog(store).avatars.length,estimatedFinish:state.phase==='review'?new Date(Date.now()+(list.length-state.cursor)*3500).toISOString():null,reason:state.reason});};
 try{
   state.reason='';state.retryAt=0;const robots=await f.get('https://booth.pm/robots.txt');await fs.writeFile('data/robots.txt',robots);
   for(;state.cursor<list.length;state.cursor++){
     const c=list[state.cursor],url=`https://booth.pm/ja/items/${c.productId}`;
     if(publicCatalog(store).avatars.some(a=>a.productId===c.productId)){state.results.push({productId:c.productId,status:'already-published'});await save();continue;}
     if(!robotsAllows(robots,new URL(url).pathname))throw new StopCrawl('robots disallow');
     let html:string;
     try{html=await f.get(url);}catch(e){if(e instanceof StopCrawl)throw e;state.results.push({productId:c.productId,name:c.name,url,status:'unavailable',checkedAt:new Date().toISOString(),reason:e instanceof Error?e.message:'fetch failure'});await save();continue;}
     const checkedAt=new Date().toISOString();await fs.writeFile(`data/raw/${c.productId}.html`,html);
     const $=load(html),root=$(`[data-product-id="${c.productId}"][data-tracking="detail_item"]`).first(),description=authorDescription(html);
     const lines=description.split(/\n/).map(x=>x.trim()).filter(Boolean);
     const primaryMale=lines.find(l=>l.length<300&&/男性(?:アバター|モデル|キャラ|向け|用)|男の子|少年(?:アバター|モデル|です)|青年(?:アバター|モデル)|お兄さん|male avatar|boy avatar/i.test(l)&&!/(衣装|衣服|服装|着せ|対応衣装|利用規約)/.test(l));
     const primaryFemale=lines.find(l=>l.length<300&&/女の子|少女|女性(?:アバター|モデル|キャラ)|female avatar|girl avatar/i.test(l)&&!/(衣装|対応|利用規約|シェイプキー)/.test(l));
     const isBody=/素体|制作者向け/.test($('title').text())&&!/オリジナル(?:3D)?(?:モデル|アバター)/.test($('title').text());
     const genderSource=c.sources.find((s:any)=>!s.planned&&sourceTargets.get(s.productId)?.some(t=>t.productId===c.productId&&t.gender==='male'&&!t.planned));
     const avatarCategory=root.attr('data-product-category')==='208';
     if(isBody||!avatarCategory||primaryFemale||(!primaryMale&&(!genderSource||femaleIds.has(c.productId)))){
       state.results.push({productId:c.productId,name:c.name,url,title:$('title').text(),category:root.attr('data-product-category'),status:isBody?'shared-body':!avatarCategory?'category-review':primaryFemale?'gender-review':'insufficient-evidence',checkedAt,reason:primaryFemale??'本体・男性向け対応一覧の根拠不足'});await save();continue;
     }
     const old=seeds.find(a=>a.productId===c.productId),id=old?.id??`avatar-${c.productId}`;
     const candidate=avatarSchema.parse({id,productId:c.productId,name:old?.name??c.name,aliases:old?.aliases??[],author:'',bodyId:old?.bodyId??null,bodyEvidence:old?.bodyEvidence??'',genderEvidence:primaryMale?.slice(0,400)??`衣装作者の男性向け対応対象「${genderSource.genderEvidence}」に本体URLを確認。${genderSource.url}`,ageGroup:/男の子|少年/.test(primaryMale??'')?'少年':/青年/.test(primaryMale??'')?'青年':'未分類',review:'verified'});
     let p;
     try{p=parseProduct(html,url,[candidate],checkedAt).product;}catch(e){state.results.push({productId:c.productId,url,status:'parse-review',checkedAt,reason:e instanceof Error?e.message:'parse failure'});await save();continue;}
     // 正式商品名はBOOTHに従う。抽出時の仮名や別商品のURLとの取り違えを残さない。
     const named=p.name.match(/[「『]([^」』]{1,80})[」』]/)?.[1];
     candidate.name=named??old?.name??p.name.replace(/(?:【|\[)(?:オリジナル3Dモデル|オリジナル3Dアバター|3Dモデル|3Dアバター)(?:】|\])/g,'').replace(/\s*(?:ver\.?|version)\s*[\d.]+.*$/i,'').trim().slice(0,120);
     candidate.author=p.shop;
     // 仮名は販売対象版の照合に使える短い明示名だけに限定する。
     const aliases=[...candidate.aliases,...(c.names as string[]).filter(n=>n.length<36&&!/https|オリジナル|様|対応|未対応|素材|Ver\.|ver\.|version|【|】/.test(n))].map(n=>n.replace(/^[『「]|[』」]$/g,'').trim());
     candidate.aliases=[...new Set(aliases)].filter(n=>n!==candidate.name&&n.length>=2).slice(0,12);
     p.review='verified';
     const data=importSchema.parse({products:[p],avatars:[candidate]});checkReferences(data,store);mergeImport(store,data);
     const patches=[{entity:'product',key:p.id,patch:{kind:'avatar',review:'verified'}},{entity:'avatar',key:id,patch:{name:candidate.name,aliases:candidate.aliases,author:candidate.author,genderEvidence:candidate.genderEvidence,ageGroup:candidate.ageGroup,review:'verified'}}] as const;
     for(const o of patches){store.overrides=store.overrides.filter(v=>!(v.entity===o.entity&&v.key===o.key));store.overrides.push(o as any);}
     const index=seeds.findIndex(a=>a.id===id);if(index<0)seeds.push(candidate);else seeds[index]=candidate;
     await writeJson(`data/outbox/${Date.now()}-${crypto.randomUUID()}.json`,data);await writeJson('data/catalog.json',store);await writeJson('config/avatars.json',seeds);
     state.results.push({productId:p.id,id,name:candidate.name,url,status:'published',checkedAt,genderEvidence:candidate.genderEvidence,primaryMale:primaryMale??null,category:root.attr('data-product-category')});console.log('published',candidate.name);await save();
   }
   state.phase='complete';state.finishedAt=new Date().toISOString();
 }catch(e){state.phase='stopped';state.reason=e instanceof Error?e.message:'unknown';if(e instanceof StopCrawl)state.retryAt=e.retryAt??0;process.exitCode=2;console.log(state.reason);}
 finally{await save();await writeJson('config/reviewed-description-avatars.json',store.overrides.filter(o=>state.results.some((r:any)=>r.status==='published'&&(o.entity==='avatar'?r.id===o.key:o.entity==='product'&&r.productId===o.key))));}
}
