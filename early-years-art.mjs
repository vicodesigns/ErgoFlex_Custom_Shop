// Original, deterministic canvas illustrations. These can be used for a large
// room poster, a small picture-book page or a child's changing drawing gallery.
// The caller owns the canvas/texture; this module has no DOM or asset loading.
export function drawEarlyMotif(c,w,h,profile,{variant=0,caption=true}={}){
 const p=profile.palette,v=Math.abs(Math.trunc(variant))%3;
 const bg=p.wall,ink=p.ink,first=p.second,second=p.accent,third=p.feature;
 c.save();c.fillStyle=bg;c.fillRect(0,0,w,h);c.scale(w/1000,h/1000);
 const circle=(x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
 const ellipse=(x,y,rx,ry,angle,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();};
 const line=(points,color=ink,width=12)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
 const rect=(x,y,ww,hh,color)=>{c.fillStyle=color;c.fillRect(x,y,ww,hh);};
 const poly=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
 const leaf=(x,y,rx,ry,angle,color)=>{ellipse(x,y,rx,ry,angle,color);line([[x-Math.cos(angle)*rx*.7,y-Math.sin(angle)*rx*.7],[x+Math.cos(angle)*rx*.7,y+Math.sin(angle)*rx*.7]],bg,3);};
 const fruit=(x,y,size,color,kind=0)=>{
  if(kind===1){ellipse(x,y,size*.72,size*1.18,-.15,color);ellipse(x-size*.23,y+size*.5,size*.7,size*.65,.1,color);}
  else{circle(x-size*.24,y,size*.72,color);circle(x+size*.25,y,size*.72,color);ellipse(x,y+size*.27,size*.91,size*.67,0,color);}
  line([[x,y-size*.65],[x+size*.11,y-size*1.02]],ink,7);leaf(x+size*.36,y-size*.91,size*.28,size*.12,-.4,first);
 };
 const character=(x,y,size,color,animal=false)=>{
  if(animal){
   ellipse(x,y+size*.6,size*.73,size*.9,0,color);circle(x,y,size*.66,color);
   if(v===1){ellipse(x-size*.39,y-size*.74,size*.15,size*.56,-.15,color);ellipse(x+size*.39,y-size*.74,size*.15,size*.56,.15,color);}
   else if(v===2){poly([[x-size*.64,y-size*.21],[x-size*.5,y-size*.93],[x-size*.13,y-size*.59]],color);poly([[x+size*.64,y-size*.21],[x+size*.5,y-size*.93],[x+size*.13,y-size*.59]],color);}
   else{circle(x-size*.49,y-size*.49,size*.26,color);circle(x+size*.49,y-size*.49,size*.26,color);}
   ellipse(x,y+size*.21,size*.32,size*.23,0,bg);circle(x,y+size*.14,size*.08,ink);
  }else{
   circle(x,y-size*.57,size*.32,third);poly([[x-size*.32,y-size*.15],[x+size*.32,y-size*.15],[x+size*.48,y+size*.7],[x-size*.48,y+size*.7]],color);
   line([[x-size*.22,y+size*.66],[x-size*.25,y+size*.98]],ink,10);line([[x+size*.22,y+size*.66],[x+size*.25,y+size*.98]],ink,10);
  }
  for(const d of [-1,1])circle(x+d*size*.22,y+(animal?-.03:-.6)*size,size*.035,ink);
 };
 // The illustration field is deliberately spacious: the same strong graphic
 // must survive a wide room camera and a small pinboard thumbnail.
 c.save();c.translate(0,caption?110:0);c.scale(1,caption?.81:1);
 switch(profile.motif){
  case 'nature':{
   circle(735-v*35,230,110,third);line([[340,820],[370,480],[520,185]],ink,17);
   for(let i=0;i<5;i++){
    const y=300+i*100,x=460-i*25,side=i%2?1:-1;
    leaf(x+side*85,y,110,48,side*.62,i%2?first:third);
   }
   character(690,665,115,second,true);
   for(let i=0;i<3;i++)ellipse(170+i*85,860+(i%2)*15,35+i*8,17,-.2,first);
   break;
  }
  case 'pretend':{
   rect(175,390,650,380,third);rect(205,445,590,270,bg);
   line([[205,760],[205,210],[795,210],[795,760]],ink,18);
   for(let i=0;i<6;i++)rect(180+i*107,220,107,140,i%2?bg:second);
   for(let i=0;i<6;i++)ellipse(233+i*107,355,53,28,0,i%2?bg:second);
   rect(160,725,680,48,first);rect(260,785,480,55,first);
   fruit(335,580,65,second,v===1?1:0);fruit(505,570,72,third,v===2?1:0);fruit(675,585,62,first,1);
   if(v===1){rect(530,420,195,90,first);c.fillStyle=bg;c.font='bold 40px sans-serif';c.textAlign='center';c.fillText('TODAY',628,480);}
   else{line([[285,420],[365,420]],ink,9);line([[635,420],[715,420]],ink,9);}
   break;
  }
  case 'building':{
   circle(745,240,95,third);
   const roadY=560+(v-1)*25;
   rect(140,roadY,720,105,first);rect(180,roadY+70,140,200,first);rect(680,roadY+70,140,200,first);
   // A clear open span between chunky bridge supports.
   c.fillStyle=bg;c.beginPath();c.moveTo(340,roadY+200);c.lineTo(340,roadY+125);c.quadraticCurveTo(500,roadY-45,660,roadY+125);c.lineTo(660,roadY+200);c.closePath();c.fill();
   line([[155,roadY-40],[845,roadY-40]],ink,12);
   for(const x of [180,340,500,660,820])line([[x,roadY-40],[x,roadY]],ink,9);
   const truckX=260+v*175;
   rect(truckX-80,roadY-130,130,75,second);rect(truckX+50,roadY-165,80,110,third);rect(truckX+65,roadY-150,45,40,bg);
   for(const x of [truckX-40,truckX+87]){circle(x,roadY-48,30,ink);circle(x,roadY-48,14,bg);}
   for(let i=0;i<3;i++)rect(160+i*105,820-(i%2)*60,80,80,[second,third,first][i]);
   line([[140,925],[860,925]],ink,7);
   break;
  }
  case 'stories':{
   // Open pages form a recognizable silhouette rather than a page of text.
   poly([[110,485],[450,450],[500,490],[550,450],[890,485],[890,875],[555,845],[500,880],[445,845],[110,875]],ink);
   poly([[130,500],[445,470],[485,505],[485,850],[440,825],[130,850]],bg);
   poly([[515,505],[555,470],[870,500],[870,850],[560,825],[515,850]],third);
   line([[500,510],[500,860]],bg,7);
   character(285,645,82,first);character(690,650,83,second);
   if(v===1){character(380,665,60,second);}
   else if(v===2){character(595,675,60,first);}
   poly([[305,360],[500,180],[695,360]],second);rect(365,360,270,100,second);rect(470,390,60,70,bg);
   for(const [x,y,r] of [[190,270,23],[795,300,18],[730,165,15]])circle(x,y,r,first);
   break;
  }
  case 'music':
  default:{
   line([[200,420],[800,420]],ink,16);
   for(let i=0;i<7;i++){
    const x=215+i*82,hh=250-i*17;
    rect(x-25,420-hh*.5,50,hh,[first,third,second][(i+v)%3]);circle(x,420-hh*.5+18,4,ink);circle(x,420+hh*.5-18,4,ink);
   }
   line([[225,745],[410,630]],ink,13);circle(225,745,24,second);line([[540,700],[755,790]],ink,13);circle(755,790,24,first);
   leaf(270,210,95,43,-.45,first);leaf(720,230,95,43,.5,third);
   for(let i=0;i<5;i++){
    const x=200+i*150,y=865+Math.sin((i+v)*1.5)*20;
    if((i+v)%2)circle(x,y,22,second);else rect(x-19,y-19,38,38,first);
   }
   break;
  }
 }
 c.restore();
 if(caption){
  c.fillStyle=ink;c.textAlign='center';c.font='bold 45px sans-serif';c.fillText(p.title||profile.title,500,86,870);
  c.font='24px sans-serif';c.fillText(p.sub||profile.interest,500,958,850);
 }
 c.restore();
}

// Genuinely child-made marks for the low drawing line: wobbly crayon, big
// heads, floating suns, letters that wander. Draws into any w x h rectangle.
export function drawChildCrayon(c,w,h,p,index=0){
 const v=Math.abs(Math.trunc(index))%8,S=Math.min(w/280,h/340);
 let seed=(v+1)*9301;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 c.save();c.fillStyle=['#fffaf0','#f7f1e4','#fdf6ea','#f4efe6','#fff8ee','#f6f3ff','#eef6f0','#fff4e8'][v];c.fillRect(0,0,w,h);c.scale(S,S);c.lineCap='round';c.lineJoin='round';
 const crayon=(pts,col,width=7)=>{for(let k=0;k<3;k++){c.globalAlpha=.42;c.strokeStyle=col;c.lineWidth=width-k*1.5;c.beginPath();pts.forEach(([x,y],i)=>{const jx=(rnd()-.5)*3,jy=(rnd()-.5)*3;i?c.lineTo(x+jx,y+jy):c.moveTo(x+jx,y+jy);});c.stroke();}c.globalAlpha=1;};
 const scrub=(x,y,rw,rh,col)=>{c.globalAlpha=.32;c.strokeStyle=col;c.lineWidth=5;c.beginPath();for(let i=0;i<14;i++){c.moveTo(x+rnd()*rw,y+rnd()*rh);c.lineTo(x+rnd()*rw,y+rnd()*rh);}c.stroke();c.globalAlpha=1;};
 const loop=(x,y,r,col,width=6)=>crayon(Array.from({length:22},(_,i)=>[x+Math.cos(i/3.3)*r*(1+.08*Math.sin(i)),y+Math.sin(i/3.3)*r]),col,width);
 const person=(x,y,s,col)=>{loop(x,y-s*1.3,s*.45,col);crayon([[x,y-s*.85],[x,y+s*.4]],col);crayon([[x-s*.7,y-s*.5],[x+s*.7,y-s*.6]],col);crayon([[x,y+s*.4],[x-s*.4,y+s*1.1]],col);crayon([[x,y+s*.4],[x+s*.45,y+s*1.1]],col);c.fillStyle='#333';c.fillRect(x-s*.18,y-s*1.4,4,4);c.fillRect(x+s*.12,y-s*1.4,4,4);crayon([[x-s*.2,y-s*1.12],[x,y-s*1.02],[x+s*.2,y-s*1.12]],'#c0392b',3);};
 const sun=(x,y)=>{loop(x,y,26,'#f2b33a',8);for(let i=0;i<9;i++){const a=i*.7;crayon([[x+Math.cos(a)*36,y+Math.sin(a)*36],[x+Math.cos(a)*54,y+Math.sin(a)*54]],'#f2b33a',5);}};
 const letters=(s,x,y,col,size=28)=>{c.fillStyle=col;c.font=`bold ${size}px sans-serif`;[...s].forEach((ch,i)=>{c.save();c.translate(x+i*size*.8,y+(rnd()-.5)*10);c.rotate((rnd()-.5)*.5);if(ch==='R'&&i===0)c.scale(-1,1);c.fillText(ch,0,0);c.restore();});};
 if(v===0){sun(220,60);person(80,215,52,p.accent);person(160,235,36,p.second);person(225,250,24,'#8e5bb5');crayon([[10,318],[270,312]],'#5c9e4c',9);letters('MY FAMLY',22,40,p.ink,24);}
 else if(v===1){crayon([[50,300],[50,170],[230,170],[230,300]],p.second,8);crayon([[30,175],[140,80],[250,175]],p.accent,9);scrub(36,90,210,80,p.accent);crayon([[120,300],[120,230],[165,230],[165,300]],'#7a5534',7);loop(85,215,14,'#3f8fd0',5);loop(200,215,14,'#3f8fd0',5);crayon([[200,80],[200,40],[230,40],[230,95]],'#555',7);for(let i=0;i<5;i++)loop(225+i*8,28-i*6,6+i*2,'#9aa',3);letters('HOME',70,330,p.ink,22);}
 else if(v===2){for(let i=0;i<6;i++)crayon(Array.from({length:30},(_,k)=>[10+k*9,90+i*36+Math.sin(k*.6+i)*16]),[p.accent,'#f2b33a','#5c9e4c',p.second,'#8e5bb5','#e05a8a'][i],10);letters('RAINBOW',20,50,p.ink,26);}
 else if(v===3){c.globalAlpha=.75;for(const [x,y,col] of [[70,110,p.accent],[180,95,p.second],[120,210,'#f2b33a'],[215,230,'#5c9e4c']]){c.fillStyle=col;c.beginPath();c.ellipse(x,y,34,40,rnd(),0,7);c.fill();for(let f=0;f<5;f++){c.beginPath();c.ellipse(x+Math.cos(-2.4+f*.55)*48,y+Math.sin(-2.4+f*.55)*52,9,18,-2.4+f*.55+1.57,0,7);c.fill();}}c.globalAlpha=1;letters('HANDS',60,320,p.ink,26);}
 else if(v===5){sun(140,130);crayon([[40,300],[240,300]],'#5c9e4c',10);person(140,290,40,p.accent);letters('ME',100,40,p.ink,30);}
 else if(v===6){crayon([[40,250],[60,200],[110,190],[140,150],[210,150],[235,200],[250,250],[40,250]],'#d0453a',9);scrub(70,170,160,70,'#d0453a');loop(85,262,22,'#333',8);loop(205,262,22,'#333',8);crayon([[150,160],[150,195],[200,195]],'#3f8fd0',5);crayon([[20,300],[270,300]],'#777',4);letters('VROOM',40,60,p.ink,26);}
 else if(v===7){for(let k=0;k<5;k++)crayon(Array.from({length:40},(_,i)=>[140+Math.cos(i*.5+k)*(20+i*2.4),160+Math.sin(i*.5+k)*(14+i*1.8)]),[p.accent,p.second,'#8e5bb5','#f2b33a','#3f8fd0'][k],5);letters('MAMA',60,320,p.ink,30);}
 else{loop(140,170,70,'#555',7);scrub(80,110,120,120,'#888');for(const [x,y] of [[115,155],[165,155]])loop(x,y,9,'#222',5);crayon([[110,205],[140,222],[172,205]],'#c0392b',5);for(const s of [-1,1])crayon([[140+s*60,110],[140+s*85,60],[140+s*40,95]],'#555',6);crayon([[70,190],[20,175]],'#555',3);crayon([[210,190],[262,178]],'#555',3);letters('PEPR',70,320,p.ink,30);}
 c.restore();
}
