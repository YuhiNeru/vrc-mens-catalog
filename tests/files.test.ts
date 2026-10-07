import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {writeJson} from '../src/cli/files';

test('Windowsで読取ハンドルが閉じるまで旧JSONを保持し、原子的保存を完了する',{skip:process.platform!=='win32'},async()=>{
 const dir=await fs.mkdtemp(path.join(process.cwd(),'data','test-file-sharing-'));
 const target=path.join(dir,'state.json'),script=path.join(dir,'reader.ps1');
 await writeJson(target,{version:1});
 await fs.writeFile(script,`param([string]$FilePath)
$handle=[System.IO.File]::Open($FilePath,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::Read)
try {
 [Console]::WriteLine('locked')
 Start-Sleep -Milliseconds 500
} finally { $handle.Dispose() }
`);
 const child=spawn('powershell.exe',['-NoProfile','-File',script,'-FilePath',target],{windowsHide:true});
 try{
  await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('reader startup timeout')),10000);child.stdout.on('data',chunk=>{if(String(chunk).includes('locked')){clearTimeout(timeout);resolve();}});child.on('error',e=>{clearTimeout(timeout);reject(e);});child.on('exit',code=>{clearTimeout(timeout);if(code)reject(new Error('reader failed'));});});
  const saving=writeJson(target,{version:2});
  assert.deepEqual(JSON.parse(await fs.readFile(target,'utf8')),{version:1});
  await saving;
  assert.deepEqual(JSON.parse(await fs.readFile(target,'utf8')),{version:2});
  assert.ok(!(await fs.readdir(dir)).some(name=>name.endsWith('.tmp')));
 }finally{child.kill();}
});
