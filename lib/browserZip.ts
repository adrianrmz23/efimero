/** Lightweight ZIP writer (STORE, CRC32), for exporting visual batches without new dependencies. */
const enc = new TextEncoder();
function checksum(bytes:Uint8Array){let c=-1;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(c&1?0xedb88320:0);}return (c^-1)>>>0;}
function w16(out:Uint8Array,p:number,n:number){out[p]=n&255;out[p+1]=(n>>>8)&255;}
function w32(out:Uint8Array,p:number,n:number){w16(out,p,n);w16(out,p+2,n>>>16);}
export function imagesToZip(images:{name:string;dataUrl:string}[]):Blob{
  const files=images.map(({name,dataUrl})=>{const b64=dataUrl.split(",")[1]||"";const bin=atob(b64);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return {name:enc.encode(name),bytes,crc:checksum(bytes)};});
  const local:Uint8Array[]=[];const central:Uint8Array[]=[];let position=0;
  for(const f of files){const h=new Uint8Array(30+f.name.length);w32(h,0,0x04034b50);w16(h,4,20);w16(h,8,0);w32(h,14,f.crc);w32(h,18,f.bytes.length);w32(h,22,f.bytes.length);w16(h,26,f.name.length);h.set(f.name,30);local.push(h,f.bytes);
    const c=new Uint8Array(46+f.name.length);w32(c,0,0x02014b50);w16(c,4,20);w16(c,6,20);w32(c,16,f.crc);w32(c,20,f.bytes.length);w32(c,24,f.bytes.length);w16(c,28,f.name.length);w32(c,42,position);c.set(f.name,46);central.push(c);position+=h.length+f.bytes.length;
  }
  const centralSize=central.reduce((n,a)=>n+a.length,0);const end=new Uint8Array(22);w32(end,0,0x06054b50);w16(end,8,files.length);w16(end,10,files.length);w32(end,12,centralSize);w32(end,16,position);
  // TS BlobPart BufferSource generics: use fresh ArrayBuffers for browser compatibility.
  return new Blob([...local,...central,end].map(bytes=>Uint8Array.from(bytes).buffer),{type:"application/zip"});
}
