import { load } from 'cheerio/slim';
import { Avatar, Compatibility, Product, boothUrl, idSchema } from './model';
import {classifyAudience} from './audience';
import {outsideFloorEvidence} from './audience-scope';

export class ParseError extends Error {}
// 作者の説明欄だけを抽出。新版の商品ページは説明を複数のsectionへ分けている。
export const authorDescriptionSelector='.summary .description, #items .description, .js-market-item-detail-description, .market-item-detail-article section.shop__text > p.js-autolink';
export function assertPublicHtml(html:string) {
  // 通常商品にもCloudflareのjsd/main.jsが付く。チャレンジ画面の印だけを検出。
  if (/cf-chl-|challenge-platform\/(?:h|g)\/|class=["'][^"']*(?:g-recaptcha|h-captcha)|アクセスを確認しています|verify you are human|<title>\s*just a moment/i.test(html)) throw new ParseError('access challenge');
}
export function itemId(url:string) {
  boothUrl.parse(url);
  const match = new URL(url).pathname.match(/\/(?:ja\/|en\/|ko\/)?items\/(\d+)\/?$/);
  if(!match) throw new ParseError('invalid product URL');
  return idSchema.parse(match[1]);
}
export function parseProduct(html:string,url:string,avatars:Avatar[],fetchedAt=new Date().toISOString()):{product:Product,compatibility:Compatibility[],outsideFloorTarget:boolean} {
  assertPublicHtml(html);
  const id = itemId(url), $ = load(html);
  const records: any[] = [];
  $('script[type="application/ld+json"]').each((_,el)=> { try { const x=JSON.parse($(el).text()); records.push(...(Array.isArray(x)?x:x['@graph']??[x])); } catch {} });
  const ld=records.find(x=>x['@type']==='Product');
  const root=$(`[data-product-id="${id}"][data-tracking="detail_item"]`).first();
  if(!ld?.name || !ld.description || !root.length) throw new ParseError('missing Product metadata / description / item root');
  if(root.attr('data-product-id')!==id) throw new ParseError('product ID mismatch');
  const shopLink=$('a[data-product-list*="via shop_name"]').first();
  const shopUrl=shopLink.attr('href')??ld.brand?.url??null;
  const shop=shopLink.text().trim() || ld.brand?.name || root.attr('data-product-brand') || '';
  const variants:Product['variants']=[];
  $('#variations > .variation-item').each((_,el)=> {
    const v=$(el); const priceText=v.find('.variation-price').text();
    const match=priceText.match(/[¥￥]\s*([\d,]+)/);
    variants.push({name:v.find('.variation-name').text().trim() || v.find('[class*="variation-name"]').text().trim() || '通常版',price:match?Number(match[1].replace(/,/g,'')):null});
  });
  const prices=variants.flatMap(v=>v.price===null?[]:[v.price]);
  const tags=$('a[href*="/tags/"]').map((_,el)=>$(el).text().trim()).get().filter(Boolean);
  const category=root.attr('data-product-category');
  const kind:Product['kind']=avatars.some(a=>a.productId===id)?'avatar':category==='209'?'clothing':category==='217'?'accessory':'unknown';
  const rawImage=$('meta[property="og:image"]').attr('content') ?? (Array.isArray(ld.image)?ld.image[0]:ld.image);
  let imageUrl:string|null=null;
  try {if(new URL(rawImage).protocol==='https:' && /(^|\.)pximg\.net$/.test(new URL(rawImage).hostname))imageUrl=rawImage;}catch{}
  const product:Product={id,url:`https://booth.pm/ja/items/${id}`,name:ld.name,shop,shopUrl,kind,category:'未分類',style:'未分類',tags:[...new Set(tags)].slice(0,100),imageUrl,imageAllowed:true,...classifyAudience(ld.name,tags,variants,avatars.filter(a=>a.review==='verified').flatMap(a=>[a.name,...a.aliases])),
    catalogTags:[],likes:null,likesFetchedAt:null,variants,priceMin:prices.length?Math.min(...prices):null,priceMax:prices.length?Math.max(...prices):null,
    availability:'public',fetchedAt,publishedAt:null,review:'candidate'};
  // 自動抽出は常に候補。商品説明だけを使い、推薦商品のDOMやタイトルを根拠にしない。
  const sections=$(authorDescriptionSelector).map((_,el)=>$(el).text()).get();
  const desc=[...new Set([String(ld.description),...sections])].join('\n');
  const compatibility:Compatibility[]=[];
  if(kind!=='avatar') for(const a of avatars) {
    const names=[a.name,...a.aliases];
    const lines=desc.split(/\r?\n/);
    const mentions=lines.filter(l=>names.some(n=>n && l.toLocaleLowerCase().includes(n.toLocaleLowerCase())));
    if(!mentions.length && !variants.some(v=>names.some(n=>v.name.toLocaleLowerCase().includes(n.toLocaleLowerCase()))))continue;
    const evidence=mentions.find(l=>/対応|専用|用の衣装|for /i.test(l))??mentions[0]??'バリエーションに対象名あり';
    const fit=/セミ対応/.test(desc)?'semi':/変換|もちふぃった/.test(desc)?'conversion':/対応|専用|用の衣装/.test(evidence)?'full':'unknown';
    compatibility.push({productId:id,targetType:'avatar',targetId:a.id,fit,review:'candidate',evidence:evidence.trim().slice(0,500),variantNames:variants.filter(v=>names.some(n=>v.name.toLowerCase().includes(n.toLowerCase()))).map(v=>v.name)});
  }
  const outside=outsideFloorEvidence(html,product);
  if(outside){product.audience='unisex';product.audienceEvidence=outside;}
  return {product,compatibility,outsideFloorTarget:Boolean(outside)};
}
export function discover(html:string,url:string):string[] {
  assertPublicHtml(html);
  const $=load(html), ids=new Set<string>();
  // 検索結果のカードだけ。関連商品・フッターのリンクを無差別に拾わない。
  $('[data-product-id][data-tracking="impression_item"]').each((_,el)=> { const id=$(el).attr('data-product-id');if(id && /^\d+$/.test(id))ids.add(`https://booth.pm/ja/items/${id}`); });
  if(!$('.item-card').length && !html.includes('検索結果') && !html.includes('対象商品'))throw new ParseError(`missing search results: ${new URL(url).pathname}`);
  return [...ids];
}
export function searchPage(html:string,url:string) {
  const urls=discover(html,url),$=load(html);
  const text=$('body').text()||$.root().text();
  const total=text.match(/対象商品\s*([\d,]+)\s*件/)??text.match(/商品は([\d,]+)件あります/);
  const current=Number(new URL(url).searchParams.get('page')??1);
  const href=$('a[rel="next"]').first().attr('href')??$('.pager a[href]').toArray().map(el=>$(el).attr('href')!).find(h=>Number(new URL(h,url).searchParams.get('page'))===current+1);
  let next:string|null=null;
  if(href){const u=new URL(href,url);boothUrl.parse(u.href);if(u.origin!==new URL(url).origin||u.pathname!==new URL(url).pathname)throw new ParseError('unexpected pagination target');next=u.href;}
  return {urls,next,totalReported:total?Number(total[1].replace(/,/g,'')):null};
}
