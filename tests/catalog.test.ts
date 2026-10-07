import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { avatarSchema, importSchema, overrideSchema, publicCatalog, Catalog, effective } from '../src/shared/model';
import { parseProduct, discover, assertPublicHtml, searchPage } from '../src/shared/parser';
import { confirmListedVariants } from '../src/shared/listing';
import { PoliteFetcher, StopCrawl, robotsAllows } from '../src/shared/fetcher';
import { empty } from '../src/cli/files';
import { importStatements, mergeImport, overrideStatement, validateOverride, sqlExport } from '../src/shared/storage';
import { handle } from '../src/worker/index';
import { crawl, sync } from '../src/cli/main';
import path from 'node:path';
import { load } from 'cheerio/slim';
const avatars=JSON.parse(await fs.readFile('config/avatars.json','utf8')).map((x:unknown)=>avatarSchema.parse(x));
const html=async(id:string)=>fs.readFile(`tests/fixtures/${id}.html`,'utf8');
const read=async(id:string)=>parseProduct(await html(id),`https://booth.pm/ja/items/${id}`,avatars,'2026-10-07T00:00:00.000Z');

test('販売対象版だけを掲載根拠とし、言及・非対応・変換前提を除外する',async()=>{
 const p=(await read('5213501')).product;
 const source=(description:string)=>`<script type="application/ld+json">${JSON.stringify({'@type':'Product',description})}</script>`;
 const target=avatars.find((a:any)=>a.id==='kuuta');
 const named={...p,variants:[{...p.variants[0],name:'KUUTA 対応版'}]};
 assert.equal(confirmListedVariants(source('専用衣装です'),named,[target]).length,1);
 assert.equal(confirmListedVariants(source('対応ピアスです'),{...named,kind:'accessory'},[target]).length,1);
 assert.equal(confirmListedVariants(source('くうたは未対応です'),named,[target]).length,0);
 assert.equal(confirmListedVariants(source('もちふぃったによる変換前提です'),named,[target]).length,0);
 assert.equal(confirmListedVariants(source('撮影にはくうたを使用'),{...named,variants:[{...named.variants[0],name:'通常版'}]},[target]).length,0);
 assert.equal(confirmListedVariants(source('専用衣装'),{...named,variants:[{...named.variants[0],name:'FakeKuuta版'}]},[target]).length,0);
 assert.equal(confirmListedVariants(source('専用衣装'),{...named,variants:[{...named.variants[0],name:'Kuuta 対応予定'}]},[target]).length,0);
});
test('検索ページの件数と次ページを追跡し、別ページへの誘導を拒否する',()=>{
 const source='<body>対象商品 1,490 件<div class="item-card" data-product-id="123" data-tracking="impression_item"></div><a rel="next" href="?q=test&page=2">次へ</a></body>';
 const parsed=searchPage(source,'https://booth.pm/ja/browse/3D?q=test');
 assert.equal(parsed.totalReported,1490);assert.equal(parsed.urls.length,1);assert.ok(parsed.next?.includes('page=2'));
 const numbered=source.replace('<a rel="next"','<div class="pager"><a rel="nofollow"').replace('</a></body>','</a></div></body>');
 assert.ok(searchPage(numbered,'https://booth.pm/ja/browse/3D?q=test').next?.includes('page=2'));
 assert.throws(()=>searchPage(source.replace('?q=test&page=2','https://other.test/x'),'https://booth.pm/ja/browse/3D?q=test'));
});
test('新版の作者説明にある注意書きと、共通素体の販売版を照合する',async()=>{
 const p=(await read('5213501')).product;
 const target=avatars.find((a:any)=>a.id==='kuuta');
 const named={...p,variants:[{name:'Kuuta',price:2000}]};
 const modern='<article class="market-item-detail-article"><section class="shop__text"><p class="js-autolink">くうた セミ対応です</p></section></article>';
 assert.equal(confirmListedVariants(modern,named,[target]).length,0);
 const related='<aside><section class="shop__text"><p class="js-autolink">くうた セミ対応です</p></section></aside>';
 assert.equal(confirmListedVariants(related,named,[target]).length,1);
 const body={id:'plushead',name:'+Head',evidence:'作者の共通素体商品'};
 const result=confirmListedVariants('',{...p,variants:[{name:'＋Head（#PlusHead）共通素体',price:2000}]},[],[body]);
 assert.equal(result.length,1);assert.equal(result[0].targetType,'body');assert.equal(result[0].targetId,'plushead');
 assert.equal(confirmListedVariants('',{...p,variants:[{name:'FakePlusHead',price:2000}]},[],[body]).length,0);
});
test('実HTMLの両形式、価格、ショップ、複数対応版を抽出',async()=>{
 const a=await read('4897493');assert.equal(a.product.shop,'ほとぎ屋');assert.equal(a.product.priceMin,6000);assert.equal(a.product.kind,'avatar');
 const p=await read('5213501');assert.equal(p.product.priceMin,2000);assert.equal(p.product.variants.length,3);assert.equal(p.compatibility.length,2);assert.ok(p.compatibility.every(r=>r.review==='candidate'));
 const cyber=await read('7475223');assert.equal(cyber.product.priceMin,1300);assert.equal(cyber.product.priceMax,1500);
 assert.ok(discover(await html('search'),'https://booth.pm/ja/search/test').length>0);
 const upper=load(await html('5213501'));upper('.variation-name').last().text('KUUTA');
 const parsed=parseProduct(upper.html()!,'https://booth.pm/ja/items/5213501',avatars);
 assert.ok(parsed.compatibility.some(r=>r.targetId==='kuuta'&&r.variantNames.includes('KUUTA')));
});
test('タイトルだけ・紹介だけの名前は確認済みにしない。セミ対応/変換を保持',async()=>{
 const sample=await html('5213501');
 const titleOnly=sample.replace(/"description":".*?","/,'"description":"関係のない商品の紹介です。","').replace(/狛乃\(Komano\)/g,'別モデルA').replace(/くうた\(Kuuta\)/g,'別モデルB');
 const p=parseProduct(titleOnly,'https://booth.pm/ja/items/5213501',avatars);assert.ok(!p.compatibility.some(r=>r.review==='verified'));
 for(const text of ['狛乃 セミ対応です。','くうた 変換ツール前提です。']) {
  const synthetic=sample.replace(/"description":".*?","/,'"description":'+JSON.stringify(text)+',"');
  const r=parseProduct(synthetic,'https://booth.pm/ja/items/5213501',avatars).compatibility;
  assert.ok(r.some(r=>r.fit===(text.includes('セミ')?'semi':'conversion')));
 }
});
test('無料版と有料セットの価格帯、取得できない価格はnull',async()=>{
 let s=await html('7475223');s=s.replace(/1,300/g,'0');const p=parseProduct(s,'https://booth.pm/ja/items/7475223',avatars).product;
 assert.equal(p.priceMin,0);assert.equal(p.priceMax,1500);
 s=s.replace(/class="variation-price[^"\n]*"/g,'class="unparsed"');assert.equal(parseProduct(s,'https://booth.pm/ja/items/7475223',avatars).product.priceMin,null);
});
test('403/認証/チャレンジで停止、429のRetry-Afterを尊重し再発で停止',async()=>{
 const opts={intervalMs:0,maxRequests:10,retries:2,timeoutMs:1000};
 for(const status of [401,403])await assert.rejects(new PoliteFetcher(opts,async()=>new Response('',{status}),async()=>{}).get('https://booth.pm/ja/items/1'),StopCrawl);
 const waits:number[]=[];let count=0;
 const f=new PoliteFetcher(opts,async()=>{count++;return new Response('',{status:429,headers:{'Retry-After':'2'}});},async ms=>{waits.push(ms);});
 await assert.rejects(f.get('https://booth.pm/ja/items/1'),StopCrawl);assert.equal(count,2);assert.ok(waits.includes(2000));
 await assert.rejects(new PoliteFetcher(opts,async()=>new Response('<title>Just a moment...</title>'),async()=>{}).get('https://booth.pm/ja/items/1'),StopCrawl);
 assert.doesNotThrow(()=>assertPublicHtml('<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>'));
 await assert.rejects(new PoliteFetcher(opts,async()=>new Response('',{status:429,headers:{'Retry-After':'120'}}),async()=>{}).get('https://booth.pm/ja/items/1'),e=>e instanceof StopCrawl && Boolean(e.retryAt && e.retryAt>Date.now()+110000));
});
test('5xx/タイムアウトは上限付き再試行、日次予算停止を握りつぶさない',async()=>{
 let count=0;const opts={intervalMs:0,maxRequests:10,retries:2,timeoutMs:1000};
 await assert.rejects(new PoliteFetcher(opts,async()=>{count++;return new Response('',{status:503});},async()=>{}).get('https://booth.pm/ja/items/1'));assert.equal(count,3);
 await assert.rejects(new PoliteFetcher(opts,async()=>{throw new StopCrawl('budget');},async()=>{}).get('https://booth.pm/ja/items/1'),/budget/);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /cart','/cart'),false);assert.equal(robotsAllows('User-agent: *\nDisallow: /cart','/ja/items/1'),true);
 assert.equal(robotsAllows('User-agent: *\nDisallow: /x\nAllow: /xyz','/xyz'),true);
});
test('SQLite実DBで再取り込み・古い再送・補正永続性と公開対象を検証',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(await fs.readFile('migrations/0001_catalog.sql','utf8'));
 const store=empty();for(const id of ['4897493','5260363','5213501','8434318']){const p=await read(id);const d=importSchema.parse({products:[p.product],avatars:avatars.filter((a:any)=>a.productId===id),compatibility:p.compatibility});mergeImport(store,d);}
 const run=(s:{sql:string,params:any[]})=>db.prepare(s.sql).run(...s.params);
 for(let i=0;i<2;i++)importStatements(store).forEach(run);
 assert.equal((db.prepare('SELECT count(*) AS n FROM products').get() as any).n,4);
 const overrides=JSON.parse(await fs.readFile('config/reviewed.json','utf8')).map((x:unknown)=>overrideSchema.parse(x));
 for(const o of overrides){validateOverride(o,store);run(overrideStatement(o));}store.overrides=overrides;
 importStatements({...store,products:store.products.map(p=>({...p,fetchedAt:'2026-10-08T00:00:00.000Z'}))}).forEach(run);
 importStatements(store).forEach(run);
 assert.equal((db.prepare('SELECT count(*) AS n FROM overrides').get() as any).n,8);
 run(overrideStatement(overrideSchema.parse({entity:'avatar',key:'komano',patch:{bodyId:null}})));
 assert.equal(JSON.parse((db.prepare("SELECT patch FROM overrides WHERE entity='avatar' AND entity_key='komano'").get() as any).patch).bodyId,null);
 assert.equal((db.prepare('SELECT fetched_at FROM products LIMIT 1').get() as any).fetched_at,'2026-10-08T00:00:00.000Z');
 const d=publicCatalog(store);assert.equal(d.avatars.length,2);assert.equal(d.products.filter(p=>p.kind==='clothing').length,2);
 const bad={...store,overrides:[...overrides,overrideSchema.parse({entity:'avatar',key:'kuuta',patch:{bodyId:'plushead',bodyEvidence:'未確認'}})]};
 assert.ok(!publicCatalog(bad).compatibility.some(r=>r.targetType==='body'));
 assert.equal(effective(store).products.find(p=>p.id==='5213501')?.category,'セットアップ');
 assert.throws(()=>parseProduct('<title>404</title>','https://booth.pm/ja/items/1',avatars));assert.equal(store.products.length,4);
 db.close();
});
test('CLIの途中再開・日次予算・失敗の保持・反映失敗時のoutbox再送',async()=>{
 const originalCwd=process.cwd(),originalFetch=globalThis.fetch;
 const originals={...process.env};
 const dir=await fs.mkdtemp(path.join(originalCwd,'data','test-resume-'));
 const fixtures=new Map(await Promise.all(['4897493','5260363','5213501'].map(async id=>[id,await html(id)] as const)));
 const calls:string[]=[];
 try {
  await fs.mkdir(path.join(dir,'config'));await fs.mkdir(path.join(dir,'data/raw'),{recursive:true});
  await fs.writeFile(path.join(dir,'config/avatars.json'),JSON.stringify(avatars));
  const config={products:['4897493','5260363','5213501'].map(id=>'https://booth.pm/ja/items/'+id),discovery:[],intervalMs:1000,maxRequests:2,maxProducts:2,concurrency:1,refreshDays:7,discoveryLimit:1};
  await fs.writeFile(path.join(dir,'config/crawl.json'),JSON.stringify(config));process.chdir(dir);
  for(const name of ['CRAWL_MAX_REQUESTS','CRAWL_INTERVAL_MS','CRAWL_REFRESH_DAYS','CRAWL_CONCURRENCY'])delete process.env[name];
  globalThis.fetch=async(input)=> {const url=String(input);calls.push(url);if(url.endsWith('robots.txt'))return new Response('User-agent: *\nDisallow: /cart');const id=url.split('/').pop()!;return new Response(fixtures.get(id)!);};
  await crawl('initial');assert.equal(process.exitCode,2);process.exitCode=undefined;
  let checkpoint=JSON.parse(await fs.readFile('data/checkpoint-initial.json','utf8'));assert.equal(checkpoint.cursor,1);
  await fs.writeFile('config/crawl.json',JSON.stringify({...config,maxRequests:10}));await crawl('initial');
  checkpoint=JSON.parse(await fs.readFile('data/checkpoint-initial.json','utf8'));assert.equal(checkpoint.run.status,'complete');assert.equal(checkpoint.queue.length,2);assert.equal(calls.filter(u=>u.endsWith('/4897493')).length,1);
  await fs.writeFile('config/crawl.json',JSON.stringify({...config,maxProducts:3,maxRequests:10}));await crawl('initial');
  const saved=JSON.parse(await fs.readFile('data/catalog.json','utf8'));assert.equal(saved.products.length,3);
  process.env.CATALOG_API_URL='https://example.test';process.env.CATALOG_ADMIN_TOKEN='x'.repeat(32);
  globalThis.fetch=async()=>new Response('',{status:503});await assert.rejects(sync(),/503/);
  const pending=(await fs.readdir('data/outbox')).length;assert.ok(pending>0);
  globalThis.fetch=async()=>Response.json({imported:1});await sync();assert.equal((await fs.readdir('data/outbox')).length,0);
  // 失敗HTMLを返す日次再確認で既存の商品は消えない。
  saved.products=saved.products.map((p:any)=>({...p,fetchedAt:'2020-01-01T00:00:00.000Z'}));await fs.writeFile('data/catalog.json',JSON.stringify(saved));
  globalThis.fetch=async input=>String(input).endsWith('robots.txt')?new Response('User-agent: *'):new Response('<title>not a product</title>');
  await crawl('daily');const after=JSON.parse(await fs.readFile('data/catalog.json','utf8'));assert.equal(after.products.length,3);assert.equal(after.runs.at(-1).failure,3);
 }finally {process.chdir(originalCwd);globalThis.fetch=originalFetch;process.env=originals;process.exitCode=undefined;}
});
test('公開APIは書込不可。管理APIは認証/入力検証を必須にする',async()=>{
 const env={DB:{} as D1Database,ASSETS:{} as Fetcher,ADMIN_TOKEN:'a'.repeat(32)};
 assert.equal((await handle(new Request('https://example.test/api/products',{method:'POST'}),env)).status,405);
 assert.equal((await handle(new Request('https://example.test/api/admin/import',{method:'POST'}),env)).status,401);
 const req=new Request('https://example.test/api/admin/import',{method:'POST',headers:{Authorization:'Bearer '+'a'.repeat(32),'Content-Type':'application/json'},body:'{"products":[{"id":"bad"}]}'});
 assert.equal((await handle(req,env)).status,400);
 assert.throws(()=>overrideSchema.parse({entity:'product',key:'1',patch:{url:'https://evil.test'}}));
});
