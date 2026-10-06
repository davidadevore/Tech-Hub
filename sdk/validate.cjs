'use strict';
const fs=require('node:fs'),path=require('node:path'),{validateManifest,safePath}=require('../hub/app-package.cjs');
function validate(directory){const root=path.resolve(directory),m=validateManifest(JSON.parse(fs.readFileSync(path.join(root,'techhub-app.json'),'utf8')));let count=0;
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,e.name),relative=path.relative(root,full).split(path.sep).join('/');if(!safePath(relative)||e.isSymbolicLink())throw Error('Unsafe path: '+relative);if(['.git','.env'].includes(e.name)||e.name.startsWith('.env.'))throw Error('Remove repository metadata and secrets: '+relative);if(e.isDirectory())walk(full);else if(!e.isFile())throw Error('Only regular files are allowed');else count++;}}
 walk(root);if(!fs.statSync(path.join(root,m.entry)).isFile())throw Error('Entry point must be a file');return {manifest:m,count,root};}
if(require.main===module){try{const r=validate(process.argv[2]);console.log('Valid: '+r.manifest.id+' '+r.manifest.version+' ('+r.count+' files)');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={validate};
