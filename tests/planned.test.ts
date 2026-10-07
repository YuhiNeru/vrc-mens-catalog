import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {planCoverage,collectCoverage,avatarSearchNames} from '../src/cli/planned';
import {parseProduct} from '../src/shared/parser';
import {empty} from '../src/cli/files';

test('検索語は日本語と英語の別名を含め、商品装飾と素体・導入条件を除く',()=>{
 assert.deepEqual(avatarSearchNames({name:'狛乃',aliases:['Komano','komano']}),['狛乃','Komano']);
 const names=avatarSearchNames({name:'【3Dmodel】悪魔リーマン【VRChat avatar】',aliases:['※PREFABにグローブ及び靴ナシ']});
 assert.deepEqual(names,['悪魔リーマン']);
 assert.ok(avatarSearchNames({name:'オリジナル3Dモデル ｢エリオン｣',aliases:[]}).includes('エリオン'));
 assert.ok(!avatarSearchNames({name:'伊依',aliases:['珍飯亭 共通男性素体（V3）','Iyori']}).some(n=>n.includes('素体')));
});

test('カテゴリ全ページ・重複除去・予算停止後の再開・対象版掲載',async()=>{
 const cwd=process.cwd(),originalFetch=globalThis.fetch;
 const avatars=JSON.parse(await fs.readFile('config/avatars.json','utf8')).filter((a:any)=>a.id==='kuuta');
 const fixtures=new Map(await Promise.all(['4897493','5213501','7475223'].map(async id=>[id,await fs.readFile(`tests/fixtures/${id}.html`,'utf8')] as const)));
 const dir=await fs.mkdtemp(path.join(cwd,'data','test-planned-'));
 const calls:string[]=[];
 const search=(next:boolean)=>`<body>対象商品 2 件<div class="item-card" data-product-id="5213501" data-tracking="impression_item"></div>${next?'<div class="pager"><a rel="nofollow" href="?page=2">2</a></div>':'<div class="item-card" data-product-id="7475223" data-tracking="impression_item"></div>'}</body>`;
 try{
  await fs.mkdir(path.join(dir,'config'));await fs.mkdir(path.join(dir,'data/raw'),{recursive:true});
  await fs.writeFile(path.join(dir,'config/avatars.json'),JSON.stringify(avatars));
  const config={intervalMs:1000,maxRequests:3,maxPagesPerSource:100,maxProducts:1};
  await fs.writeFile(path.join(dir,'config/crawl-comprehensive.json'),JSON.stringify(config));
  const store=empty();store.avatars=avatars;store.products=[parseProduct(fixtures.get('4897493')!,'https://booth.pm/ja/items/4897493',avatars).product];store.products[0].review='verified';
  await fs.writeFile(path.join(dir,'data/catalog.json'),JSON.stringify(store));process.chdir(dir);
  globalThis.fetch=async input=>{const url=String(input);calls.push(url);if(url.endsWith('robots.txt'))return new Response('User-agent: *');if(url.includes('/browse/'))return new Response(search(!new URL(url).searchParams.has('page')));return new Response(fixtures.get(url.split('/').pop()!)!);};
  await planCoverage();await collectCoverage();assert.equal(process.exitCode,2);process.exitCode=undefined;
  assert.equal(JSON.parse(await fs.readFile('data/coverage-plan.json','utf8')).phase,'stopped');
  const first=JSON.parse(await fs.readFile('data/coverage-plan.json','utf8'));
  await fs.writeFile('config/crawl-comprehensive.json',JSON.stringify({...config,dailyLimitExemptPlanId:first.id}));await collectCoverage();
  assert.equal(process.exitCode,2);process.exitCode=undefined;
  const partial=JSON.parse(await fs.readFile('data/coverage-plan.json','utf8'));
  assert.equal(partial.phase,'stopped');assert.equal(partial.cursor,1);assert.equal(partial.queue.length,2);
  await collectCoverage();
  const plan=JSON.parse(await fs.readFile('data/coverage-plan.json','utf8')),saved=JSON.parse(await fs.readFile('data/catalog.json','utf8'));
  assert.equal(plan.phase,'complete');assert.equal(plan.sources[0].pages,2);assert.equal(plan.queue.length,2);assert.equal(plan.success,2);assert.equal(saved.products.length,3);
  assert.equal(calls.filter(u=>u.endsWith('/5213501')).length,1);
  assert.ok(saved.compatibility.some((r:any)=>r.productId==='5213501'&&r.targetId==='kuuta'&&r.review==='verified'));
  assert.equal(plan.dailyLimitExempt,true);
  assert.equal(JSON.parse(await fs.readFile('config/crawl-comprehensive.json','utf8')).dailyLimitExemptPlanId,undefined);
  await planCoverage(false,true);
  assert.equal(process.exitCode,2);process.exitCode=undefined;
  const next=JSON.parse(await fs.readFile('data/coverage-plan.json','utf8'));
  assert.notEqual(next.id,first.id);assert.equal(next.reason,'daily request budget exhausted');
 }finally{process.chdir(cwd);globalThis.fetch=originalFetch;process.exitCode=undefined;}
});
