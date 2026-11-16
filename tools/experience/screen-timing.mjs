// Screen clips use chapter seconds; offset is the source frame at the clip start.
export function screenTiming(spec, seconds){
  const start=Number.isFinite(spec.start)?spec.start:0,end=Number.isFinite(spec.end)?spec.end:Infinity;
  return {visible:seconds>=start&&seconds<end,seconds:(seconds-start)*(Number(spec.rate??1))+(Number(spec.offset)||0)};
}
