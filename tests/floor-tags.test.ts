import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs/promises';
import{Catalog,effective,materializeCatalogTags,publicCatalog}from'../src/shared/model';
import{NO_CONFIRMED_FLOOR_TAG}from'../src/shared/floor-tags';
import{parseProduct}from'../src/shared/parser';
import{empty}from'../src/cli/files';
import{handle}from'../src/worker/index';

async function fixture(){
 const avatars=JSON.parse(await fs.readFile('config/avatars.json','utf8')).filter((a:any)=>a.id==='kuuta');
 const store=empty();store.avatars=avatars;
 for(const id of['4897493','7475223','5213501']){
  const p=parseProduct(await fs.readFile(`tests/fixtures/${id}.html`,'utf8'),`https://booth.pm/ja/items/${id}`,avatars).product;
  p.review='verified';if(p.kind==='clothing')p.audience='unisex';store.products.push(p);
 }
 return store;
}
test('確認済み対応がない衣装にタグを付け、対応追加・補正後に外す',async()=>{
 const store=await fixture(),p=store.products.find(p=>p.id==='7475223')!;
 const originalTags=[...p.tags];p.catalogTags=['manual-test'];
 materializeCatalogTags(store);assert.deepEqual(p.tags,originalTags);assert.deepEqual(p.catalogTags,['manual-test',NO_CONFIRMED_FLOOR_TAG]);
 store.compatibility.push({productId:p.id,targetType:'avatar',targetId:'kuuta',review:'candidate',fit:'full',evidence:'未レビュー',variantNames:[]});
 assert.ok(effective(store).products.find(p=>p.id==='7475223')!.catalogTags.includes(NO_CONFIRMED_FLOOR_TAG));
 store.overrides.push({entity:'compatibility',key:'7475223:avatar:kuuta',patch:{review:'verified',evidence:'作者の対応版を確認'}});
 materializeCatalogTags(store);assert.deepEqual(p.catalogTags,['manual-test']);
 store.overrides[0]={entity:'compatibility',key:'7475223:avatar:kuuta',patch:{review:'excluded'}};
 materializeCatalogTags(store);assert.ok(p.catalogTags.includes(NO_CONFIRMED_FLOOR_TAG));
});
test('共通素体への対応は98体側の採用根拠がある場合に数える',async()=>{
 const store=await fixture(),a=store.avatars[0];a.bodyId='test-body';a.bodyEvidence='作者の採用記載';
 store.bodies.push({id:'test-body',name:'test-body',evidence:'作者の素体'});
 store.compatibility.push({productId:'7475223',targetType:'body',targetId:'test-body',review:'verified',fit:'full',evidence:'販売対象版を確認',variantNames:[]});
 assert.ok(!publicCatalog(store).products.find(p=>p.id==='7475223')!.catalogTags.includes(NO_CONFIRMED_FLOOR_TAG));
 a.bodyEvidence='';assert.ok(effective(store).products.find(p=>p.id==='7475223')!.catalogTags.includes(NO_CONFIRMED_FLOOR_TAG));
 assert.ok(!publicCatalog(store).products.some(p=>p.id==='7475223'));
});
test('タグの完全一致で該当衣装だけ抽出し、アバター絞り込みと両立する',async()=>{
 const store=await fixture();store.compatibility.push({productId:'5213501',targetType:'avatar',targetId:'kuuta',review:'verified',fit:'full',evidence:'対象版を確認',variantNames:[]});
 store.products.find(p=>p.id==='5213501')!.tags.push(NO_CONFIRMED_FLOOR_TAG);
 const rows:Record<string,unknown[]>={products:store.products,avatars:store.avatars,bodies:[],compatibility:store.compatibility,crawl_runs:[]};
 const db={prepare(sql:string){return{async all(){if(sql.includes('FROM overrides'))return{results:[]};const table=sql.match(/FROM (\w+)/)![1];return{results:rows[table].map(payload=>({payload:JSON.stringify(payload)}))};}};}}as unknown as D1Database;
 const env={DB:db,ASSETS:{}as Fetcher};
 const get=async(query:string)=>(await handle(new Request('https://example.test/api/products?audience=unisex&'+query),env)).json()as Promise<any>;
 const result=await get('tag='+NO_CONFIRMED_FLOOR_TAG);assert.equal(result.total,0);
 assert.equal((await get('tag='+NO_CONFIRMED_FLOOR_TAG+'-suffix')).total,0);
 assert.equal((await get('tag='+NO_CONFIRMED_FLOOR_TAG+'&avatar=kuuta')).total,0);
 assert.equal((await get('q='+NO_CONFIRMED_FLOOR_TAG)).total,1);
});
