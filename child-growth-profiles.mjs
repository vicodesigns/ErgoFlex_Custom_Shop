// Age is an independent scene choice, not a physical fit prescription. Desk
// widths are editable starting recipes and retain the real motion limits.
import {earlyYearsProfile} from './early-years-profiles.mjs';
export const CHILD_AGE_STAGES={
 early:{id:'early',label:'Early years · toddler / preschool',short:'Early years',deskSize:'48x30',accessories:[],style:{woodFinish:'Pearl White',baseFinish:'White',trimColor:'#f5f5f2',sheen:'satin'},labels:['Wake & discover','Make & play','Story time','Sleepy stars','Family play'],stories:['Building and sorting invitation','Low drawing tray and colours','An open picture book in the nook','Toys returned and a clear play mat','A railway village and shared stories']},
 primary:{id:'primary',label:'Elementary school',short:'Elementary',deskSize:'48x30',accessories:[],style:{woodFinish:'Pearl White',baseFinish:'White',trimColor:'#286344',sheen:'satin'},labels:['School-day start','Homework & craft','Chapter time','Packed for tomorrow','Build with friends'],stories:['Schoolbag and a fresh reading choice','Workbook and a hands-on project','A chapter in the reading corner','Bag packed and materials organized','Shared craft and a tabletop game']},
 preteen:{id:'preteen',label:'Preteen · middle school',short:'Preteen',deskSize:'48x30',accessories:['dell-u2724d','ergo-keyboard','magic-mouse','monitor-arm','cable-tray'],style:{woodFinish:'Pearl White',baseFinish:'Space Gray',trimColor:'#85888c',sheen:'satin'},labels:['Plan & practice','Projects & study','Read & listen','Charge & wind down','Creative hangout'],stories:['A planner and a hobby in progress','Study notes and a making project','Books and a quiet listening corner','Supplies stored and screens at rest','A shared build and creative conversation']},
 teen:{id:'teen',label:'High school',short:'High school',deskSize:'60x30',accessories:['dell-u2724d','ergo-keyboard','logitech-mx-master','monitor-arm','keyboard-tray','cable-tray'],style:{woodFinish:'Pearl White',baseFinish:'Space Gray',trimColor:'#1c1c1e',sheen:'satin'},labels:['Morning preparation','Focused study','Portfolio & music','Quiet room','Study group'],stories:['An organized school day and a standing-desk demonstration','Revision notes and focused project work','A portfolio and personal listening corner','Materials filed and the room put away','A shared planning session and reference books']},
 college:{id:'college',label:'College · young adult',short:'College',deskSize:'60x30',accessories:['wide-monitor','ergo-keyboard','logitech-mx-master','monitor-arm','keyboard-tray','cable-tray'],style:{woodFinish:'Pearl White',baseFinish:'Black',trimColor:'#1c1c1e',sheen:'satin'},labels:['Day plan','Coursework','Reading & editing','Desk reset','Shared project'],stories:['A day plan and a standing-desk demonstration','Course books and research notes','Reading and creative editing','Study materials organized for tomorrow','A collaborative project and conversation']}
};
export const childAgeStage=id=>CHILD_AGE_STAGES[id]||CHILD_AGE_STAGES.early;
export function childModesForStage(age,base,layout){
 const stage=childAgeStage(age),adult=['teen','college'].includes(stage.id),keys=['morning','afternoon','evening','night','party'],early=earlyYearsProfile(layout);
 return Object.fromEntries(keys.map((key,i)=>[key,{...base[key],label:early&&key==='party'?(early.partyParticipants>1?'Play with friends':'Play together'):stage.labels[i],description:early?.activities[key]||stage.stories[i],height:adult&&key==='morning'?43.5:28,tilt:stage.id==='early'?(key==='afternoon'?8:0):key==='evening'?10:0,
  ...(stage.id!=='early'&&key==='party'?{power:stage.id==='primary'?.95:.5,ambient:.34,sky:['#8298b0','#d6c9b8'],fill:'#c7d2df'}:{})}]));
}

// Upgrade the authored child-room desk once. Owner-moved poses and later finish
// choices retain their edits; dormant width variants upgrade when first opened.
export function upgradeChildDesk(state,layout){
 if(state.childDecorRevision===2)return false;
 const stage=childAgeStage(layout.ageStage);
 state.style={...stage.style,...state.style,woodFinish:'Pearl White'};
 const oldX=layout.width/2-(stage.deskSize==='60x30'?1050:900),oldZ=layout.back+920;
 const upgradePose=pose=>{if(pose&&Math.abs(pose.x-oldX)<1&&Math.abs(pose.z-oldZ)<1&&Math.abs(pose.yaw)<.0001){pose.x=layout.desk[0];pose.z=layout.desk[1];}};
 upgradePose(state.pose);for(const setting of Object.values(state.phases||{}))upgradePose(setting.pose);
 state.childDecorRevision=2;return true;
}
