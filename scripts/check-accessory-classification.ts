import fs from 'node:fs/promises';
import {publicCatalog} from '../src/shared/model';
const data=JSON.parse(await fs.readFile('data/catalog.json','utf8')),classes=JSON.parse(await fs.readFile('config/accessory-classification.json','utf8'));
for(const p of publicCatalog(data).products.filter(p=>p.kind==='accessory'&&!classes.some(c=>c.id===p.id)))console.log(JSON.stringify({id:p.id,name:p.name,category:p.category,relations:publicCatalog(data).compatibility.filter(r=>r.productId===p.id)}));
