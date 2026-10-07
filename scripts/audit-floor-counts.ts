import fs from 'node:fs/promises';
import {publicCatalog,type Catalog} from '../src/shared/model';
const store=JSON.parse(await fs.readFile('data/catalog.json','utf8')) as Catalog;
const d=publicCatalog(store);
const products=new Map(d.products.map(p=>[p.id,p]));
const clothes=d.products.filter(p=>p.kind==='clothing');
const rows=d.avatars.map(a=>{
 const ids=new Set(d.compatibility.filter(r=>r.targetType==='avatar'?r.targetId===a.id:r.targetId===a.bodyId&&Boolean(a.bodyEvidence)).map(r=>r.productId));
 const items=clothes.filter(p=>ids.has(p.id));
 return {id:a.id,name:a.name,cardCount:items.length,detailCount:items.length,men:items.filter(p=>p.audience!=='unisex').length,unisex:items.filter(p=>p.audience==='unisex').length,accessories:d.products.filter(p=>p.kind==='accessory'&&p.audience!=='unisex'&&ids.has(p.id)).length,nonClothing:[...ids].filter(id=>products.get(id)?.kind!=='clothing').map(id=>({id,kind:products.get(id)?.kind}))};
}).sort((a,b)=>b.cardCount-a.cardCount);
const result={checkedAt:new Date().toISOString(),men:clothes.filter(p=>p.audience!=='unisex').length,unisex:clothes.filter(p=>p.audience==='unisex').length,total:clothes.length,avatarCount:rows.length,summedAvatarCounts:rows.reduce((n,r)=>n+r.cardCount,0),mismatches:rows.filter(r=>r.cardCount!==r.detailCount),rows};
await fs.writeFile('data/floor-count-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,rows:rows.slice(0,8)},null,2));
