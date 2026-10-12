import fs from 'node:fs/promises';
import readline from 'node:readline';
import {createReadStream} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {readJson,writeJson,withLock} from '../../src/cli/files';
import {type Catalog,type Override,importSchema} from '../../src/shared/model';
import {importStatements,overrideStatement,type Statement} from '../../src/shared/storage';
const source=process.argv[2];if(!source)throw new Error('Export file required');
const literal=(s:Statement)=>{let i=0;return s.sql.replace(/\?/g,()=>{const v=s.params[i++];return v===null?'NULL':typeof v==='number'?String(v):"'"+v.replaceAll("'","''")+"'";})+';';};
await withLock(async()=>{
 const store=await readJson<Catalog>('data/catalog.json');
 const classifications=await readJson<any[]>('config/accessory-classification.json');
 const cursor=await readJson<any>('data/vps-sync/cursor.json',{through:0});
 let header:any,changed=0;const pending:Statement[]=[];
 const flush=async()=>{
  if(!pending.length)return;
  const filename='data/vps-sync/update.sql';await fs.writeFile(filename,pending.map(literal).join('\n'));
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','catalog','--local','--file',filename],{windowsHide:true,encoding:'utf8',maxBuffer:4*1024*1024});
  await fs.appendFile('data/vps-sync/import.log',(result.stdout??'')+(result.stderr??''));
  if(result.status!==0)throw new Error('D1 sync failed; export and cursor retained for retry');pending.length=0;
 };
 const productIndex=new Map(store.products.map(p=>[p.id,p]));
 const compat=new Map<string,typeof store.compatibility>();for(const r of store.compatibility){const list=compat.get(r.productId)??[];list.push(r);compat.set(r.productId,list);}
 const overrides=new Map(store.overrides.map(o=>[o.entity+':'+o.key,o]));
 for await(const line of readline.createInterface({input:createReadStream(source),crlfDelay:Infinity})){
  const item=JSON.parse(line);
  if(item.type==='header'){
   header=item;if(cursor.runId&&cursor.runId!==header.runId)throw new Error('Run ID mismatch');
   if(header.after>cursor.through)throw new Error('Missing earlier changes');continue;
  }
  if(!header)throw new Error('Missing export header');
  const data=importSchema.parse({products:[item.product],compatibility:item.compatibility});const p=data.products[0],old=productIndex.get(p.id);
  if(old&&old.fetchedAt>p.fetchedAt)continue;
  // Local personal/manual overrides always take precedence; only crawl payloads are merged.
  if(old&&(!p.likesFetchedAt||old.likesFetchedAt&&old.likesFetchedAt>p.likesFetchedAt)){p.likes=old.likes;p.likesFetchedAt=old.likesFetchedAt;}
  productIndex.set(p.id,p);compat.set(p.id,data.compatibility);pending.push(...importStatements(data));
  for(const remote of item.overrides as Override[]){const key=remote.entity+':'+remote.key,local=overrides.get(key);const merged={...remote,patch:{...remote.patch,...local?.patch}} as Override;overrides.set(key,merged);
   // Existing D1 overrides may include personal edits absent from catalog.json. Never replace them.
   const statement=overrideStatement(merged);pending.push({sql:'INSERT OR IGNORE INTO overrides(entity,entity_key,patch,updated_at) VALUES(?,?,?,?)',params:statement.params.slice(0,4)});
  }
  if(item.classification&&!classifications.some(c=>c.id===item.classification.id))classifications.push(item.classification);
  changed++;if(changed%100===0)await flush();
 }
 if(!header)throw new Error('Missing export header');await flush();
 store.products=[...productIndex.values()];store.compatibility=[...compat.values()].flat();store.overrides=[...overrides.values()];
 await writeJson('data/catalog.json',store);await writeJson('config/accessory-classification.json',classifications);
 await writeJson('data/vps-sync/cursor.json',{runId:header.runId,through:Math.max(cursor.through,header.through),updatedAt:new Date().toISOString()});
 console.log(JSON.stringify({imported:changed,through:header.through,products:store.products.length}));
});
