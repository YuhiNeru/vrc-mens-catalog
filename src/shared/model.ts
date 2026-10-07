import { z } from 'zod';
import {refreshFloorTags} from './floor-tags';
import accessoryClassifications from '../../config/accessory-classification.json';

const short = z.string().max(500);
export const idSchema = z.string().regex(/^\d{1,12}$/);
const key = z.string().regex(/^[a-zA-Z0-9_+-]{1,80}$/);
const https = z.url().refine(s => new URL(s).protocol === 'https:');
export const boothUrl = https.refine(s => { const u = new URL(s); return (u.hostname === 'booth.pm' || /^[a-z0-9-]+\.booth\.pm$/.test(u.hostname)) && !u.username && !u.password && !u.port; });
export const statusSchema = z.enum(['candidate','verified','excluded']);
export const kindSchema = z.enum(['avatar','clothing','hair','accessory','texture','unknown']);
export const variantSchema = z.object({name:short, price:z.number().int().nonnegative().nullable()}).strict();
export const productSchema = z.object({
  id:idSchema, url:boothUrl, name:short.min(1), shop:short, shopUrl:boothUrl.nullable(),
  kind:kindSchema, category:short, style:short, tags:z.array(short).max(100),
  catalogTags:z.array(short).max(100).default([]),
  likes:z.number().int().nonnegative().nullable().default(null),likesFetchedAt:z.iso.datetime().nullable().default(null),
  audience:z.enum(['male','unisex','unknown']).default('unknown'),audienceEvidence:short.default(''),
  imageUrl:https.refine(s => /(^|\.)pximg\.net$/.test(new URL(s).hostname)).nullable(),
  imageAllowed:z.boolean(), variants:z.array(variantSchema).max(200),
  priceMin:z.number().int().nonnegative().nullable(), priceMax:z.number().int().nonnegative().nullable(),
  availability:z.enum(['public','unavailable','unknown']), fetchedAt:z.iso.datetime(),
  publishedAt:z.string().max(80).nullable(), review:statusSchema
}).strict();
export const avatarSchema = z.object({id:key,productId:idSchema,name:short,aliases:z.array(short).max(30),author:short,
  bodyId:key.nullable(),bodyEvidence:short,genderEvidence:short,ageGroup:z.enum(['青年','少年','中性的','壮年','未分類']),review:statusSchema}).strict();
export const bodySchema = z.object({id:key,name:short,evidence:short}).strict();
export const compatibilitySchema = z.object({productId:idSchema,targetType:z.enum(['avatar','body']),targetId:key,
  fit:z.enum(['full','semi','conversion','unknown']),review:statusSchema,evidence:short,
  variantNames:z.array(short).max(100)}).strict();
export const runSchema = z.object({id:z.string().max(100),location:z.enum(['local','cloudflare']),startedAt:z.iso.datetime(),endedAt:z.iso.datetime().nullable(),
  status:z.enum(['running','complete','stopped']),success:z.number().int().nonnegative(),failure:z.number().int().nonnegative(),updated:z.number().int().nonnegative(),cursor:z.number().int().nonnegative(),reason:short}).strict();
export const overrideSchema = z.discriminatedUnion('entity',[
  z.object({entity:z.literal('product'),key:idSchema,patch:productSchema.pick({kind:true,category:true,style:true,review:true,imageAllowed:true,availability:true,audience:true,audienceEvidence:true}).partial().strict()}),
  z.object({entity:z.literal('avatar'),key,patch:avatarSchema.omit({id:true,productId:true}).partial().strict()}),
  z.object({entity:z.literal('compatibility'),key:z.string().regex(/^\d{1,12}:(avatar|body):[a-zA-Z0-9_+-]{1,80}$/),patch:compatibilitySchema.omit({productId:true,targetType:true,targetId:true}).partial().strict()})
]);
export const importSchema = z.object({products:z.array(productSchema).max(50),avatars:z.array(avatarSchema).max(50).default([]),
  bodies:z.array(bodySchema).max(50).default([]),compatibility:z.array(compatibilitySchema).max(500).default([]),runs:z.array(runSchema).max(50).default([])}).strict();
export type Product = z.infer<typeof productSchema>;
export type Avatar = z.infer<typeof avatarSchema>;
export type Compatibility = z.infer<typeof compatibilitySchema>;
export type Run = z.infer<typeof runSchema>;
export type ImportData = z.infer<typeof importSchema>;
export type Override = z.infer<typeof overrideSchema>;
export type Catalog = ImportData & {overrides:Override[]};
export const relationKey = (r:Compatibility) => `${r.productId}:${r.targetType}:${r.targetId}`;

export function effective(data:Catalog):Catalog {
  const products = new Map(data.products.map(p => {const classification=accessoryClassifications.find(c=>c.id===p.id);return [p.id,{...p,...(classification?{kind:'accessory' as const,category:classification.category}:{})}];}));
  const avatars = new Map(data.avatars.map(a => [a.id,{...a}]));
  const relations = new Map(data.compatibility.map(r => [relationKey(r),{...r}]));
  for (const o of data.overrides) {
    if (o.entity === 'product' && products.has(o.key)) Object.assign(products.get(o.key)!,o.patch);
    if (o.entity === 'avatar' && avatars.has(o.key)) Object.assign(avatars.get(o.key)!,o.patch);
    if (o.entity === 'compatibility') {
      const [productId,targetType,targetId] = o.key.split(':');
      const base = relations.get(o.key) ?? {productId,targetType:targetType as 'avatar'|'body',targetId,fit:'unknown',review:'candidate',evidence:'',variantNames:[]};
      relations.set(o.key,compatibilitySchema.parse({...base,...o.patch}));
    }
  }
  return refreshFloorTags({...data,products:[...products.values()],avatars:[...avatars.values()],compatibility:[...relations.values()]});
}
export function materializeCatalogTags(data:Catalog){
 const tags=new Map(effective(data).products.map(p=>[p.id,p.catalogTags]));
 for(const p of data.products)p.catalogTags=tags.get(p.id)??[];
 return data;
}
export function publicCatalog(data:Catalog) {
  const d = effective(data);
  const live = new Set(d.products.filter(p=>p.review==='verified' && p.availability==='public').map(p=>p.id));
  const avatars = d.avatars.filter(a=>a.review==='verified' && live.has(a.productId) && d.products.find(p=>p.id===a.productId)?.kind==='avatar');
  const avatarIds = new Set(avatars.map(a=>a.id));
  const bodyIds = new Set(avatars.filter(a=>a.bodyId && a.bodyEvidence.trim()).map(a=>a.bodyId));
  // 検索ヒットや女性・未登録モデルへの対応だけでは掲載しない。
  const compatibility = d.compatibility.filter(r=>r.review==='verified' && r.fit!=='unknown' && r.evidence.trim() && live.has(r.productId) && (r.targetType==='avatar'?avatarIds.has(r.targetId):bodyIds.has(r.targetId)));
  const clothingIds = new Set(compatibility.map(r=>r.productId));
  const products = d.products.filter(p=>live.has(p.id) && (avatars.some(a=>a.productId===p.id)||(['clothing','accessory'].includes(p.kind) && clothingIds.has(p.id))));
  return {products,avatars,compatibility,bodies:d.bodies};
}
