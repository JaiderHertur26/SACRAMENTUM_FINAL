export function snappyUncompress(input){
  const src=input instanceof Uint8Array?input:new Uint8Array(input);
  let p=0,shift=0,size=0;
  while(true){const b=src[p++]; size|=(b&0x7f)<<shift; if(!(b&0x80))break; shift+=7;}
  const out=new Uint8Array(size); let o=0;
  while(p<src.length && o<size){
    const tag=src[p++], type=tag&3;
    if(type===0){
      let n=tag>>2;
      if(n<60)n+=1; else {const bytes=n-59; n=0; for(let i=0;i<bytes;i++)n|=src[p++]<<(8*i); n+=1;}
      out.set(src.subarray(p,p+n),o); p+=n; o+=n;
    } else {
      let n,off;
      if(type===1){n=((tag>>2)&7)+4; off=((tag&0xe0)<<3)|src[p++];}
      else if(type===2){n=(tag>>2)+1; off=src[p]|(src[p+1]<<8); p+=2;}
      else {n=(tag>>2)+1; off=(src[p]|(src[p+1]<<8)|(src[p+2]<<16)|(src[p+3]<<24))>>>0; p+=4;}
      if(!off || off>o) throw new Error('Snappy offset inválido');
      for(let i=0;i<n;i++) out[o+i]=out[o-off+i];
      o+=n;
    }
  }
  if(o!==size) throw new Error(`Snappy incompleto ${o}/${size}`);
  return out;
}
