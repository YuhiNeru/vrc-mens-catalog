import femaleTargets from '../../config/female-targets.json';
const normal=(s:string)=>s.normalize('NFKC').toLowerCase();
export function variantMatches(name:string,target:string){
 const n=normal(target).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),text=normal(name);
 if(/^[a-z0-9]+$/.test(n))return new RegExp(`(^|[^a-z])${n}([^a-z]|$)`).test(text);
 return new RegExp(`(^|[\\s_／/・、,（(【\\[+＋&＆-])${n}(?:$|[\\s_／/・、,）)】\\]+＋&＆0-9-]|対応|専用|用|版)`).test(text);
}
export function classifyAudience(name:string,tags:string[],variants:{name:string}[],maleNames:string[]=[]){
 const direct=[name,...tags,...variants.map(v=>v.name)].filter(s=>!/(?:男女兼用|男女共用|男女両対応|ユニセックス)(?:では(?:ない|ありません|ございません)|じゃない)|not\s+unisex/i.test(s)).find(s=>/男女兼用|男女共用|男女両対応|ユニセックス|\bunisex\b/i.test(s));
 if(direct)return {audience:'unisex' as const,audienceEvidence:`作者の商品名・タグ・販売版に男女兼用の明示：「${direct}」`.slice(0,500)};
 const males=variants.filter(v=>maleNames.some(n=>variantMatches(v.name,n)));
 const females=variants.filter(v=>(femaleTargets as {name:string,aliases:string[]}[]).some(a=>[a.name,...a.aliases].some(n=>variantMatches(v.name,n))));
 const maleVersions=variants.some(v=>/男性用|男性版|メンズ版|\bmale\b|\bmen'?s?\b/i.test(v.name));
 const femaleVersions=variants.some(v=>/女性用|女性版|レディース版|\bfemale\b|\bwomen'?s?\b/i.test(v.name));
 if(maleVersions&&femaleVersions)return {audience:'unisex' as const,audienceEvidence:'作者が男性用・女性用の販売バリエーションを両方提供'};
 if(males.length&&females.length)return {audience:'unisex' as const,audienceEvidence:`男性・女性アバター向けの販売版を両方確認：「${males[0].name}」「${females[0].name}」`.slice(0,500)};
 const male=[name,...tags].find(s=>/メンズ|男性向け|男性用|\bfor men\b/i.test(s));
 return male?{audience:'male' as const,audienceEvidence:`作者の商品名・タグに男性向けの明示：「${male}」`.slice(0,500)}:{audience:'unknown' as const,audienceEvidence:'男女兼用の明示・対象版の組み合わせは未確認'};
}
