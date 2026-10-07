import fs from 'node:fs/promises';
import {effective,type Catalog,type Compatibility} from '../src/shared/model';
import {readJson,writeJson,withLock} from '../src/cli/files';
import {overrideStatement,importStatements} from '../src/shared/storage';
import {extractDescriptionTargets,authorDescription} from '../src/shared/description-avatars';
import {load} from 'cheerio/slim';
const auto=['8750957','7282258','6445924','7096061','4414117','8079032'];
const manual:Record<string,{targets:string[],evidence:string}>={
 '4729198':{targets:['kuuta'],evidence:'作者説明：ほとぎ屋様「くうた-Kuuta-」での使用を想定したイヤリングセット。'},
 '5193150':{targets:['kalne'],evidence:'カルネ専用リボンピアス。作者説明にカルネ / KALNEの本体URL5142722を記載。'},
 '5325755':{targets:['avatar-4930863'],evidence:'作者説明 Fits with: 悪魔リーマン (4930863)。headへのPrefab導入。'},
 '4582060':{targets:['avatar-3162696'],evidence:'作者説明：碼希専用スプリットタン＆口内ピアス。碼希くん専用、他モデルは動作保証しない。'},
 '4295990':{targets:['komano','hanka','alue'],evidence:'作者説明：狛乃君・斑霞くん・アルエくん用に位置調整済みセットPrefabを同梱。headへの装着が必要。'}
};
await withLock(async()=>{
 const store=await readJson<Catalog>('data/catalog.json');
 const classes=await readJson<{id:string,category:string,evidence:string,fetchedAt?:string}[]>('config/accessory-classification.json');
 const reviewedAvatars=effective(store).avatars.filter(a=>a.review==='verified');
 const avatarIds=new Set(reviewedAvatars.map(a=>a.id));
 const sql:string[]=[],added=[];
 for(const id of [...auto,...Object.keys(manual),'7580626','6721437','6109529']){
  const product=store.products.find(p=>p.id===id)!;if(!product)throw new Error(`missing ${id}`);
  const html=await fs.readFile(`data/raw/${id}.html`,'utf8'),description=authorDescription(html);
  let targets: {id:string,evidence:string}[]=[];
  if(auto.includes(id))targets=extractDescriptionTargets(html,reviewedAvatars).filter(t=>t.avatarId&&t.fit==='full'&&!t.planned&&t.gender!=='female'&&!/非対応|未対応|未確認|未検証|対応予定|追加予定|準備中|not supported/i.test(t.context)).map(t=>({id:t.avatarId!,evidence:`作者の対応アバター一覧を確認。${t.context}`.slice(0,500)}));
  else if(manual[id])targets=manual[id].targets.map(target=>({id:target,evidence:manual[id].evidence}));
  else {
   const section=description.split('▼サイズ調整済みアバター')[1]?.split(/▼|利用規約|禁止事項/)[0];if(!section)throw new Error(`missing adjustment list ${id}`);
   const urls=new Set([...section.matchAll(/https:\/\/(?:[\w-]+\.)?booth\.pm\/(?:ja\/|en\/|ko\/)?items\/(\d+)/g)].map(m=>m[1]));
   targets=store.avatars.filter(a=>urls.has(a.productId)).map(a=>({id:a.id,evidence:`作者のサイズ調整済みアバター一覧に${a.name}（${a.productId}）を確認。${a.id==='nakiya'?'Ea2_Earlobe_OFF_L/Rを100にすることを推奨。':''}位置・角度・サイズ調整の導入条件は販売ページで確認。`}));
  }
  targets=targets.filter(t=>avatarIds.has(t.id));if(!targets.length)throw new Error(`no confirmed male ${id}`);
  const classification={id,category:'ピアス',evidence:`商品名：${product.name}。作者の男性アバター対応記載をレビュー。`,fetchedAt:product.fetchedAt};
  if(!classes.some(c=>c.id===id))classes.push(classification);
  const patch={kind:'accessory' as const,category:'ピアス',review:'verified' as const};
  const existing=store.overrides.find(o=>o.entity==='product'&&o.key===id);if(existing&&existing.entity==='product')existing.patch={...existing.patch,...patch};else store.overrides.push({entity:'product',key:id,patch});
  for(const target of targets){
   const r:Compatibility={productId:id,targetType:'avatar',targetId:target.id,fit:'full',review:'verified',evidence:target.evidence,variantNames:[]};
   const o={entity:'compatibility' as const,key:`${id}:avatar:${target.id}`,patch:{fit:r.fit,review:r.review,evidence:r.evidence,variantNames:r.variantNames}};
   store.overrides=store.overrides.filter(v=>!(v.entity===o.entity&&v.key===o.key));store.overrides.push(o);
  }
  const $=load(html);const candidates=$('#variations > .variation-item .variation-name').map((_,e)=>$(e).text()).get();
  added.push({id,name:product.name,targets:targets.map(t=>t.id),fetchedAt:product.fetchedAt,url:product.url,variants:candidates});
 }
 await writeJson('config/accessory-classification.json',classes);
 await writeJson('data/catalog.json',store);
 const ids=new Set(added.map(p=>p.id));
 const statements=[...importStatements({products:effective(store).products.filter(p=>ids.has(p.id)),avatars:[],bodies:[],compatibility:[],runs:[]}),...store.overrides.filter(o=>o.entity==='product'?ids.has(o.key):o.entity==='compatibility'&&ids.has(o.key.split(':')[0])).map(overrideStatement)];
 for(const s of statements){let i=0;sql.push(s.sql.replace(/\?/g,()=>{const v=s.params[i++];return v===null?'NULL':typeof v==='number'?String(v):"'"+v.replace(/'/g,"''")+"'";})+';');}
 await fs.writeFile('data/piercing-update.sql',sql.join('\n'));
 await writeJson('data/piercing-additions.json',{checkedAt:new Date().toISOString(),added});console.log(JSON.stringify({added:added.length,items:added}));
});
