import fs from 'node:fs/promises';
import {effective,publicCatalog,type Catalog,type Compatibility} from '../src/shared/model';
import {readJson,writeJson,withLock} from '../src/cli/files';
import {importStatements,overrideStatement} from '../src/shared/storage';
const reviewFile=process.argv[2];
const reviewed=reviewFile?await readJson<{id:string,category?:string,targets?:{id:string,evidence:string,fit?:'full'|'semi'}[]}[]>(reviewFile):null;
const approved=reviewed?reviewed.map(p=>p.id):'8774409 8805623 8847551 8880409 8893310 8939266 3407613 5909024 7904138 4171568 8899749 8675010 8824299 8711982 7442656 8579952 7801373 7326125 7424370 7307278 7083036 6328492 5518660 5444502 5352099 5338982 5138107 5133692 5097267 5061545 7681648 7139326 6675599 6566788 5229475 8182841 5803300 6223630 7523235 5101425 6377319 7595797 7016344 8603205 7176500 6189000 4667807 4835062 5293622 4437184 7209973 6670070'.split(' ');
const prefix=reviewFile?'accessory-expansion':'other-accessory';
type Candidate={id:string,name:string,category:string,description:string,sales:Compatibility[],descriptionTargets:{avatarId:string,context:string}[],fetchedAt:string};
await withLock(async()=>{
 const store=await readJson<Catalog>('data/catalog.json'),initial=publicCatalog(store);
 const audit=await readJson<Candidate[]>('data/other-accessory-audit.json');
 const classes=await readJson<{id:string,category:string,evidence:string,fetchedAt?:string}[]>('config/accessory-classification.json');
 const avatarIds=new Set(initial.avatars.map(a=>a.id)),bodyIds=new Set(initial.avatars.filter(a=>a.bodyId&&a.bodyEvidence.trim()).map(a=>a.bodyId));
 const added=[];
 const saveOverride=(o:Catalog['overrides'][number])=>{store.overrides=store.overrides.filter(v=>!(v.entity===o.entity&&v.key===o.key));store.overrides.push(o);};
 for(const id of approved){
  const record=audit.find(p=>p.id===id)!;if(!record)throw new Error(`missing review ${id}`);
  const category=reviewed?.find(p=>p.id===id)?.category??(id==='8847551'?'首元アクセサリー':id==='8603205'?'靴・レッグウェア':id==='6377319'?'口元小物':record.category);
  const relations=new Map<string,Compatibility>();
  for(const t of record.descriptionTargets.filter(t=>avatarIds.has(t.avatarId)))relations.set('avatar:'+t.avatarId,{productId:id,targetType:'avatar',targetId:t.avatarId,fit:'full',review:'verified',variantNames:[],evidence:`作者の対応一覧に記載。${t.context}`.slice(0,500)});
  for(const r of record.sales.filter(r=>r.targetType==='avatar'?avatarIds.has(r.targetId):bodyIds.has(r.targetId)))relations.set(r.targetType+':'+r.targetId,r);
  const manual=reviewed?.find(p=>p.id===id)?.targets;
  if(manual){
   relations.clear();
   for(const t of manual){
    if(!avatarIds.has(t.id)||!t.evidence.trim())throw new Error(`invalid reviewed target ${id}:${t.id}`);
    relations.set('avatar:'+t.id,{productId:id,targetType:'avatar',targetId:t.id,fit:t.fit??'full',review:'verified',variantNames:[],evidence:t.evidence.slice(0,500)});
   }
  }
  if(!relations.size)throw new Error(`no male support ${id}`);
  if(!classes.some(p=>p.id===id))classes.push({id,category,evidence:`商品名：${record.name}。${record.description.slice(0,250)}`,fetchedAt:record.fetchedAt});
  const old=store.overrides.find(o=>o.entity==='product'&&o.key===id);
  saveOverride({entity:'product',key:id,patch:{...(old?.entity==='product'?old.patch:{}),kind:'accessory',category,review:'verified'}});
  for(const r of relations.values())saveOverride({entity:'compatibility',key:`${id}:${r.targetType}:${r.targetId}`,patch:{fit:r.fit,review:r.review,evidence:r.evidence,variantNames:r.variantNames}});
  added.push({id,name:record.name,category,targets:[...relations.values()].map(r=>r.targetType+':'+r.targetId),fetchedAt:record.fetchedAt,url:`https://booth.pm/ja/items/${id}`});
 }
 // 設定の保存前に、レビュー補正だけでも全商品が公開条件を満たすことを確認する。
 const after=publicCatalog(store);if(approved.some(id=>!after.products.some(p=>p.id===id&&p.kind==='accessory')))throw new Error('publication validation failed');
 await writeJson('config/accessory-classification.json',classes);await writeJson('data/catalog.json',store);
 const ids=new Set(approved),statements=[...importStatements({products:effective(store).products.filter(p=>ids.has(p.id)),avatars:[],bodies:[],compatibility:[],runs:[]}),...store.overrides.filter(o=>o.entity==='product'?ids.has(o.key):o.entity==='compatibility'&&ids.has(o.key.split(':')[0])).map(overrideStatement)];
 const sql=statements.map(s=>{let i=0;return s.sql.replace(/\?/g,()=>{const v=s.params[i++];return v===null?'NULL':typeof v==='number'?String(v):"'"+v.replace(/'/g,"''")+"'";})+';';}).join('\n');
 await fs.writeFile(`data/${prefix}-update.sql`,sql);
 await writeJson(`data/${prefix}-additions.json`,{checkedAt:new Date().toISOString(),candidateCount:audit.length,added});
 console.log(JSON.stringify({added:added.length,total:after.products.filter(p=>p.kind==='accessory').length}));
});
