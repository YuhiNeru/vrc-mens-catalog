import floorAvatars from '../../config/floor-avatar-scope.json';
import femaleTargets from '../../config/female-targets.json';
import {variantMatches} from './audience';
import {authorDescription,extractDescriptionTargets} from './description-avatars';
import type {Product} from './model';

const floorIds=new Set(floorAvatars.map(a=>a.productId));
export const floorScopeNames=floorAvatars.flatMap(a=>[a.name,...a.aliases].flatMap(name=>{
 const clean=name.replace(/【[^】]*】|\[[^\]]*\]/g,' ').replace(/オリジナル(?:3D)?(?:男性)?(?:モデル|アバター)|\s*-VRChat.*|VRChatアバター.*|\s*\/\s*オリジナル.*|[「」『』｢｣#｜]/gi,' ').trim();
 return [name,clean,...clean.split(/\s*[\/／|()（）]\s*|\s+-\s*/)].map(n=>n.trim()).filter(n=>n&&!/^(?:旧モデル|RE|オリジナル3Dモデル)$/i.test(n));
}));
const floorNames=floorScopeNames;
const isFloorName=(name:string)=>floorNames.some(n=>variantMatches(name,n));
const sharedBody=/^[＋+]Head(?:$|[\s（(])|^PlusHead(?:$|[\s（(])|^MARUBODY$|^Neobody$|共通.*素体/i;
const unavailable=/非対応|未対応|対応予定|追加予定|準備中|未確認|未検証|coming soon|not supported/i;
const otherContent=/フルパック|全(?:部|体|アバター)|セット|支援|応援|寄付|サンプル|写真|スタンプ|テクスチャ|髪型|シェーダー|素体|内容物|グローブ|通常版|衣装|不要|必須|注意|導入|確認|^\d+体?$|^(?:MA|PC|Quest|Unity|FBX|Prefab|JP|EN|VRM|VRC|VRChat|Free|Full|Pack|Set|Color|Size|S|M|L|XL)$/i;

// フロア区分のルールであり、未登録モデルの性別を推測する処理ではない。
export function outsideFloorEvidence(html:string,product:Pick<Product,'kind'|'variants'>):string|null{
 if(product.kind!=='clothing')return null;
 const found=new Set<string>();
 for(const female of femaleTargets){
  if(product.variants.some(v=>!unavailable.test(v.name)&&[female.name,...female.aliases].some(n=>variantMatches(v.name,n))))found.add(female.name);
 }
 for(const t of extractDescriptionTargets(html,[])){
  if(t.planned||unavailable.test(t.context)||t.kind==='body'||t.fit!=='full'||!t.productId||floorIds.has(t.productId))continue;
  found.add(`${t.name} (${t.url})`);
 }
 const heading=/(?:対応(?:予定)?(?:アバター|モデル)|対象(?:アバター|モデル)|Supported Avatars|Compatible Avatars|Avatar List|対応一覧)/i;
 const stop=/利用規約|禁止事項|クレジット|謝辞|導入方法|商品内容|内容物|更新履歴|撮影|関連商品|使用アイテム|Terms of Use|Installation|Credits|Contents/i;
 let active=false,planned=false;
 for(const raw of authorDescription(html).split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  if(line.length<160&&stop.test(line)){active=false;continue;}
  if(line.length<160&&heading.test(line)){
   active=true;planned=unavailable.test(line);
   if(!/[：:]/.test(line))continue;
  }
  if(!active||planned||unavailable.test(line)||/https?:\/\//.test(line))continue;
  const payload=line.replace(/^.*?(?:対応アバター|対象アバター|対応モデル|対象モデル|Supported Avatars|Compatible Avatars)\s*[：:]\s*/i,'');
  for(const piece of payload.split(/[／/、,|&＆]/)){
   const label=piece.replace(/^[\s・●◆◇■□▶▷▼▽【】「」『』｢｣*\-]+|[\s【】「」『』｢｣]+$/gu,'').trim();
   if(!label||label.length>64||otherContent.test(label)||sharedBody.test(label)||isFloorName(label)||!/[\p{L}]/u.test(label))continue;
   // 未知の名前は対応一覧と販売対象版の両方で一致した場合に採用する。
   if(product.variants.some(v=>!unavailable.test(v.name)&&variantMatches(v.name,label)))found.add(label);
  }
 }
 if(!found.size)return null;
 return `掲載男性アバター98体以外の対応対象「${[...found].slice(0,3).join(' / ')}」を作者の対応一覧・販売対象版で確認。指定のフロア分類に従い男女兼用枠へ掲載（未登録モデルの性別は未判定）。`.slice(0,500);
}
