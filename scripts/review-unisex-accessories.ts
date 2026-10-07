import fs from 'node:fs/promises';
import {publicCatalog,type Catalog} from '../src/shared/model';
import {authorDescription} from '../src/shared/description-avatars';
const store=JSON.parse(await fs.readFile('data/catalog.json','utf8')) as Catalog;
const items=publicCatalog(store).products.filter(p=>p.kind==='clothing'&&p.audience==='unisex');
const accessory=/靴|シューズ|ブーツ|スニーカー|サンダル|ローファー|ヒール|眼鏡|メガネ|ゴーグル|帽子|ピアス|ネックレス|指輪|チョーカー|首輪|手袋|グローブ|靴下|ソックス|タイツ|レッグ|ガーター|ネイル|ハーネス|マスク|イヤリング|イヤーカフ|ブレスレット|アンクレット|ヘッドホン|ヘッドフォン|ヘアピン|髪飾り|尻尾|しっぽ|角|鞄|バッグ|ポーチ|ベルト|\b(?:shoes?|boots?|sneakers?|sandals?|loafers?|heels?|glasses|goggles|hat|cap|piercing|necklace|choker|collar|gloves?|socks|tights|stockings|garter|nails?|harness|mask|earrings?|bracelet|headphones?|hairpin|tail|horns?|bag|belt)\b/i;
const candidates=[];
for(const p of items){
 if(!accessory.test(p.name))continue;
 const text=authorDescription(await fs.readFile(`data/raw/${p.id}.html`,'utf8')).replace(/\s+/g,' ');
 candidates.push({id:p.id,name:p.name,description:text.slice(0,600),fetchedAt:p.fetchedAt});
}
await fs.writeFile('data/unisex-accessory-candidates.json',JSON.stringify(candidates,null,2));
console.log(JSON.stringify(candidates,null,2));
