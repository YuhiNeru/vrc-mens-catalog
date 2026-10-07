import floorAvatars from '../../config/floor-avatar-scope.json';
import type {Catalog} from './model';

export const NO_CONFIRMED_FLOOR_TAG='no-confirmed-floor-98';
const floorIds=new Set(floorAvatars.map(a=>a.id));

// 98体への「確認済み対応が未登録」を表す。モデルの性別や非対応は推測しない。
export function refreshFloorTags(data:Catalog){
 const avatars=data.avatars.filter(a=>floorIds.has(a.id)&&a.review==='verified');
 const ids=new Set(avatars.map(a=>a.id));
 const bodies=new Set(avatars.filter(a=>a.bodyId&&a.bodyEvidence.trim()).map(a=>a.bodyId));
 const supported=new Set(data.compatibility.filter(r=>r.review==='verified'&&r.fit!=='unknown'&&(r.targetType==='avatar'?ids.has(r.targetId):bodies.has(r.targetId))).map(r=>r.productId));
 for(const p of data.products){
  const tags=(p.catalogTags??[]).filter(t=>t!==NO_CONFIRMED_FLOOR_TAG);
  if(p.kind==='clothing'&&p.audience==='unisex'&&!supported.has(p.id))tags.push(NO_CONFIRMED_FLOOR_TAG);
  p.catalogTags=[...new Set(tags)];
 }
 return data;
}
