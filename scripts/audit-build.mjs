import {readFileSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
const root=resolve('dist');const sw=readFileSync(resolve(root,'sw.js'),'utf8');
const match=sw.match(/FILES=(\[[^\n]*?\]);/);if(!match)throw Error('Service Worker precache list is missing.');
for(const file of JSON.parse(match[1])){if(file==='./')continue;const target=resolve(root,file);if(!target.startsWith(root+sep)||!existsSync(target))throw Error(`Offline asset is missing: ${file}`);}
const manifest=JSON.parse(readFileSync(resolve(root,'manifest.webmanifest'),'utf8'));
if(manifest.start_url!=='./'||manifest.scope!=='./')throw Error('PWA subpath scope is invalid.');
for(const icon of manifest.icons)if(!existsSync(resolve(root,icon.src)))throw Error('PWA icon is missing.');
for(const [file,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]){const data=readFileSync(resolve(root,file));if(data.readUInt32BE(16)!==size||data.readUInt32BE(20)!==size)throw Error(`Invalid icon dimensions: ${file}`);}
console.log('Build audit passed: all offline assets and PWA/iPhone icons exist. This is not a browser offline test.');
