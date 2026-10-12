import {build} from 'esbuild';
import fs from 'node:fs/promises';
await fs.mkdir('data/vps-build',{recursive:true});
await build({entryPoints:['deploy/vps/parser.ts'],bundle:true,platform:'node',format:'esm',target:'node24',outfile:'data/vps-build/parser.mjs'});
for(const name of ['worker.py','manage.py','test_worker.py','vrc-mens-collector.service','vrc-mens-collector-backup.service','vrc-mens-collector-backup.timer','install.sh'])await fs.copyFile('deploy/vps/'+name,'data/vps-build/'+name);
console.log('VPS application bundle built');
