'use strict';
// Platform details stay in the host, never in universal app archives.
const fs = require('node:fs');
const path = require('node:path');
const {validateManifest} = require('./app-package.cjs');
function launchSpec(installed, {resources, dataDir, port, platform=process.platform, node=process.execPath}) {
  const m = validateManifest(installed.manifest);
  if (m.runtime === 'node') return {command:node,args:[path.join(installed.root,m.entry)]};
  if (m.runtime === 'native') return {command:path.join(installed.root,m.entry),args:[]};
  const suffix = platform === 'win32' ? '.exe' : '';
  const command = path.join(resources,'drivers',m.engine,m.engine+'-server'+suffix);
  if (!fs.existsSync(command)) throw Error('Shared '+m.engine+' engine is missing. Reinstall Tech Hub '+m.minHostVersion+' or later.');
  return {command,args:m.engine==='power'?['--host','127.0.0.1','--port',String(port),'--config',path.join(dataDir,'settings.json'),'--no-browser']:[]};
}
module.exports={launchSpec};
