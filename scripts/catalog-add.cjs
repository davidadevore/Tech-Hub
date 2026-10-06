'use strict';
// Offline maintainer tool: validates bytes; never executes submitted code or uploads assets.
const fs=require('node:fs'),crypto=require('node:crypto');
const {validateCatalog}=require('../hub/app-library.cjs');
const {inspectPackage,compare}=require('../hub/app-package.cjs');
function addModule(catalog,entry,bytes){
 validateCatalog(catalog);validateCatalog({schemaVersion:1,apps:[entry]});
 if(Object.keys(entry.packages).join(',')!=='universal')throw Error('Submissions require one universal package');
 const pkg=entry.packages.universal;
 if(pkg.size!==bytes.length||pkg.sha256!==crypto.createHash('sha256').update(bytes).digest('hex'))throw Error('Package checksum or size mismatch');
 for(const platform of ['darwin-arm64','win32-x64']){
  const m=inspectPackage(bytes,{hostVersion:entry.minHostVersion,platform});
  for(const key of ['id','name','description','version','minHostVersion'])if(m[key]!==entry[key])throw Error('Manifest mismatch: '+key);
  if(m.runtime!=='node')throw Error('Submitted modules must use the shared Node runtime');
  if(JSON.stringify([...m.permissions].sort())!==JSON.stringify([...entry.permissions].sort()))throw Error('Permission mismatch');
 }
 const existing=catalog.apps.find(a=>a.id===entry.id);
 if(existing&&compare(entry.version,existing.version)<=0)throw Error('A module update requires a new, higher version');
 const next={...catalog,apps:[...catalog.apps.filter(a=>a.id!==entry.id),entry]};return validateCatalog(next);
}
if(require.main===module){try{
 const [catalog,entry,zip,output]=process.argv.slice(2);if(!output)throw Error('Usage: node scripts/catalog-add.cjs current-catalog.json reviewed-entry.json module.zip output-catalog.json');
 const result=addModule(JSON.parse(fs.readFileSync(catalog)),JSON.parse(fs.readFileSync(entry)),fs.readFileSync(zip));
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log('Prepared '+result.apps.length+' catalog entries. Review before publishing.');
}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={addModule};
