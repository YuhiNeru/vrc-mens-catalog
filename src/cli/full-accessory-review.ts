import {type Avatar,type Catalog,type Compatibility,type Product} from '../shared/model';
import {authorDescription,extractDescriptionTargets} from '../shared/description-avatars';
import {confirmListedVariants} from '../shared/listing';

export const accessorySearchTerms=['ピアス','イヤリング','イヤーカフ','piercing','earring','ear cuff','ネックレス','チョーカー','necklace','choker','首輪','ブレスレット','バングル','bracelet','bangle','指輪','ネイル','ring','nail','手袋','グローブ','gloves','靴','ブーツ','スニーカー','靴下','shoes','boots','socks','眼鏡','メガネ','サングラス','ゴーグル','glasses','goggles','帽子','キャップ','ハット','hat','cap','バッグ','リュック','ポーチ','bag','backpack','pouch','ハーネス','ガーター','harness','garter','マスク','mask','尻尾','獣耳','猫耳','tail','ears','ヘッドホン','イヤホン','ヘアピン','髪飾り','カチューシャ','headphones','hairpin','絆創膏','ボディーチェーン'];
const patterns:[string,RegExp][]=[
 ['靴・レッグウェア',/靴|シューズ|ブーツ|スニーカー|サンダル|ソックス|タイツ|レッグウォーマー|\b(?:shoes?|boots?|sneakers?|sandals?|socks|tights|stockings)\b/i],
 ['眼鏡・ゴーグル',/眼鏡|メガネ|めがね|ゴーグル|サングラス|グラス|モノクル|アイウェア|\b(?:glasses|goggles|monocle|eyewear)\b/i],
 ['ピアス',/ピアス|イヤリング|イヤーカフ|\b(?:piercings?|earrings?|ear.?cuff)\b/i],
 ['首元アクセサリー',/ネックレス|チョーカー|首輪|ネクタイ|\b(?:necklace|choker|collar|necktie)\b/i],
 ['ブレスレット',/ブレスレット|腕輪|アンクレット|バングル|\b(?:bracelet|bangle|anklet)\b/i],
 ['手袋',/手袋|グローブ|\bgloves?\b/i],['ネイル・指輪',/ネイル|指輪|チェーンリング|\b(?:nails?|rings?)\b/i],
 ['帽子',/帽子|キャップ|ベレー|ビーニー|ハット|笠|\b(?:hat|cap|beanie)\b/i],
 ['バッグ',/バッグ|鞄|ポーチ|リュック|\b(?:bag|pouch|backpack)\b/i],
 ['ハーネス',/ハーネス|ガーター|ボディーチェーン|\b(?:harness|garter)\b/i],['マスク',/マスク|\bmask\b/i],
 ['耳・尻尾',/尻尾|しっぽ|けもみみ|ケモミミ|獣耳|猫耳|狐耳|\b(?:tail|ears)\b/i],
 ['頭・髪飾り',/髪飾り|ヘアピン|カチューシャ|ヘッドドレス|ヘッドホン|ヘッドフォン|イヤホン|ヘイロー|角|チェーンリボン|\b(?:hairpin|headphones?|headset|halo|earphones?|horns?)\b/i],
 ['顔まわり小物',/絆創膏|フェイスアクセ|SewnFace/i],['口元小物',/付け髭|白ひげ|口元|\b(?:beard|mouth accessory)\b/i]
];
export function accessoryCategory(product:Pick<Product,'name'|'kind'>,description:string):string|null {
 if(!['accessory','clothing'].includes(product.kind))return null;
 const name=product.name.replaceAll('_',' ');
 // 衣装・髪型セット、素材、ツールを小物売り場へ移さない。
 if(/テクスチャ|texture|シェーダー|shader|マテリアル|matcap|ツール|撮影.*ポーズ|pose.?animation|素体|body.?base|タトゥー|tattoo|髪型|ヘアー|ヘアセット|Hair\b|パーカー|ワンピ|ランジェリー|衣装セット|衣装.*[＆&＋+]|[＆&＋+].*衣装|tops|pants|dress|outfit|uniform|sweater|hoodie|shirt|skirt/i.test(name))return null;
 return patterns.find(([,r])=>r.test(name))?.[0]??(product.kind==='accessory'?patterns.find(([,r])=>r.test(description.slice(0,400)))?.[0]??null:null);
}
export function reviewedAccessory(html:string,product:Product,avatars:Avatar[],bodies:Catalog['bodies']):{category:string,relations:Compatibility[]}|null {
 const description=authorDescription(html),category=accessoryCategory(product,description);
 if(!category||product.availability!=='public'||!product.imageAllowed)return null;
 const ids=new Set(avatars.map(a=>a.id)),bodyIds=new Set(avatars.filter(a=>a.bodyId&&a.bodyEvidence.trim()).map(a=>a.bodyId));
 const relations=new Map<string,Compatibility>();
 for(const t of extractDescriptionTargets(html,avatars)){
  if(!t.avatarId||!ids.has(t.avatarId)||!['full','semi'].includes(t.fit)||t.planned||t.gender==='female'||/非対応|未対応|未確認|未検証|対応予定|追加予定|準備中|not supported|撮影|クレジット|サンプル画像|使用アイテム/i.test(t.context))continue;
  const a=avatars.find(a=>a.id===t.avatarId)!;
  const exact=t.context.includes('/'+a.productId)||[a.name,...a.aliases].some(n=>new RegExp('(?:^|[\\s【「・/])'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[\\s】」/（(・-])','iu').test(t.context));
  if(!exact)continue;
  relations.set('avatar:'+a.id,{productId:product.id,targetType:'avatar',targetId:a.id,fit:t.fit as 'full'|'semi',review:'verified',variantNames:[],evidence:`作者の対応一覧を照合。${t.context}`.slice(0,500)});
 }
 for(const r of confirmListedVariants(html,{...product,kind:'accessory'},avatars,bodies)){
  if(r.targetType==='avatar'?ids.has(r.targetId):bodyIds.has(r.targetId))relations.set(r.targetType+':'+r.targetId,{...r,evidence:r.evidence.replace('衣装販売','小物販売')});
 }
 return relations.size?{category,relations:[...relations.values()]}:null;
}
