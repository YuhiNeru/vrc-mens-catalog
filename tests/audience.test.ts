import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {classifyAudience} from '../src/shared/audience';
import {parseProduct} from '../src/shared/parser';
import {handle} from '../src/worker/index';
import {empty} from '../src/cli/files';
import {outsideFloorEvidence} from '../src/shared/audience-scope';
import {publicCatalog} from '../src/shared/model';

test('女性版と98体以外の対応先を別枠に分類し、撮影・予定・素体を除く',()=>{
 const html=(text:string)=>`<script type="application/ld+json">${JSON.stringify({'@type':'Product',description:text})}</script>`;
 const p={kind:'clothing' as const,variants:[{name:'未知モデル版',price:1000}]};
 assert.match(outsideFloorEvidence(html('対応アバター\n未知モデル\nhttps://booth.pm/ja/items/999999'),p)!,/未知モデル/);
 assert.match(outsideFloorEvidence(html('対応アバター：未知モデル'),p)!,/未知モデル/);
 assert.equal(outsideFloorEvidence(html('撮影モデル\n未知モデル https://booth.pm/ja/items/999999'),p),null);
 assert.equal(outsideFloorEvidence(html('対応予定アバター\n未知モデル https://booth.pm/ja/items/999999'),p),null);
 assert.equal(outsideFloorEvidence(html('対応アバター\n+Head https://booth.pm/ja/items/5153266'),p),null);
 assert.equal(outsideFloorEvidence(html('対応アバター\n狛乃 https://booth.pm/ja/items/5260363'),{kind:'clothing',variants:[{name:'狛乃版',price:1000}]}),null);
 assert.equal(outsideFloorEvidence(html('対応アバター：狛乃'),{kind:'clothing',variants:[{name:'狛乃版',price:1000}]}),null);
 assert.equal(outsideFloorEvidence(html('対応アバター\nくうた'),{kind:'clothing',variants:[{name:'くうた版',price:1000}]}),null);
 assert.equal(outsideFloorEvidence(html('対応アバター\n悪魔リーマン'),{kind:'clothing',variants:[{name:'悪魔リーマン版',price:1000}]}),null);
 assert.equal(outsideFloorEvidence(html('対応アバター\n＋Head'),{kind:'clothing',variants:[{name:'＋Head',price:1000}]}),null);
 assert.match(outsideFloorEvidence(html('衣装です'),{kind:'clothing',variants:[{name:'マヌカ版',price:1000}]})!,/マヌカ/);
 assert.equal(outsideFloorEvidence(html('対応アバター\n未知モデルは非対応 https://booth.pm/ja/items/999999'),p),null);
});

test('男女兼用の分類だけでは掲載せず、男性への確認済み対応を必須にする',async()=>{
 const store=empty();
 const product=parseProduct(await fs.readFile('tests/fixtures/7475223.html','utf8'),'https://booth.pm/ja/items/7475223',[]).product;
 product.kind='clothing';product.review='verified';product.audience='unisex';store.products.push(product);
 assert.equal(publicCatalog(store).products.length,0);
 product.audience='male';assert.equal(publicCatalog(store).products.length,0);
 product.audience='unisex';product.review='candidate';assert.equal(publicCatalog(store).products.length,0);
});

test('確認済みでも対応区分不明・根拠空欄の衣装は掲載しない',async()=>{
 const avatars=JSON.parse(await fs.readFile('config/avatars.json','utf8')).filter((a:any)=>a.id==='kuuta');
 const store=empty();store.avatars=avatars;
 for(const id of ['4897493','7475223']){const p=parseProduct(await fs.readFile(`tests/fixtures/${id}.html`,'utf8'),'https://booth.pm/ja/items/'+id,avatars).product;p.review='verified';p.audience='unisex';store.products.push(p);}
 const r={productId:'7475223',targetType:'avatar' as const,targetId:'kuuta',review:'verified' as const,fit:'unknown' as const,evidence:'対応名だけの言及',variantNames:[]};
 store.compatibility.push(r);assert.equal(publicCatalog(store).products.filter(p=>p.kind==='clothing').length,0);
 store.compatibility[0]={...r,fit:'full',evidence:' '};assert.equal(publicCatalog(store).products.filter(p=>p.kind==='clothing').length,0);
 store.compatibility[0]={...r,fit:'full',evidence:'作者のくうた対応版を確認'};assert.equal(publicCatalog(store).products.filter(p=>p.kind==='clothing').length,1);
});

