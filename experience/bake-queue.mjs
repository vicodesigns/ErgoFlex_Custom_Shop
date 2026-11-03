export async function bakeCutQueue(shots,{cached,render,progress=()=>{},cancelled=()=>false}){
  let completed=0,reused=0;
  for(let i=0;i<shots.length;i++){
    if(cancelled())return {completed,reused,cancelled:true};
    progress({index:i,total:shots.length,completed,reused});
    if(await cached(shots[i],i))reused++;
    else {
      if(cancelled())return {completed,reused,cancelled:true};
      await render(shots[i],i);
    }
    if(cancelled())return {completed,reused,cancelled:true};
    completed++;
  }
  return {completed,reused,cancelled:false};
}
