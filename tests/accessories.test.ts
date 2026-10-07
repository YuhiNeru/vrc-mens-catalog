import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {empty} from '../src/cli/files';
import {parseProduct} from '../src/shared/parser';
import {handle} from '../src/worker/index';
test('分類済み小物を衣装から除き、小物一覧・アバター内訳にだけ数える',async()=>{
 const store=empty();store.avatars=JSON.parse(await fs.readFile('config/avatars.json','utf8')).filter((a:any)=>a.id==='kuuta');
 for(const id of ['4897493','7475223']){const p=parseProduct(await fs.readFile(`tests/fixtures/${id}.html`,'utf8'),'https://booth.pm/ja/items/'+id,store.avatars).product;p.review='verified';p.audience='male';store.products.push(p);}
 const clothing=store.products.find(p=>p.id==='7475223')!;
 store.products.push({...clothing,id:'5359242',url:'https://booth.pm/ja/items/5359242',name:'knee-high boots'});
 for(const id of ['7475223','5359242'])store.compatibility.push({productId:id,targetType:'avatar',targetId:'kuuta',fit:'full',review:'verified',evidence:'作者の対象版を確認',variantNames:[]});
 const rows:Record<string,unknown[]>={products:store.products,avatars:store.avatars,bodies:[],compatibility:store.compatibility,crawl_runs:[]};
 const db={prepare(sql:string){return{async all(){if(sql.includes('FROM overrides'))return{results:[]};const table=sql.match(/FROM (\w+)/)![1];return{results:rows[table].map(payload=>({payload:JSON.stringify(payload)}))};}};}}as unknown as D1Database;
 const env={DB:db,ASSETS:{}as Fetcher};
 const get=async(path:string)=>(await handle(new Request('https://example.test'+path),env)).json()as Promise<any>;
 assert.deepEqual((await get('/api/products')).items.map((p:any)=>p.id),['7475223']);
 const accessories=await get('/api/products?kind=accessory');assert.equal(accessories.total,1);assert.equal(accessories.items[0].category,'靴・レッグウェア');
 const detail=await get('/api/avatars/kuuta');assert.equal(detail.menClothingCount,1);assert.equal(detail.menAccessoryCount,1);assert.equal(detail.clothing.length,1);assert.equal(detail.accessories.length,1);
 store.products.find(p=>p.id==='5359242')!.audience='unisex';assert.equal((await get('/api/products?kind=accessory')).total,1);
 assert.equal((await get('/api/products?kind=accessory&audience=men')).total,0);
 const mixed=await get('/api/avatars/kuuta');assert.equal(mixed.accessoryCount,1);assert.equal(mixed.menAccessoryCount,0);
 assert.equal((await get('/api/products?kind=accessory&audience=unisex')).total,1);
 assert.equal((await handle(new Request('https://example.test/api/products?kind=bad'),env)).status,400);
});
