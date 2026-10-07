import fs from 'node:fs/promises';
import {PoliteFetcher,robotsAllows} from '../src/shared/fetcher';
import {searchPage} from '../src/shared/parser';
const f=new PoliteFetcher({intervalMs:3000,maxRequests:4,retries:0,timeoutMs:20000});
const robots=await f.get('https://booth.pm/robots.txt');
for(const query of ['', 'VRChat', 'VRC']){const u=new URL('https://booth.pm/ja/browse/'+encodeURIComponent('3D装飾品'));if(query)u.searchParams.set('q',query);u.searchParams.set('sort','new');if(!robotsAllows(robots,u.pathname))throw new Error('robots disallow');const html=await f.get(u.href);await fs.writeFile(`data/raw/full-accessory-probe-${query||'all'}.html`,html);const p=searchPage(html,u.href);console.log(JSON.stringify({query,url:u.href,total:p.totalReported,count:p.urls.length,next:p.next}));}
