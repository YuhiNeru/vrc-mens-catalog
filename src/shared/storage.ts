import { Catalog, ImportData, Override, compatibilitySchema, relationKey, materializeCatalogTags } from './model';
export type Statement={sql:string,params:(string|number|null)[]};
const upsert=(table:string,id:string,payload:unknown):Statement=>({sql:`INSERT INTO ${table}(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`,params:[id,JSON.stringify(payload)]});
export function importStatements(data:ImportData):Statement[] {
  const s:Statement[]=[];
  for(const p of data.products) s.push({sql:'INSERT INTO products(id,payload,fetched_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at WHERE excluded.fetched_at >= products.fetched_at',params:[p.id,JSON.stringify(p),p.fetchedAt]});
  for(const b of data.bodies)s.push(upsert('bodies',b.id,b));
  for(const a of data.avatars)s.push({sql:'INSERT INTO avatars(id,product_id,body_id,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id,body_id=excluded.body_id,payload=excluded.payload',params:[a.id,a.productId,a.bodyId,JSON.stringify(a)]});
  // 古いoutbox再送が新しい対応関係を巻き戻さないよう取得日時を条件にする。
  for(const p of data.products) {
    s.push({sql:'DELETE FROM compatibility WHERE product_id=? AND EXISTS(SELECT 1 FROM products WHERE id=? AND fetched_at=?)',params:[p.id,p.id,p.fetchedAt]});
    for(const r of data.compatibility.filter(r=>r.productId===p.id))s.push({sql:'INSERT INTO compatibility(product_id,target_type,target_id,payload) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM products WHERE id=? AND fetched_at=?) ON CONFLICT(product_id,target_type,target_id) DO UPDATE SET payload=excluded.payload',params:[r.productId,r.targetType,r.targetId,JSON.stringify(r),p.id,p.fetchedAt]});
  }
  for(const r of data.runs)s.push(upsert('crawl_runs',r.id,r));
  return s;
}
export function overrideStatement(o:Override):Statement {
  const entries=Object.entries(o.patch);
  // JSON Merge Patchはnullを削除するため、明示的なbodyId:nullを保持できるjson_setを使う。
  const expression=entries.length?`json_set(overrides.patch,${entries.map(()=> '?,json(?)').join(',')})`:'overrides.patch';
  return {sql:`INSERT INTO overrides(entity,entity_key,patch,updated_at) VALUES(?,?,?,?) ON CONFLICT(entity,entity_key) DO UPDATE SET patch=${expression},updated_at=excluded.updated_at`,params:[o.entity,o.key,JSON.stringify(o.patch),new Date().toISOString(),...entries.flatMap(([k,v])=>['$.'+k,JSON.stringify(v)])]};
}
export function sqlExport(data:Catalog) {
  materializeCatalogTags(data);
  const statements=[...importStatements(data),...data.overrides.map(overrideStatement)];
  return 'PRAGMA foreign_keys=ON;\n'+statements.map(s=> {
    let i=0;return s.sql.replace(/\?/g,()=> {const v=s.params[i++];return v===null?'NULL':typeof v==='number'?String(v):"'"+v.replace(/'/g,"''")+"'";})+';';
  }).join('\n')+'\n';
}
export async function loadD1(db:D1Database):Promise<Catalog> {
  const [[products,avatars,bodies,compatibility,runs],overrides]=await Promise.all([
    Promise.all(['products','avatars','bodies','compatibility','crawl_runs'].map(t=>db.prepare(`SELECT payload FROM ${t}`).all<{payload:string}>())),
    db.prepare('SELECT entity,entity_key,patch FROM overrides').all<{entity:string,entity_key:string,patch:string}>()
  ]);
  const parse=(r:D1Result<{payload:string}>)=>r.results.map(x=>JSON.parse(x.payload));
  return {products:parse(products),avatars:parse(avatars),bodies:parse(bodies),compatibility:parse(compatibility),runs:parse(runs),overrides:overrides.results.map(o=>({entity:o.entity,key:o.entity_key,patch:JSON.parse(o.patch)} as Override))};
}
export function mergeImport(store:Catalog,data:ImportData):Catalog {
  for(const p of data.products) {
    const old=store.products.find(x=>x.id===p.id);
    if(old && old.fetchedAt>p.fetchedAt)continue;
    if(old&&p.likesFetchedAt==null){p.likes=old.likes??null;p.likesFetchedAt=old.likesFetchedAt??null;}
    store.products=store.products.filter(x=>x.id!==p.id).concat(p);
    store.compatibility=store.compatibility.filter(r=>r.productId!==p.id).concat(data.compatibility.filter(r=>r.productId===p.id));
  }
  for(const table of ['avatars','bodies','runs'] as const) {
    const map=new Map(store[table].map(x=>[x.id,x]));
    for(const entry of data[table])map.set(entry.id,entry as any);
    (store as any)[table]=[...map.values()];
  }
  return materializeCatalogTags(store);
}
export function checkReferences(data:ImportData,store:Catalog) {
  const products=new Set([...store.products,...data.products].map(p=>p.id));
  const avatars=new Set([...store.avatars,...data.avatars].map(a=>a.id));
  const bodies=new Set([...store.bodies,...data.bodies].map(b=>b.id));
  for(const a of data.avatars)if(!products.has(a.productId)||(a.bodyId&&!bodies.has(a.bodyId)))throw new Error('invalid avatar reference');
  for(const r of data.compatibility)if(!data.products.some(p=>p.id===r.productId) || !(r.targetType==='avatar'?avatars:bodies).has(r.targetId))throw new Error('invalid compatibility reference');
}
export function validateOverride(o:Override,store:Catalog) {
  if(o.entity==='product'&&!store.products.some(p=>p.id===o.key))throw new Error('unknown product');
  if(o.entity==='avatar') {
    if(!store.avatars.some(a=>a.id===o.key))throw new Error('unknown avatar');
    if(o.patch.bodyId && (!o.patch.bodyEvidence || !store.bodies.some(b=>b.id===o.patch.bodyId)))throw new Error('body requires known target and evidence');
  }
  if(o.entity==='compatibility') {
    const [productId,targetType,targetId]=o.key.split(':');
    if(!store.products.some(p=>p.id===productId)||!(targetType==='avatar'?store.avatars:store.bodies).some(t=>t.id===targetId))throw new Error('unknown relation target');
    const old=store.compatibility.find(r=>relationKey(r)===o.key);
    const previous=store.overrides.find(v=>v.entity===o.entity && v.key===o.key);
    const combined=compatibilitySchema.parse({...old,...previous?.patch,...o.patch,productId,targetType,targetId});
    if(combined.review==='verified' && (!combined.evidence.trim()||combined.fit==='unknown'))throw new Error('verified relation requires evidence and fit');
  }
}
