import {load} from 'cheerio/slim';
import {Avatar} from './model';
import {authorDescriptionSelector} from './parser';
import {variantMatches} from './audience';

export type DescriptionTarget={name:string,productId:string|null,url:string|null,avatarId:string|null,kind:'avatar'|'body'|'unknown',gender:'male'|'female'|'unknown',genderBasis:string,context:string,fit:'full'|'semi'|'conversion'|'unknown',planned:boolean};
export function authorDescription(html:string){
 const $=load(html),blocks:string[]=[];
 $('script[type="application/ld+json"]').each((_,e)=>{try{const parsed=JSON.parse($(e).text());const records=Array.isArray(parsed)?parsed:parsed['@graph']??[parsed];for(const p of records)if(p['@type']==='Product'&&p.description)blocks.push(String(p.description));}catch{}});
 $(authorDescriptionSelector).each((_,e)=>{
   const p=$(e).clone();p.find('br').replaceWith('\n');p.find('a[href]').each((_,a)=>{const href=p.find(a).attr('href');if(href&&/^https:\/\//.test(href)&&!p.find(a).text().includes(href))p.find(a).append(' '+href);});
   const heading=$(e).parent('section.shop__text').find('h2,h3').first().text();
   blocks.push([heading,p.text()].filter(Boolean).join('\n'));
 });
 return [...new Set(blocks.map(x=>x.trim()).filter(Boolean))].join('\n\n');
}
const male=/(?:男性(?:向け|用|アバター|素体)?|メンズ|男の子|少年|\bmale\b|\bmen'?s?\b)/i;
const female=/(?:女性(?:向け|用|アバター|素体)?|レディース|女の子|\bfemale\b|\bwomen'?s?\b|\blady'?s?\b|\bladies\b)/i;
const stop=/(?:利用規約|禁止事項|クレジット|謝辞|導入方法|シェーダー|商品内容|内容物|同梱|更新履歴|アップデート履歴|撮影|関連商品|使用アイテム|対応シェイプキー|Terms of Use|Installation|Credits|Contents|Shader)/i;
const heading=/(?:対応(?:予定)?(?:アバター|モデル|素体)|対象(?:アバター|モデル)|Supported Avatars|Compatible Avatars|Avatar List|対応一覧)/i;
const technical=/(?:liltoon|shader|Modular.?Avatar|ツール|改変用|シェーダー|お問い合わせ|製作者|制作者様|衣装はこちら|関連商品|髪型|ヘア|ポーズ集|テクスチャ|無料配布しています|メスケモ単体|MatCap|マットキャップ|素材|マテリアル|衣装モデル)/i;
const caution=/(?:非対応|未対応|未検証|未確認|対応予定|追加予定|近日|準備中|not supported|coming soon)/i;
const genderHeading=(line:string)=>{
 const label=line.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
 return line.length<100&&!/[。!?]/.test(line)&&(heading.test(line)||/^(?:male|female)\s+version\b/i.test(label)||/^(?:男性(?:向け|用)?|女性(?:向け|用)?|メンズ|レディース|male|female|men'?s?|women'?s?|lady'?s?|ladies)(?:[\s:/・-]*(?:avatar|アバター|version|カテゴリ|type|タイプ|版|向け|用|対象|対応|male|female|men'?s?|women'?s?|[ABＡＢ]))*$/i.test(label));
};
const clean=(s:string)=>s.replace(/https?:\/\/\S+/g,'').replace(/^[\s・●◆◇■□▶▷▼▽⭐ꕥ✦✧【】\-*]+/u,'').replace(/^(?:オリジナル)?3D(?:アバター|モデル)】?\s*/,'').trim().slice(0,160);
export function extractDescriptionTargets(html:string,avatars:Avatar[]):DescriptionTarget[]{
 const text=authorDescription(html),lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const maleOnly=/(?:男性(?:型)?アバター(?:向け|用)|メンズアバター(?:向け|用|の)|for men'?s? avatars)/i;
 const globalMale=lines.slice(0,12).some(l=>maleOnly.test(l)&&!female.test(l))&&!female.test(text)&&!/(男女|unisex|ユニセックス)/i.test(text);
 const result:DescriptionTarget[]=[],seen=new Set<string>();
 let scope:'male'|'female'|'unknown'='unknown',scopeEvidence='',inTargets=false,plannedScope=false,excludedSection=false;
 for(let i=0;i<lines.length;i++){
   const line=lines[i],isHeader=line.length<160;
   if(isHeader&&stop.test(line)){inTargets=false;scope='unknown';scopeEvidence='';plannedScope=false;excludedSection=true;}
   if(isHeader&&heading.test(line)){inTargets=true;plannedScope=/予定|近日|準備中/.test(line);excludedSection=false;if(!male.test(line)&&!female.test(line)){scope='unknown';scopeEvidence='';}}
   // A/B男女別の対応一覧。寸法や説明文中の性別語で対象一覧の区分を変えない。
   if(genderHeading(line)){
     if(female.test(line)&&!male.test(line)){scope='female';scopeEvidence=line;}
     else if(male.test(line)&&!female.test(line)){scope='male';scopeEvidence=line;}
     else if(male.test(line)&&female.test(line)){scope='unknown';scopeEvidence='';}
   }
   const urls=[...line.matchAll(/https:\/\/(?:[a-z0-9-]+\.)?booth\.pm\/(?:ja\/|en\/|ko\/)?items\/(\d{1,12})/gi)];
   if(excludedSection)continue;
   for(const match of urls){
     const id=match[1],registered=avatars.find(a=>a.productId===id),previous=lines.slice(Math.max(0,i-3),i),label=clean(line.slice(0,match.index))||clean([...previous].reverse().find(l=>!/^https?:/.test(l)&&!/[様ꕥ]$/.test(l)&&!heading.test(l))??'');
     if(!/[\p{L}\p{N}]/u.test(label)||technical.test(label)||(!inTargets&&!registered&&!/アバター|3Dモデル|素体|Avatar/i.test(label)))continue;
     const gender=scope==='female'?'female':registered?.review==='verified'?'male':scope==='male'||globalMale?'male':'unknown';
     const context=[...previous,line,lines[i+1]??''].join('\n').slice(0,1100);
     const kind=registered?'avatar':id==='5153266'||/共通素体|^(?:[＋+]Head|PlusHead)(?:$|\s|[（(])|^MARUBODY$|素体モデル/i.test(label)?'body':'unknown';
     const key=id+':'+gender+':'+scopeEvidence;if(seen.has(key))continue;seen.add(key);
     result.push({name:registered?.name??label,productId:id,url:match[0],avatarId:registered?.id??null,kind,gender,genderBasis:scopeEvidence||(registered?.review==='verified'?registered.genderEvidence:globalMale?lines.slice(0,12).find(l=>maleOnly.test(l)&&!female.test(l))??'':''),context,fit:/セミ対応|半対応/.test(context)?'semi':/もちふぃった|変換/.test(context)?'conversion':inTargets?'full':'unknown',planned:plannedScope||caution.test(label)});
   }
   // 販売停止などでURLがない既知アバターも、作者の対応一覧にある場合は拾う。
   if(inTargets&&!urls.length&&!technical.test(line)&&line.length<220)for(const a of avatars.filter(a=>a.review==='verified')){
     if(![a.name,...a.aliases].some(n=>variantMatches(line,n)))continue;
     if(heading.test(line)||stop.test(line)||male.test(line)||female.test(line))continue;
     const gender=scope==='female'?'female':'male',key=a.productId+':'+gender+':'+scopeEvidence;
     if(seen.has(key))continue;seen.add(key);
     result.push({name:a.name,productId:a.productId,url:null,avatarId:a.id,kind:'avatar',gender,genderBasis:scopeEvidence||a.genderEvidence,context:lines.slice(Math.max(0,i-1),i+2).join('\n').slice(0,1100),fit:/セミ対応|半対応/.test(line)?'semi':/変換|もちふぃった/.test(line)?'conversion':'full',planned:plannedScope||caution.test(line)});
   }
 }
 return result;
}
