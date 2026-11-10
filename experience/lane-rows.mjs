// Timeline layers: items that cover the same seconds of one lane are stacked into sub-rows so every one stays visible,
// selectable and draggable. Greedy interval partitioning by start time: an item goes in the first row whose last item
// has ended (touching items share a row). Returns {row: Map(id -> row index), count: rows needed (at least 1)}.
export function stackRows(items,gap=1e-4){
  const row=new Map(),ends=[];
  for(const it of [...items].sort((a,b)=>a.start-b.start||b.end-a.end)){
    let r=ends.findIndex(end=>it.start>=end-gap);if(r<0)r=ends.length;
    ends[r]=it.end;row.set(it.id,r);
  }
  return {row,count:Math.max(1,ends.length)};
}
// Inline style for the lane row / its items: the CSS (director.css "layers") turns --rows / --row into heights and offsets.
export const rowsStyle=count=>count>1?` style="--rows:${count}"`:'';
export const rowVar=(layers,id)=>layers.count>1?`--row:${layers.row.get(id)||0};`:'';
