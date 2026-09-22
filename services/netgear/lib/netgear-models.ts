export type PortGroup={count:number;medium:'rj45'|'sfp'|'sfp28'|'qsfp28'|'combo';speed:string;label:string};
export type NetgearModel={rows:1|2;groups:PortGroup[]};

// Port counts come from NETGEAR's official M4250 and M4350 model tables.
export const netgearModels:Record<string,NetgearModel>={
 'M4250-8G2XF':{rows:1,groups:[{count:8,medium:'rj45',speed:'1G',label:'PoE+ RJ45'},{count:2,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4250-9G1F':{rows:1,groups:[{count:9,medium:'rj45',speed:'1G',label:'RJ45'},{count:1,medium:'sfp',speed:'1G',label:'SFP'}]},
 'M4250-10G2F':{rows:1,groups:[{count:10,medium:'rj45',speed:'1G',label:'RJ45'},{count:2,medium:'sfp',speed:'1G',label:'SFP'}]},
 'M4250-10G2XF':{rows:1,groups:[{count:10,medium:'rj45',speed:'1G',label:'RJ45'},{count:2,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4250-12M2XF':{rows:1,groups:[{count:12,medium:'rj45',speed:'2.5G',label:'Multi-Gig RJ45'},{count:2,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4250-16XF':{rows:1,groups:[{count:16,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4250-26G4F':{rows:2,groups:[{count:26,medium:'rj45',speed:'1G',label:'RJ45'},{count:4,medium:'sfp',speed:'1G',label:'SFP'}]},
 'M4250-26G4XF':{rows:2,groups:[{count:26,medium:'rj45',speed:'1G',label:'RJ45'},{count:4,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4250-40G8F':{rows:2,groups:[{count:40,medium:'rj45',speed:'1G',label:'RJ45'},{count:8,medium:'sfp',speed:'1G',label:'SFP'}]},
 'M4250-40G8XF':{rows:2,groups:[{count:40,medium:'rj45',speed:'1G',label:'RJ45'},{count:8,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4300-8X8F':{rows:2,groups:[{count:8,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:8,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4300-16X':{rows:2,groups:[{count:16,medium:'rj45',speed:'10G',label:'10GBASE-T'}]},
 'M4300-12X12F':{rows:2,groups:[{count:12,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:12,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4300-24X':{rows:2,groups:[{count:24,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:4,medium:'combo',speed:'10G',label:'Shared SFP+'}]},
 'M4300-24XF':{rows:2,groups:[{count:24,medium:'sfp',speed:'10G',label:'SFP+'},{count:2,medium:'combo',speed:'10G',label:'Shared RJ45'}]},
 'M4300-24X24F':{rows:2,groups:[{count:24,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:24,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4300-48X':{rows:2,groups:[{count:48,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:4,medium:'combo',speed:'10G',label:'Shared SFP+'}]},
 'M4300-48XF':{rows:2,groups:[{count:48,medium:'sfp',speed:'10G',label:'SFP+'},{count:2,medium:'combo',speed:'10G',label:'Shared RJ45'}]},
 'M4300-28G':{rows:2,groups:[{count:24,medium:'rj45',speed:'1G',label:'RJ45'},{count:2,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:2,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4300-52G':{rows:2,groups:[{count:48,medium:'rj45',speed:'1G',label:'RJ45'},{count:2,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:2,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4300-96X':{rows:2,groups:[{count:96,medium:'combo',speed:'10G/40G',label:'Modular slots'}]},
 'M4350-8M2V':{rows:1,groups:[{count:8,medium:'rj45',speed:'2.5G',label:'Multi-Gig RJ45'},{count:2,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-8X8F':{rows:2,groups:[{count:8,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:8,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4350-12X12F':{rows:2,groups:[{count:12,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:12,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4350-16M4V':{rows:2,groups:[{count:16,medium:'rj45',speed:'2.5G',label:'Multi-Gig RJ45'},{count:4,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-16V4C':{rows:2,groups:[{count:16,medium:'sfp28',speed:'25G',label:'SFP28'},{count:4,medium:'qsfp28',speed:'100G',label:'QSFP28'}]},
 'M4350-24G4XF':{rows:2,groups:[{count:24,medium:'rj45',speed:'1G',label:'RJ45'},{count:4,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4350-48G4XF':{rows:2,groups:[{count:48,medium:'rj45',speed:'1G',label:'RJ45'},{count:4,medium:'sfp',speed:'10G',label:'SFP+'}]},
 'M4350-24F4X':{rows:2,groups:[{count:24,medium:'sfp',speed:'2.5G',label:'SFP'},{count:4,medium:'combo',speed:'10G',label:'RJ45/SFP+ combo'}]},
 'M4350-24F4V':{rows:2,groups:[{count:24,medium:'sfp',speed:'10G',label:'SFP+'},{count:4,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-24X4V':{rows:2,groups:[{count:24,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:4,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-24M4X4V':{rows:2,groups:[{count:24,medium:'rj45',speed:'2.5G',label:'Multi-Gig RJ45'},{count:4,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:4,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-44M4X4V':{rows:2,groups:[{count:44,medium:'rj45',speed:'2.5G',label:'Multi-Gig RJ45'},{count:4,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:4,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-24X8F8V':{rows:2,groups:[{count:24,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:8,medium:'sfp',speed:'10G',label:'SFP+'},{count:8,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-32F8V':{rows:2,groups:[{count:32,medium:'sfp',speed:'10G',label:'SFP+'},{count:8,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-36X4V':{rows:2,groups:[{count:36,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:4,medium:'sfp28',speed:'25G',label:'SFP28'}]},
 'M4350-40X4C':{rows:2,groups:[{count:40,medium:'rj45',speed:'10G',label:'10GBASE-T'},{count:4,medium:'qsfp28',speed:'100G',label:'QSFP28'}]},
 'M4350-40F4C':{rows:2,groups:[{count:40,medium:'sfp',speed:'10G',label:'SFP+'},{count:4,medium:'qsfp28',speed:'100G',label:'QSFP28'}]},
 'M4500-32C':{rows:2,groups:[{count:32,medium:'qsfp28',speed:'100G',label:'QSFP28'}]},
 'M4500-48XF8C':{rows:2,groups:[{count:48,medium:'sfp28',speed:'25G',label:'SFP28'},{count:8,medium:'qsfp28',speed:'100G',label:'QSFP28'}]},
};

export function modelLayout(model:string,portCount:number){
 const key=Object.keys(netgearModels).sort((a,b)=>b.length-a.length).find(candidate=>model.toUpperCase().startsWith(candidate));
 const definition=key?netgearModels[key]:undefined,rows=definition?.rows??(portCount<=16?1:2);
 return {rows,columns:rows===1?Math.max(1,portCount):Math.max(1,Math.ceil(portCount/2)),definition};
}

export function panelPorts<T extends {number:number}>(ports:T[],rows:1|2){
 const ordered=[...ports].sort((a,b)=>a.number-b.number);
 return rows===1?ordered:[...ordered.filter(port=>port.number%2===1),...ordered.filter(port=>port.number%2===0)];
}
