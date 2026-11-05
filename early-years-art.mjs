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
