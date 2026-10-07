import { load } from 'cheerio/slim';
import { Avatar, Compatibility, Product, bodySchema } from './model';
import {z} from 'zod';
import {variantMatches} from './audience';
import {authorDescriptionSelector} from './parser';
const norm=(s:string)=>s.normalize('NFKC').toLocaleLowerCase();
const contains=(text:string,name:string)=>{
  const n=norm(name),t=norm(text);
  if(/^[a-z]+$/.test(n))return new RegExp(`(^|[^a-z])${n}([^a-z]|$)`,'i').test(t);
  return t.includes(n);
};
// 作者が衣装の購入バリエーションとして対象を明示した場合だけ掲載根拠を作る。
// タイトル・関連商品の紹介・検索ヒットは確認の根拠にしない。
export function confirmListedVariants(html:string,product:Product,avatars:Avatar[],bodies:z.infer<typeof bodySchema>[]=[]):Compatibility[] {
  if(!['clothing','accessory'].includes(product.kind))return [];
  const $=load(html);
  const records=$('script[type="application/ld+json"]').map((_,el)=>{try{return JSON.parse($(el).text());}catch{return null;}}).get();
  const ld=records.find(x=>x?.['@type']==='Product');
  const text=[String(ld?.description??''),...$(authorDescriptionSelector).map((_,el)=>$(el).text()).get()].join('\n');
  const lines=text.split(/\n/).map(s=>s.trim()).filter(Boolean);
  const result:Compatibility[]=[];
  for(const a of avatars){
    const names=[a.name,...a.aliases];
    const variants=product.variants.filter(v=>names.some(n=>variantMatches(v.name,n))&&!/非対応|未対応|対応予定|準備中|近日|サンプル|sample|写真集|スタンプ|支援のみ|支援用/i.test(v.name));
    if(!variants.length)continue;
    const caution=lines.filter(l=>names.some(n=>contains(l,n))&&/セミ対応|半対応|変換|もちふぃった|非対応|未対応|対応予定|未検証|未確認/.test(l));
    // 注意書きがある対象は手動確認へ。別アバターのセミ対応を全対象へ広げない。
    if(caution.length)continue;
    if(/変換前提|もちふぃった|セミ対応|半対応/.test(text))continue;
    result.push({productId:product.id,targetType:'avatar',targetId:a.id,fit:'full',review:'verified',variantNames:variants.map(v=>v.name),
      evidence:`作者の衣装販売バリエーション「${variants.map(v=>v.name).join(' / ')}」を照合。対象版の明示を確認（自動照合）。導入条件は販売ページで確認。`.slice(0,500)});
  }
  // 共通素体の販売版は素体への関係として保存。本体側の採用根拠があるアバターへだけ展開する。
  if(bodies.length){
    const bodyTargets:Avatar[]=bodies.map(b=>({id:b.id,productId:'0',name:b.name,aliases:[b.id],author:'',bodyId:null,bodyEvidence:'',genderEvidence:'',ageGroup:'未分類',review:'verified'}));
    result.push(...confirmListedVariants(html,product,bodyTargets).map(r=>({...r,targetType:'body' as const,evidence:r.evidence.replace('対象版の明示','共通素体版の明示')})));
  }
  return result;
}
