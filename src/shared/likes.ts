import {z} from 'zod';
import type {Product} from './model';
const response=z.object({wishlists_counts:z.record(z.string(),z.number().int().nonnegative())});
export function parseLikes(text:string,ids:string[]){
 const counts=response.parse(JSON.parse(text)).wishlists_counts;
 return new Map(ids.map(id=>[id,counts[id]??null]));
}
export function byLikes(a:Pick<Product,'likes'|'fetchedAt'|'id'>,b:Pick<Product,'likes'|'fetchedAt'|'id'>){
 return (b.likes??-1)-(a.likes??-1)||b.fetchedAt.localeCompare(a.fetchedAt)||a.id.localeCompare(b.id);
}
