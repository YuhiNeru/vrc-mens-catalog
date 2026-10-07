import fs from 'node:fs/promises';
import {outsideFloorEvidence} from '../shared/audience-scope';
import {classifyAudience} from '../shared/audience';
import floorAvatars from '../../config/floor-avatar-scope.json';
import {Catalog,ImportData,importSchema,publicCatalog} from '../shared/model';
import {readJson,writeJson} from './files';

export async function reclassifyAudience(targetIds?:string[]){
 const store=await readJson<Catalog>('data/catalog.json'),clothes=store.products.filter(p=>p.kind==='clothing'&&(!targetIds||targetIds.includes(p.id)));
 const verifiedProducts=new Set(publicCatalog(store).compatibility.map(r=>r.productId));
 const floorNames=floorAvatars.flatMap(a=>[a.name,...a.aliases]);
 const relations=new Map<string,Catalog['compatibility']>();
 for(const r of store.compatibility){const list=relations.get(r.productId)??[];list.push(r);relations.set(r.productId,list);}
 let pending:ImportData={products:[],avatars:[],bodies:[],compatibility:[],runs:[]};
 const flush=async()=>{
  if(!pending.products.length)return;
  await writeJson(`data/outbox/${Date.now()}-${crypto.randomUUID()}.json`,importSchema.parse(pending));
  pending={products:[],avatars:[],bodies:[],compatibility:[],runs:[]};
 };
 const changes:{productId:string,url:string,fetchedAt:string,previousAudience:string,evidence:string}[]=[];
 let processed=0;
 for(const p of clothes){
  const evidence=outsideFloorEvidence(await fs.readFile(`data/raw/${p.id}.html`,'utf8'),p);
  const staleScope=p.audienceEvidence.startsWith('掲載男性アバター98体以外');
  if(evidence||staleScope){
   const override=store.overrides.find(o=>o.entity==='product'&&o.key===p.id);
   const previousAudience=p.audience;
   const classification=evidence?{audience:'unisex' as const,audienceEvidence:evidence}:classifyAudience(p.name,p.tags,p.variants,floorNames);
   const review=p.review==='excluded'?'excluded':evidence||verifiedProducts.has(p.id)?'verified':'candidate';
   if(p.audience!==classification.audience||p.audienceEvidence!==classification.audienceEvidence||p.review!==review){
    Object.assign(p,classification,{review});
    if(override?.entity==='product'&&(override.patch.audience||override.patch.audienceEvidence)){Object.assign(override.patch,classification);}
    const rs=relations.get(p.id)??[];
    if(pending.products.length>=25||pending.compatibility.length+rs.length>500)await flush();
    pending.products.push(p);pending.compatibility.push(...rs);
    changes.push({productId:p.id,url:p.url,fetchedAt:p.fetchedAt,previousAudience,evidence:classification.audienceEvidence});
   }
  }
  processed++;
  if(processed%200===0){await flush();await writeJson('data/catalog.json',store);await writeJson('data/progress-audience-scope.json',{phase:'processing',processed,total:clothes.length,changed:changes.length});console.log(`audience ${processed}/${clothes.length}; changed ${changes.length}`);}
 }
 await flush();await writeJson('data/catalog.json',store);
 const pub=publicCatalog(store),published=pub.products.filter(p=>p.kind==='clothing'),unisex=published.filter(p=>p.audience==='unisex').length;
 const result={phase:'complete',checkedAt:new Date().toISOString(),processed,total:clothes.length,changed:changes.length,avatars:pub.avatars.length,regular:published.length-unisex,unisex,totalPublished:published.length,changes};
 await writeJson('data/progress-audience-scope.json',result);
 if(!targetIds)await fs.writeFile('docs/audience-floor-scope-2026-10-07.md',`# 女性・掲載98体以外のアバター対応衣装の振り分け\n\n確認日時 ${result.checkedAt}（UTC）。ユーザー指定の98体は config/floor-avatar-scope.json に固定して記録。女性向け販売版、または98体以外への対応が作者の対応一覧・販売対象版にある衣装を男女兼用フロアへ掲載する。98体への対応がなくてもこのフロアに掲載する。未登録モデルの性別は推測しない。撮影・関連商品の紹介・対応予定・非対応・共通素体だけの記載はこの分類の根拠にしない。元のBOOTH画像URLを使用。\n\n保存済み衣装${clothes.length}件をネットワーク取得なしで再分類。${changes.length}件の分類・根拠・公開状態を更新。ローカル保存上の掲載衣装${published.length}件（通常${published.length-unisex}件、男女兼用${unisex}件）。フロア反映はローカルD1への取り込みで行う。今後の取得にも同じ分類を適用。\n\n| 商品 | 元分類 | 取得元 | 元取得日時（UTC） | 根拠 |\n|---|---|---|---|---|\n${changes.map(c=>`| ${c.productId} | ${c.previousAudience} | ${c.url} | ${c.fetchedAt} | ${c.evidence.replace(/\|/g,'／').replace(/\n/g,' ')} |`).join('\n')}\n`);
 console.log(JSON.stringify({processed,changed:changes.length,avatars:pub.avatars.length,regular:published.length-unisex,unisex,total:published.length}));
}
