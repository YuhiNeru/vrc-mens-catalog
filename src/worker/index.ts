import { Catalog, importSchema, overrideSchema, publicCatalog } from '../shared/model';
import {byLikes} from '../shared/likes';
import {accessoryFloors,isAccessoryFloor} from '../shared/floors';
import { checkReferences, importStatements, loadD1, overrideStatement, validateOverride } from '../shared/storage';
import { PoliteFetcher, robotsAllows } from '../shared/fetcher';
import { discover, parseProduct } from '../shared/parser';

interface Env { DB:D1Database; ASSETS:Fetcher; ADMIN_TOKEN?:string; CRAWLER_MODE?:string; CATALOG_CACHE_MS?:string }
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' https://*.pximg.net; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{...security,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const cached=(data:unknown)=>Response.json(data,{headers:{...security,'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=30, stale-while-revalidate=120'}});
async function authorized(req:Request,env:Env) {
  if(!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length<32)return false;
  const supplied=req.headers.get('Authorization')??'';
  const hash=(s:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  const [a,b]=await Promise.all([hash(supplied),hash(`Bearer ${env.ADMIN_TOKEN}`)]);
  const left=new Uint8Array(a),right=new Uint8Array(b);let diff=0;for(let i=0;i<left.length;i++)diff|=left[i]^right[i];return diff===0;
}
async function body(req:Request) {
  if(!req.headers.get('content-type')?.startsWith('application/json'))throw new Error('JSON required');
  const reader=req.body?.getReader();if(!reader)throw new Error('body required');
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024){await reader.cancel();throw new Error('payload too large');}chunks.push(value);}
  const joined=new Uint8Array(size);let offset=0;for(const x of chunks){joined.set(x,offset);offset+=x.length;}
  return JSON.parse(new TextDecoder().decode(joined));
}
// 公開カタログの変換は重いので、同一isolate内で短時間再利用する（管理APIの書き込みで破棄）。
const CACHE_MS=30_000;
type Derived=ReturnType<typeof derive>;
const catalogCache=new WeakMap<object,{at:number,value:Promise<Derived>}>();
function derive(data:ReturnType<typeof publicCatalog>){
 const productById=new Map(data.products.map(p=>[p.id,p]));
 const byTarget=new Map<string,Set<string>>();
 for(const r of data.compatibility){const k=r.targetType+':'+r.targetId;let s=byTarget.get(k);if(!s)byTarget.set(k,s=new Set());s.add(r.productId);}
 const productIds=(a:typeof data.avatars[number])=>{const ids=new Set(byTarget.get('avatar:'+a.id));if(a.bodyId&&a.bodyEvidence)for(const id of byTarget.get('body:'+a.bodyId)??[])ids.add(id);return ids;};
 const avatarList=data.avatars.map(a=>{
  const ids=productIds(a);let clothingCount=0,unisexClothingCount=0,menAccessoryCount=0,accessoryCount=0;
  for(const id of ids){const p=productById.get(id);if(!p)continue;if(p.kind==='clothing'){clothingCount++;if(p.audience==='unisex')unisexClothingCount++;}else if(p.kind==='accessory'){accessoryCount++;if(p.audience!=='unisex')menAccessoryCount++;}}
  return {...a,product:productById.get(a.productId),clothingCount,menClothingCount:clothingCount-unisexClothingCount,unisexClothingCount,menAccessoryCount,accessoryCount};
 }).sort((a,b)=>b.menClothingCount-a.menClothingCount||a.name.localeCompare(b.name,'ja')||a.id.localeCompare(b.id));
 const avatarMap=new Map(avatarList.map(a=>[a.id,a]));
 return {data,productById,avatarList,avatarMap,productIds};
}
function loadCatalog(env:Env):Promise<Derived>{
 const hit=catalogCache.get(env.DB);if(hit&&Date.now()-hit.at<Number(env.CATALOG_CACHE_MS??CACHE_MS))return hit.value;
 const value=loadD1(env.DB).then(c=>derive(publicCatalog(c)));
 catalogCache.set(env.DB,{at:Date.now(),value});value.catch(()=>catalogCache.delete(env.DB));return value;
}
export async function handle(req:Request,env:Env):Promise<Response> {
 const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith('/api/')) {
   if(req.method!=='GET' && req.method!=='HEAD')return json({error:'method not allowed'},405);
   const response=await env.ASSETS.fetch(req);const h=new Headers(response.headers);for(const [k,v]of Object.entries(security))h.set(k,v);
   return new Response(response.body,{status:response.status,headers:h});
 }
 if(path.startsWith('/api/admin/')) {
   if(!await authorized(req,env))return json({error:'unauthorized'},401);
   if(path==='/api/admin/review' && req.method==='GET')return json(await loadD1(env.DB));
   if(path==='/api/admin/import' && req.method==='POST') {
     let data;try {data=importSchema.parse(await body(req));checkReferences(data,await loadD1(env.DB));}catch{return json({error:'invalid import'},400);}
     const statements=importStatements(data);if(statements.length)await env.DB.batch(statements.map(s=>env.DB.prepare(s.sql).bind(...s.params)));catalogCache.delete(env.DB);
     return json({imported:data.products.length});
   }
   if(path==='/api/admin/override' && req.method==='POST') {
     let o;try{o=overrideSchema.parse(await body(req));validateOverride(o,await loadD1(env.DB));}catch{return json({error:'invalid override'},400);}
     const s=overrideStatement(o);await env.DB.prepare(s.sql).bind(...s.params).run();catalogCache.delete(env.DB);return json({saved:true});
   }
   // 公開HTTPのprobeも認証必須。取得先を固定しSSRFと大量取得を避ける。
   if(path==='/api/admin/probe' && req.method==='POST') {
     const f=new PoliteFetcher({intervalMs:3000,maxRequests:3,retries:0,timeoutMs:15000});
     try {
       const robots=await f.get('https://booth.pm/robots.txt');
       const item='https://hyuuganatu.booth.pm/items/5260363',search='https://booth.pm/ja/search/'+encodeURIComponent('狛乃 衣装')+'?sort=new';
       if(!robotsAllows(robots,new URL(item).pathname)||!robotsAllows(robots,new URL(search).pathname))return json({ok:false,reason:'robots disallow'});
       const parsed=parseProduct(await f.get(item),item,[]);const found=discover(await f.get(search),search);
       return json({ok:true,productId:parsed.product.id,name:parsed.product.name,variants:parsed.product.variants.length,searchCount:found.length,location:'cloudflare',note:'定期収集はlocalのままです'});
     }catch{return json({ok:false,reason:'fetch or parse failed; use local crawler'});}
   }
   return json({error:'not found or method not allowed'},404);
 }
 if(!['GET','HEAD'].includes(req.method))return json({error:'method not allowed'},405);
 if(path==='/api/health')return json({ok:true,crawlerMode:env.CRAWLER_MODE??'local'});
 if(!['/api/avatars','/api/products'].includes(path) && !/^\/api\/avatars\/[a-zA-Z0-9_+-]+$/.test(path))return json({error:'not found'},404);
 const {data,avatarList,avatarMap}=await loadCatalog(env);
 const keyword=(url.searchParams.get('q')??'').normalize('NFKC').toLowerCase().slice(0,100);
 const matches=(...s:string[])=>s.join(' ').normalize('NFKC').toLowerCase().includes(keyword);
 if(path==='/api/avatars')return cached({items:keyword?avatarList.filter(a=>matches(a.name,...a.aliases,a.author)):avatarList});
 const detail=path.match(/^\/api\/avatars\/(.+)$/);
 if(detail) {
   const a=avatarMap.get(detail[1]);if(!a)return json({error:'not found'},404);
   const rs=data.compatibility.filter(r=>r.targetType==='avatar'?r.targetId===a.id:r.targetId===a.bodyId && Boolean(a.bodyEvidence));
   const related=(kind:'clothing'|'accessory')=>data.products.filter(p=>p.kind===kind&&rs.some(r=>r.productId===p.id)).sort(byLikes).map(p=>({...p,compatibility:rs.filter(r=>r.productId===p.id)}));
   return cached({...a,clothing:related('clothing'),accessories:related('accessory')});
 }
 const kind=url.searchParams.get('kind')??'clothing';
 if(!['clothing','accessory'].includes(kind))return json({error:'invalid kind'},400);
 let items=data.products.filter(p=>p.kind===kind&&matches(p.name,p.shop,...p.tags,...p.catalogTags));
 const floor=url.searchParams.get('floor');
 if(floor&&!isAccessoryFloor(floor))return json({error:'invalid floor'},400);
 const inFloor=(p:{category:string})=>!floor||!isAccessoryFloor(floor)||(accessoryFloors[floor] as readonly string[]).includes(p.category)||(floor==='goods'&&!Object.values(accessoryFloors).some(c=>(c as readonly string[]).includes(p.category)));
 if(floor)items=items.filter(inFloor);
 const tag=url.searchParams.get('tag');
 if(tag)items=items.filter(p=>p.catalogTags.includes(tag));
 const audience=url.searchParams.get('audience')??(kind==='accessory'?'all':'men');
 if(!['men','unisex','all'].includes(audience))return json({error:'invalid audience'},400);
 if(audience==='unisex')items=items.filter(p=>p.audience==='unisex');
 if(audience==='men')items=items.filter(p=>p.audience!=='unisex');
 const avatar=url.searchParams.get('avatar');
 if(avatar) {
   const a=data.avatars.find(a=>a.id===avatar);
   items=items.filter(p=>a && data.compatibility.some(r=>r.productId===p.id && (r.targetType==='avatar'?r.targetId===a.id:r.targetId===a.bodyId && Boolean(a.bodyEvidence))));
 }
 for(const field of ['category','style'] as const) {const value=url.searchParams.get(field);if(value)items=items.filter(p=>p[field]===value);}
 for(const [param,test]of [['minPrice',(p:number,n:number)=>p>=n],['maxPrice',(p:number,n:number)=>p<=n]] as const) {
   const raw=url.searchParams.get(param);if(raw!==null && raw!=='') {const n=Number(raw);if(!Number.isFinite(n)||n<0)return json({error:'invalid price'},400);items=items.filter(p=>p.priceMin!==null && test(p.priceMin,n));}
 }
 const sort=url.searchParams.get('sort');items.sort(sort==='likes'?byLikes:(a,b)=> sort==='priceAsc'?(a.priceMin??Infinity)-(b.priceMin??Infinity):sort==='priceDesc'?(b.priceMin??-1)-(a.priceMin??-1):(b.publishedAt??b.fetchedAt).localeCompare(a.publishedAt??a.fetchedAt));
 const page=Number(url.searchParams.get('page')??1);if(!Number.isInteger(page)||page<1)return json({error:'invalid page'},400);
 const scoped=data.products.filter(p=>p.kind===kind&&inFloor(p));
 const categories=[...new Set(scoped.map(p=>p.category))],styles=[...new Set(scoped.map(p=>p.style))];
 const categoryPreviews=kind==='accessory'?categories.map(category=>{
   const products=scoped.filter(p=>p.category===category).sort(byLikes);
   const cover=products.find(p=>p.imageUrl);
   return {category,count:products.length,imageUrl:cover?.imageUrl??null,productName:cover?.name??null};
 }):[];
 return cached({items:items.slice((page-1)*24,page*24).map(p=>({...p,compatibility:data.compatibility.filter(r=>r.productId===p.id)})),total:items.length,page,categories,categoryPreviews,styles,avatars:data.avatars});
}
export default {async fetch(req:Request,env:Env) {try{return await handle(req,env);}catch {return json({error:'service unavailable'},503);}}};
