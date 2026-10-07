import fs from 'node:fs/promises';
import {authorDescription} from '../src/shared/description-avatars';
import {publicCatalog} from '../src/shared/model';
const data=JSON.parse(await fs.readFile('data/catalog.json','utf8')),state=JSON.parse(await fs.readFile('data/accessory-expansion-crawl.json','utf8'));
const list=[];
for(const id of state.queue.slice(0,state.cursor)){const p=data.products.find(p=>p.id===id);if(!p)continue;const description=authorDescription(await fs.readFile(`data/raw/${id}.html`,'utf8'));list.push({id,name:p.name,description,variants:p.variants.map(v=>v.name)});}
await fs.writeFile('data/accessory-expansion-descriptions.json',JSON.stringify(list,null,2));
for(const r of list)console.log(`${r.id} | ${r.name} | ${r.description.replace(/\s+/g,' ').slice(0,160)}`);
