import fs from 'node:fs/promises';
import path from 'node:path';
import {readJson} from '../../src/cli/files';
import {type Catalog,effective,publicCatalog} from '../../src/shared/model';
const target=process.argv[2]??'data/vps-migration';
await fs.mkdir(target,{recursive:true});
const store=await readJson<Catalog>('data/catalog.json'),state=await readJson<any>('data/full-accessories/state.json');
if(!state.sources.every((s:any)=>s.complete))throw new Error('Discovery must finish before this migration');
const d=effective(store),pub=publicCatalog(store),classified=await readJson<any[]>('config/accessory-classification.json');
const seed={state,avatars:d.avatars.filter(a=>a.review==='verified'),bodies:d.bodies,protectedIds:classified.map(c=>c.id),accessoryIds:pub.products.filter(p=>p.kind==='accessory').map(p=>p.id),budgets:[] as any[]};
for(const name of await fs.readdir('data'))if(/^budget-\d{4}-\d{2}-\d{2}\.json$/.test(name))seed.budgets.push({day:name.slice(7,-5),...await readJson<any>('data/'+name)});
await fs.writeFile(path.join(target,'seed.json'),JSON.stringify(seed));
const robotsFile='data/full-accessories/robots.txt';
await fs.writeFile(path.join(target,'robots-cache.json'),JSON.stringify({at:(await fs.stat(robotsFile)).mtime.toISOString(),text:await fs.readFile(robotsFile,'utf8')}));
const out=await fs.open(path.join(target,'products.jsonl'),'w');
const relations=new Map<string,typeof store.compatibility>();
for(const r of store.compatibility){const list=relations.get(r.productId)??[];list.push(r);relations.set(r.productId,list);}
try{for(const p of store.products)await out.write(JSON.stringify({product:p,compatibility:relations.get(p.id)??[]})+'\n');}finally{await out.close();}
const rawNames=new Set(await fs.readdir('data/raw')),files=['seed.json','products.jsonl','robots-cache.json'];
for(const id of state.queue.slice(state.cursor))if(rawNames.has(id+'.html'))files.push('raw/'+id+'.html');
await fs.mkdir(path.join(target,'raw'),{recursive:true});
for(const name of files.slice(3))await fs.copyFile('data/'+name,path.join(target,name));
await fs.writeFile(path.join(target,'archive-files.txt'),files.join('\n')+'\n');
console.log(JSON.stringify({cursor:state.cursor,total:state.queue.length,products:store.products.length,accessories:seed.accessoryIds.length,cachedRemaining:files.length-3}));
