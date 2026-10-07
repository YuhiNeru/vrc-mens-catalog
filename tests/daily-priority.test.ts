import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {crawl} from '../src/cli/main';
import {parseProduct} from '../src/shared/parser';
import {empty} from '../src/cli/files';

test('日次の大量更新候補より新着を優先し、翌日の検索を塞がない',async()=>{
 const cwd=process.cwd(),originalFetch=globalThis.fetch,originalEnv={...process.env};
 const avatars=JSON.parse(await fs.readFile('config/avatars.json','utf8')).filter((a:any)=>a.id==='kuuta');
 const fixtures=new Map(await Promise.all(['4897493','5213501','7475223','8434318'].map(async id=>[id,await fs.readFile(`tests/fixtures/${id}.html`,'utf8')] as const)));
 const dir=await fs.mkdtemp(path.join(cwd,'data','test-daily-priority-')),products:string[]=[];
 try{
  await fs.mkdir(path.join(dir,'config'));await fs.mkdir(path.join(dir,'data/raw'),{recursive:true});
  await fs.writeFile(path.join(dir,'config/avatars.json'),JSON.stringify(avatars));
  await fs.writeFile(path.join(dir,'config/crawl.json'),JSON.stringify({products:[],discovery:['https://booth.pm/ja/search/test'],intervalMs:1000,maxRequests:4,concurrency:1,refreshDays:7,discoveryLimit:60}));
  const store=empty();store.avatars=avatars;store.products=['4897493','5213501','7475223'].map(id=>parseProduct(fixtures.get(id)!,'https://booth.pm/ja/items/'+id,avatars,'2020-01-01T00:00:00.000Z').product);
  await fs.writeFile(path.join(dir,'data/catalog.json'),JSON.stringify(store));process.chdir(dir);
  for(const name of ['CRAWL_MAX_REQUESTS','CRAWL_INTERVAL_MS','CRAWL_REFRESH_DAYS','CRAWL_CONCURRENCY'])delete process.env[name];
  globalThis.fetch=async input=>{const url=String(input);if(url.endsWith('robots.txt'))return new Response('User-agent: *');if(url.includes('/search/'))return new Response('<body>対象商品 1 件<div class="item-card" data-product-id="8434318" data-tracking="impression_item"></div></body>');const id=url.split('/').pop()!;products.push(id);return new Response(fixtures.get(id)!);};
  await crawl('daily');
  const checkpoint=JSON.parse(await fs.readFile('data/checkpoint-daily.json','utf8')),saved=JSON.parse(await fs.readFile('data/catalog.json','utf8'));
  assert.equal(checkpoint.run.status,'complete');assert.equal(checkpoint.queue.length,2);assert.equal(products[0],'8434318');assert.equal(saved.products.length,4);
  assert.equal(saved.products.find((p:any)=>p.id==='5213501').fetchedAt,'2020-01-01T00:00:00.000Z');
 }finally{process.chdir(cwd);globalThis.fetch=originalFetch;process.env=originalEnv;process.exitCode=undefined;}
});
