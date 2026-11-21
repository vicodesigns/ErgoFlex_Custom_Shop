// What Escape does on the film page (player.mjs) after the Director's own handlers passed it on (they stop the event when
// Escape deselects, closes the still view, a menu or a picked group; number fields put their old value back and stop it).
// 21 Nov 2026 (Windows e2e, rise): Escape in the Inspector's name field reached the player, which closed the whole
// Director (the body lost "directing", the timeline went to 0 px). In a field, Escape now only leaves the field.
//   'none'            a dialog is open (it closes itself) or a handler already used the key
//   'blur'            the focus is in a field: leave it, nothing else
//   'close-director'  the Director is open and nothing in it took the key (as before: Esc with nothing selected)
//   'close-app'       the desk app over the film is open
//   'exit'            the film itself (skip the intro)
export function isField(el){
  if(!el||el.nodeType!==1)return false;
  if(el.isContentEditable)return true;
  const tag=el.tagName;
  if(tag==='TEXTAREA'||tag==='SELECT')return true;
  return tag==='INPUT'&&!/^(button|submit|reset|image|hidden)$/i.test(el.type||'');
}
export function escapeAction({dialog=false,handled=false,inField=false,directorOpen=false,app=false}={}){
  if(dialog||handled)return 'none';
  if(inField)return 'blur';
  if(directorOpen)return 'close-director';
  return app?'close-app':'exit';
}
