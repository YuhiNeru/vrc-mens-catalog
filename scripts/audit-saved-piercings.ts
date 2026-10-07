import fs from 'node:fs/promises';
import {publicCatalog,type Catalog,type Avatar} from '../src/shared/model';
import {confirmListedVariants} from '../src/shared/listing';
import {parseProduct} from '../src/shared/parser';
import {extractDescriptionTargets,authorDescription} from '../src/shared/description-avatars';
const store=JSON.parse(await fs.readFile('data/catalog.json','utf8')) as Catalog;
const avatars=JSON.parse(await fs.readFile('config/avatars.json','utf8')) as Avatar[];
const published=new Set(publicCatalog(store).products.map(p=>p.id));
const ids=new Set(publicCatalog(store).avatars.map(a=>a.id));
const candidates=[];
for(const p of store.products){
 if(!/ピアス|イヤリング|イヤーカフ|\bpiercing\b|\bearrings?\b|ear.?cuff/i.test(p.name)||published.has(p.id))continue;
 try{
 const html=await fs.readFile(`data/raw/${p.id}.html`,'utf8');
 const parsed=parseProduct(html,p.url,avatars,p.fetchedAt);parsed.product.kind='accessory';
 const confirmed=confirmListedVariants(html,parsed.product,avatars,store.bodies).filter(r=>r.targetType==='body'||ids.has(r.targetId));
 const descriptionTargets=extractDescriptionTargets(html,store.avatars).filter(t=>t.avatarId&&ids.has(t.avatarId)&&t.fit==='full'&&!t.planned&&t.gender!=='female'&&!/非対応|未対応|未確認|未検証|対応予定|追加予定|準備中|not supported/i.test(t.context));
 candidates.push({id:p.id,name:p.name,kind:p.kind,review:p.review,confirmed:confirmed.map(r=>r.targetId),descriptionTargets:descriptionTargets.map(t=>({id:t.avatarId,context:t.context})),description:authorDescription(html).replace(/\s+/g,' ').slice(0,250),fetchedAt:p.fetchedAt});
 }catch{}
}
await fs.writeFile('data/saved-piercing-audit.json',JSON.stringify(candidates,null,2));
console.log(JSON.stringify({candidates:candidates.length,confirmed:candidates.filter(p=>p.confirmed.length||p.descriptionTargets.length).length,items:candidates.filter(p=>p.confirmed.length||p.descriptionTargets.length).map(p=>({id:p.id,name:p.name,targets:p.descriptionTargets.map(t=>t.id),description:p.description}))},null,2));
