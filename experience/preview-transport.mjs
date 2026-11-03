// Preserve overshoot on a loop so slow frames don't accumulate timing drift.
export function loopPreviewTime(elapsed,start,end){
  const span=end-start;
  if(!Number.isFinite(span)||span<=0)throw Error('Preview end must follow its start.');
  return start+((elapsed-start)%span+span)%span;
}
export function resumePreviewTime(elapsed,start,end){
  return elapsed>=start&&elapsed<end-.00001?elapsed:start;
}
