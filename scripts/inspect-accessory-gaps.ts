import fs from 'node:fs/promises';
import {effective,publicCatalog} from '../src/shared/model';
import {authorDescription} from '../src/shared/description-avatars';
const data=JSON.parse(await fs.readFile('data/catalog.json','utf8')),eff=effective(data),pub=publicCatalog(data),ids=new Set(pub.products.map(p=>p.id));
const records=[];
for(const p of eff.products.filter(p=>p.kind==='accessory'&&!ids.has(p.id))){try{const description=authorDescription(await fs.readFile(`data/raw/${p.id}.html`,'utf8'));const names=pub.avatars.filter(a=>[a.name,...a.aliases].some(n=>n.length>1&&description.includes(n))).map(a=>a.name);records.push({id:p.id,name:p.name,description,names});}catch{}}
await fs.writeFile('data/accessory-manual-audit.json',JSON.stringify(records,null,2));
for(const p of records.filter(p=>p.names.length))console.log(`${p.id} | ${p.name} | ${p.names.join(',')} | ${p.description.replace(/\s+/g,' ').slice(0,180)}`);
console.log('total',records.length);
