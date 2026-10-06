'use strict';
const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto'),Zip=require('adm-zip');
function packageSDK(output){const root=path.resolve(__dirname,'..'),sdk=new Zip(),version=require('../sdk/version.json').version;
 sdk.addLocalFolder(path.join(root,'sdk'),'sdk');
 for(const name of ['app-package.cjs','runtime-api.cjs'])sdk.addLocalFile(path.join(root,'hub',name),'hub');
 sdk.addFile('package.json',Buffer.from(JSON.stringify({name:'tech-hub-sdk',version,private:true,engines:{node:'>=24'},dependencies:{'adm-zip':'0.6.1'}},null,2)));
 sdk.addFile('README.txt',Buffer.from('Tech Hub SDK '+version+'\nInstall Node.js 24, run npm install in this folder, then read sdk/AI-START.md and sdk/README.md.\nStart: node sdk/dev.cjs init ../my-meter my-meter "My Meter"\nChecks do not execute module code. Serve runs trusted module code with temporary data; it is not a network sandbox.\nFull host integration runner (sdk/run.cjs) requires the Tech Hub repository.\n'));
 const dest=path.resolve(output);fs.mkdirSync(path.dirname(dest),{recursive:true});sdk.writeZip(dest);fs.writeFileSync(dest+'.sha256',crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')+'  '+path.basename(dest)+'\n');return dest;
}
if(require.main===module)console.log(packageSDK(process.argv[2]||'dist/Tech-Hub-SDK.zip'));
module.exports={packageSDK};
