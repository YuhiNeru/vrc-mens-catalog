import fs from 'node:fs/promises';
import {effective,publicCatalog,type Catalog} from '../src/shared/model';
import {parseProduct} from '../src/shared/parser';
import {confirmListedVariants} from '../src/shared/listing';
import {authorDescription,extractDescriptionTargets} from '../src/shared/description-avatars';
const store=JSON.parse(await fs.readFile('data/catalog.json','utf8')) as Catalog;
const pub=publicCatalog(store),avatars=effective(store).avatars.filter(a=>a.review==='verified');
const ids=new Set(avatars.map(a=>a.id)),published=new Set((JSON.parse(await fs.readFile('config/accessory-classification.json','utf8')) as {id:string}[]).map(p=>p.id));
const patterns:[string,RegExp][]=[
 ['ピアス',/ピアス|イヤリング|イヤーカフ|\b(?:piercings?|earrings?|ear.?cuff)\b/i],
 ['靴・レッグウェア',/靴|シューズ|ブーツ|スニーカー|サンダル|ローファー|ヒール|靴下|ソックス|タイツ|レッグウォーマー|\b(?:shoes?|boots?|sneakers?|sandals?|loafers?|heels?|socks|tights|stockings)\b/i],
 ['眼鏡・ゴーグル',/眼鏡|メガネ|めがね|ゴーグル|サングラス|グラス|モノクル|アイウェア|\b(?:glasses|goggles|monocle|eyewear)\b/i],
 ['首元アクセサリー',/ネックレス|チョーカー|首輪|\b(?:necklace|choker|collar)\b/i],
 ['手袋',/手袋|グローブ|\bgloves?\b/i],['ネイル・指輪',/ネイル|指輪|チェーンリング|\b(?:nails?|rings?)\b/i],
 ['帽子',/帽子|キャップ|ベレー|ビーニー|ハット|\b(?:hat|cap|beanie)\b/i],
 ['バッグ',/バッグ|鞄|ポーチ|リュック|\b(?:bag|pouch|backpack)\b/i],['ブレスレット',/ブレスレット|腕輪|アンクレット|バングル|\b(?:bracelet|anklet|bangle)\b/i],
 ['ハーネス',/ハーネス|ガーター|\b(?:harness|garter)\b/i],['マスク',/マスク|\bmask\b/i],
 ['耳・尻尾',/尻尾|しっぽ|けもみみ|ケモミミ|獣耳|猫耳|狐耳|\b(?:tail|ears)\b/i],
 ['頭・髪飾り',/髪飾り|ヘアピン|カチューシャ|ヘッドドレス|ヘッドホン|ヘッドフォン|イヤホン|ヘイロー|チェーンリボン|\b(?:hairpin|headphones?|headset|halo|earphones?)\b/i],
 ['顔まわり小物',/絆創膏|フェイスアクセ|SewnFace/i]
];
const records=[];
const scope=process.argv[2]==='expansion'?new Set([
 ...(JSON.parse(await fs.readFile('data/accessory-expansion-crawl.json','utf8')) as {queue:string[]}).queue,
 ...(JSON.parse(await fs.readFile('config/reviewed-accessory-expansion.json','utf8')) as {id:string}[]).map(p=>p.id)
]):null;
for(const p of store.products){
 if(scope&&!scope.has(p.id))continue;
 if(published.has(p.id)&&!scope)continue;
 try{
 let category=patterns.find(([,regex])=>regex.test(p.name.replaceAll('_',' ')))?.[0];
 if(!category&&p.kind!=='accessory')continue;
 const html=await fs.readFile(`data/raw/${p.id}.html`,'utf8');
 const description=authorDescription(html).replace(/\s+/g,' ');
 category??=patterns.find(([,regex])=>regex.test(description.slice(0,400)))?.[0];if(!category)continue;
 const parsed=parseProduct(html,p.url,avatars,p.fetchedAt);parsed.product.kind='accessory';
 const sales=confirmListedVariants(html,parsed.product,avatars,store.bodies).filter(r=>r.targetType==='body'||ids.has(r.targetId));
 const desc=extractDescriptionTargets(html,avatars).filter(t=>{
  if(!t.avatarId||!ids.has(t.avatarId)||t.fit!=='full'||t.planned||t.gender==='female'||/非対応|未対応|未確認|未検証|対応予定|追加予定|準備中|not supported/i.test(t.context))return false;
  const a=avatars.find(a=>a.id===t.avatarId)!;
  // 「アル」が「アルエ」に一致するような部分一致を掲載根拠にしない。
  return t.context.includes('/'+a.productId)||[a.name,...a.aliases].some(name=>new RegExp('(?:^|[\\s【「・/])'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[\\s】」/（(・-])','iu').test(t.context));
 });
 records.push({id:p.id,name:p.name,category,description:description.slice(0,500),sales,descriptionTargets:desc,fetchedAt:p.fetchedAt});
 }catch{}
}
await fs.writeFile('data/other-accessory-audit.json',JSON.stringify(records,null,2));
const supported=records.filter(r=>r.sales.length||r.descriptionTargets.length);
console.log(JSON.stringify({candidates:records.length,supported:supported.length}));
for(const r of supported)console.log(`${r.id} | ${r.category} | ${r.name} | ${r.description.slice(0,120)}`);