test('男女兼用の明示と男女の対象版を区分し、複数男性対応を男女兼用にしない',()=>{
 assert.equal(classifyAudience('ユニセックスコート',[],[]).audience,'unisex');
 assert.equal(classifyAudience('衣装',[],[{name:'くうた(Kuuta)'},{name:'マヌカ(Manuka)'}],['くうた','Kuuta']).audience,'unisex');
 assert.equal(classifyAudience('衣装',[],[{name:'くうた版'},{name:'狛乃版'}],['くうた','狛乃']).audience,'unknown');
 assert.equal(classifyAudience('衣装',[],[{name:'Female Version'},{name:'Male Version'}]).audience,'unisex');
 assert.equal(classifyAudience('メンズシャツ',[],[]).audience,'male');
 assert.equal(classifyAudience('男女兼用ではありません',[],[]).audience,'unknown');
 assert.equal(classifyAudience('衣装',[],[{name:'くうた版'},{name:'萌え袖セット'}],['くうた']).audience,'unknown');
});
test('通常一覧と男女兼用一覧は重複せず、アバター詳細には両方の対応版を残す',async()=>{
 const avatars=JSON.parse(await fs.readFile('config/avatars.json','utf8')).filter((a:any)=>a.id==='kuuta');
 const store=empty();store.avatars=avatars.map((a:any)=>({...a,review:'verified'}));
 for(const id of ['4897493','5213501','7475223']){const p=parseProduct(await fs.readFile(`tests/fixtures/${id}.html`,'utf8'),'https://booth.pm/ja/items/'+id,avatars).product;p.review='verified';p.audience=id==='5213501'?'unisex':'male';store.products.push(p);if(id!=='4897493')store.compatibility.push({productId:id,targetType:'avatar',targetId:'kuuta',fit:'full',review:'verified',evidence:'作者の対象版を確認',variantNames:['くうた版']});}
 const rows:{[key:string]:unknown[]}={products:store.products,avatars:store.avatars,bodies:[],compatibility:store.compatibility,crawl_runs:[]};
 const db={prepare(sql:string){return {async all(){if(sql.includes('FROM overrides'))return {results:[]};const table=sql.match(/FROM (\w+)/)![1];return {results:rows[table].map(payload=>({payload:JSON.stringify(payload)}))};}};}} as unknown as D1Database;
 const env={DB:db,ASSETS:{} as Fetcher};
 const get=async(path:string)=>(await handle(new Request('https://example.test'+path),env)).json() as Promise<any>;
 const regular=await get('/api/products'),shared=await get('/api/products?audience=unisex'),all=await get('/api/products?audience=all');
 assert.deepEqual(regular.items.map((p:any)=>p.id),['7475223']);assert.deepEqual(shared.items.map((p:any)=>p.id),['5213501']);assert.equal(all.total,2);
 const detail=await get('/api/avatars/kuuta');assert.equal(detail.clothing.length,2);
 assert.equal(detail.clothingCount,2);assert.equal(detail.menClothingCount,1);assert.equal(detail.unisexClothingCount,1);
 const list=await get('/api/avatars');assert.equal(list.items[0].menClothingCount+list.items[0].unisexClothingCount,list.items[0].clothingCount);
 assert.equal((await handle(new Request('https://example.test/api/products?audience=bad'),env)).status,400);
});
