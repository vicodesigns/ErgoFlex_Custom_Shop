// Store-only ZIP: video is already compressed. Keeps original chapter files and
// a readable manifest so desktop tools can assemble a portable movie.
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function header(length,fields){const bytes=new Uint8Array(length),v=new DataView(bytes.buffer);for(const [offset,size,value]of fields)size===2?v.setUint16(offset,value,true):v.setUint32(offset,value,true);return bytes;}
export async function bakeArchive(cut,records){
  if(records.length!==cut.shots.length||records.some(r=>!r?.blob))throw Error('Bake every chapter before exporting the intro.');
  const files=records.map((r,i)=>({name:String(i+1).padStart(2,'0')+'.webm',blob:r.blob}));
  files.push({name:'cut.json',blob:new Blob([JSON.stringify(cut,null,2)])});
  const parts=[],directory=[];let offset=0;
  for(const file of files){
    const name=new TextEncoder().encode(file.name),data=new Uint8Array(await file.blob.arrayBuffer()),checksum=crc(data),length=data.length;
    if(offset+length>0xffffffff)throw Error('This archive exceeds the 4 GB export limit.');
    const local=header(30,[[0,4,0x04034b50],[4,2,20],[14,4,checksum],[18,4,length],[22,4,length],[26,2,name.length]]);
    const central=header(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[16,4,checksum],[20,4,length],[24,4,length],[28,2,name.length],[42,4,offset]]);
    parts.push(local,name,file.blob);directory.push(central,name);offset+=30+name.length+length;
  }
  const size=directory.reduce((n,p)=>n+p.length,0),end=header(22,[[0,4,0x06054b50],[8,2,files.length],[10,2,files.length],[12,4,size],[16,4,offset]]);
  return new Blob([...parts,...directory,end],{type:'application/zip'});
}
