import fs from 'node:fs/promises';
import {effective,publicCatalog} from '../shared/model';
import {extractDescriptionTargets} from '../shared/description-avatars';
import {readJson,empty,writeJson} from './files';
export async function extractDescriptionAvatars(){
 const catalog=effective(await readJson('data/catalog.json',empty())),published=publicCatalog(catalog),female=await readJson<{productId:string,name:string}[]>('config/female-targets.json',[]);
 const groups=new Map<string,any>(),errors:{productId:string,error:string}[]=[];let scanned=0,maleMentions=0;
 for(const p of catalog.products.filter(p=>p.kind==='clothing')){
   try{
     const html=await fs.readFile(`data/raw/${p.id}.html`,'utf8'),targets=extractDescriptionTargets(html,catalog.avatars);scanned++;
     for(const t of targets.filter(t=>t.gender==='male')){
       maleMentions++;const key=t.productId??t.name,known=catalog.products.find(p=>p.id===t.productId),conflict=female.some(a=>a.productId===t.productId);
       if(known&&['clothing','hair','texture','accessory'].includes(known.kind))continue;
       const group=groups.get(key)??{productId:t.productId,name:t.name,url:t.url,avatarId:t.avatarId,kind:known?.kind==='avatar'?'avatar':t.kind,registered:published.avatars.some(a=>a.productId===t.productId),genderConflict:conflict,names:[],sources:[]};
       if(!group.url&&t.url)group.url=t.url;
       if(!group.names.includes(t.name))group.names.push(t.name);
       if(!group.sources.some((s:any)=>s.productId===p.id))group.sources.push({productId:p.id,url:p.url,fetchedAt:p.fetchedAt,evidence:t.context,genderEvidence:t.genderBasis,fit:t.fit,planned:t.planned});groups.set(key,group);
     }
   }catch(e){errors.push({productId:p.id,error:e instanceof Error?e.message:'unknown'});}
   if(scanned%500===0)console.log('scanned descriptions',scanned);
 }
 const allTargets=[...groups.values()].map(g=>({...g,clothingCount:g.sources.length,eligibleClothingCount:g.sources.filter((s:any)=>!s.planned).length,status:g.kind==='body'?'shared-body':g.genderConflict?'needs-gender-review':g.registered?'registered':'needs-avatar-verification'})).sort((a,b)=>b.eligibleClothingCount-a.eligibleClothingCount);
 const genderConflicts=allTargets.filter(t=>t.genderConflict),targets=allTargets.filter(t=>!t.genderConflict);
 const at=new Date().toISOString(),candidates=targets.filter(t=>!t.registered&&t.kind!=='body');
 const result={extractedAt:at,scope:'Saved BOOTH clothing author descriptions only; no network requests. Mentions are discovery evidence, not verified compatibility.',scannedClothing:scanned,maleMentions,uniqueTargets:targets.length,registeredTargets:targets.filter(t=>t.registered).length,candidateTargets:candidates.length,sharedBodies:targets.filter(t=>t.kind==='body').length,excludedGenderConflicts:genderConflicts.length,genderConflicts,errors,targets};
 await writeJson('data/description-male-avatars.json',result);await writeJson('config/description-avatar-candidates.json',{extractedAt:at,candidates});
 const report=`# 衣装概要からの男性アバター抽出\n\n抽出日時：${at}。保存済みBOOTH衣装${scanned}商品の作者概要・説明を解析。今回はネットワーク取得を行わない。元ページの取得日時は各根拠にfetchedAtとして保持。\n\n男性向けの対応一覧の明示、または登録済み男性アバターとの商品ID照合を根拠に${targets.length}対象を抽出。公開登録済み${targets.filter(t=>t.registered).length}、未登録・確認待ち${candidates.length}、共通素体${targets.filter(t=>t.kind==='body').length}。名称のみから性別・完成アバター・完全対応を断定しない。女性向け区分、導入ツール、利用規約、関連商品の欄を除外。女性対象モデルとして既知の商品との矛盾は要レビュー。\n\n## 全対象\n\n「概要記載衣装数」は対応が確認済みの掲載件数ではない。予定・未対応は候補根拠として保持し、通常の対応件数から除く。全根拠・作者の記載・出典URL・元取得日時は [JSON](../data/description-male-avatars.json) に保存。\n\n| 対象名 | 本体または素体 | 概要記載衣装数（予定除外） | 状態 |\n|---|---|---:|---|\n${targets.map(t=>`| ${String(t.name).replace(/\|/g,'／').replace(/\n/g,' ')} | ${t.url?`[${t.productId}](${t.url})`:t.productId??'URLなし'} | ${t.eligibleClothingCount} | ${t.status} |`).join('\n')}\n\n## 読み取り失敗\n\n${errors.length?errors.map(e=>`${e.productId}: ${e.error}`).join('\n'):'なし'}\n`;
 await fs.writeFile('docs/description-male-avatars-2026-10-07.md',report);console.log(JSON.stringify({scanned,uniqueTargets:targets.length,candidates:candidates.length,sharedBodies:result.sharedBodies,errors:errors.length,topCandidates:candidates.slice(0,15).map(c=>({name:c.name,id:c.productId,count:c.eligibleClothingCount}))},null,2));
}
