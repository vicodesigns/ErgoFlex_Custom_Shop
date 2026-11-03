export const SHOTS = [
  {id:'awaken',seconds:8,room:'product',title:'Meet your digital twin.',detail:'Precision in every direction.',kind:'glide'},
  {id:'rise',seconds:11,room:'home',layout:'house',mode:'morning',title:'Your height. Your rhythm.',detail:'Sit. Stand. Find your flow.',kind:'lift'},
  {id:'create',seconds:9,room:'creative',layout:'premium',title:'From focus to creation.',detail:'Tilt into drafting. Rise into an easel. Supplies find their shelf.',kind:'tilt'},
  {id:'commons',seconds:5,room:'library',layout:'humboldt',title:'A place for everyone.',detail:'Join the conversation at Humboldt-inspired Commons.',kind:'group'},
  {id:'coast',seconds:3,room:'occmedialab',layout:'house',title:'Ideas become stories.',detail:'Orange Coast College-inspired media lab.',kind:'room'},
  {id:'oilers',seconds:3,room:'highschool',layout:'house',title:'Make room for discovery.',detail:'Huntington Beach High School-inspired classroom.',kind:'room'},
  {id:'wellness',seconds:10,room:'gym',layout:'house',title:'Make movement part of your day.',detail:'A little pause. A fresh perspective.',kind:'wellness'},
  {id:'awareness',seconds:12,room:'product',title:'Move with awareness.',detail:'Virtual proximity sweep · simulated obstacles.',kind:'proximity'},
  {id:'music',seconds:7,room:'gaming',layout:'house',title:'Feel the room come alive.',detail:'Music-reactive light. A space that plays along.',kind:'music'},
  {id:'media',seconds:7,room:'home',layout:'house',title:'Music. Media. In sync.',detail:'Curved cinema with picture-driven colour.',kind:'media'},
  {id:'storage',seconds:6,room:'library',layout:'humboldt',title:'Make room for what’s next.',detail:'65° storage · a new use for the same space.',kind:'storage'},
  {id:'hero',seconds:4,room:'product',title:'Your space. Reimagined.',detail:'One desk. A day of possibilities.',kind:'hero'}
];
export function score(cut = 'full') {
  const short = {awaken:3,rise:3,create:3,commons:3,awareness:4,music:4,media:4,storage:3,hero:3};
  return SHOTS.filter(s => cut !== 'social' || short[s.id]).map(s => ({...s,seconds:cut === 'social' ? short[s.id] : s.seconds}));
}
export const ease = t => { t = Math.max(0,Math.min(1,t)); return t*t*(3-2*t); };
export function safeReturn(value, base) {
  try { const url = new URL(value || '../',base); if(url.origin === new URL(base).origin && !url.pathname.includes('/experience/')) return url.pathname + url.search + url.hash; } catch {}
  return '/?view=product';
}
