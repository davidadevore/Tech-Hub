'use strict';
const fs=require('node:fs'),path=require('node:path'),Zip=require('adm-zip'),{validate}=require('./validate.cjs');
function pack(directory,output){const {root,manifest}=validate(directory),dest=path.resolve(output);if(dest===root||dest.startsWith(root+path.sep))throw Error('Write the package outside the app directory');const zip=new Zip();zip.addLocalFolder(root);fs.mkdirSync(path.dirname(dest),{recursive:true});zip.writeZip(dest);return manifest;}
if(require.main===module){try{const m=pack(process.argv[2],process.argv[3]);console.log('Packaged '+m.id+' '+m.version);}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={pack};
