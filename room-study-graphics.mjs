// Original, fictional work-in-progress graphics for the existing notebooks.
// No personal records or external image requests; all content is scene decor.
export const STUDY_TOPICS = {
    home: ['Weekly rhythm', 'Morning focus', 'Small errands', 'Reading break', 'Tomorrow'],
    bedroom: ['Slow morning', 'Reading list', 'Window light', 'Evening ritual', 'Rest'],
    lounge: ['Weekend plans', 'Choose a film', 'Games evening', 'Music to share', 'Next time'],
    office: ['Design review', 'Requirements', 'Sketch options', 'Review feedback', 'Next revision'],
    coworking: ['Shared project', 'Ideas to try', 'Pair session', 'Team feedback', 'Follow up'],
    government: ['Public workshop', 'Room setup', 'Discussion topics', 'Shared notes', 'Follow up'],
    college: ['Seminar outline', 'Opening question', 'Compare sources', 'Small groups', 'Reflection'],
    library: ['North Coast study', 'Find a source', 'Trace connections', 'Compare evidence', 'Bibliography'],
    study: ['Reading a landscape', 'First observation', 'Pattern study', 'Mark references', 'Open questions'],
    university: ['Fieldwork journal', 'Survey notes', 'Compare findings', 'Discuss a pattern', 'Next study'],
    music: ['Session outline', 'Warm-up phrase', 'Take notes', 'Listening pass', 'Next rehearsal'],
    creative: ['Material studies', 'Mix a colour', 'Test a surface', 'Compare edges', 'Next canvas'],
    gallery: ['Exhibition study', 'Material notes', 'Sight lines', 'Light and shadow', 'Curator notes'],
    gaming: ['Team practice', 'Opening route', 'Timing windows', 'Review a replay', 'Next match'],
    kitchen: ['Seasonal supper', 'Gather ingredients', 'Preparation notes', 'Taste and adjust', 'Share at the table'],
    gym: ['Session journal', 'Warm-up notes', 'Practice block', 'Recovery notes', 'Next session'],
    workshop: ['Bracket prototype', 'Mark the stock', 'Check dimensions', 'Dry-fit notes', 'Next iteration'],
    scifi: ['Survey trajectory', 'Waypoint review', 'Instrument check', 'Observation log', 'Crew briefing'],
    mobileit: ['Bench build', 'Inventory parts', 'Connect modules', 'Record checks', 'Pack the kit'],
    middleschool: ['Circuit study', 'Sketch a path', 'Build a model', 'Compare ideas', 'Class discussion'],
    highschool: ['Wave study', 'Sketch a waveform', 'Compare periods', 'Record observations', 'Explain a pattern'],
    laboratory: ['Sample study', 'Setup sketch', 'Trial observations', 'Compare traces', 'Review notes'],
    occmedialab: ['Short film study', 'Wide establishing', 'Medium action', 'Insert detail', 'Review the sequence'],
    hospital: ['Workspace handover', 'Desk supplies', 'Room readiness', 'Shared equipment', 'Handover notes'],
    police: ['Team workspace', 'Briefing materials', 'Shared equipment', 'Review notes', 'Next shift'],
    security: ['Operations journal', 'Desk readiness', 'Briefing notes', 'Equipment log', 'Handover'],
    kindergarten: ['Colour discoveries', 'Pick a colour', 'Draw a shape', 'Tell a story', 'Share with friends'],
    elementary: ['Pattern journal', 'Notice a shape', 'Try a pattern', 'Compare colours', 'Show your idea']
};

export function drawStudyCover(c, id, phase) {
    const topics = STUDY_TOPICS[id]; if (!topics) return;
    c.save(); c.translate(248, 338); c.rotate(-.055);
    c.fillStyle = '#18232228'; c.fillRect(3, 4, 88, 80);
    c.fillStyle = ['#d7c49a','#bccbb7','#c4cfcc','#d7c49a','#d9bca0'][phase]; c.fillRect(0, 0, 88, 80);
    c.fillStyle = '#506058'; c.font = '11px Georgia, serif'; c.textAlign = 'left';
    const words = topics[1 + phase % 4].split(' ');
    words.slice(0, 3).forEach((word, i) => c.fillText(word, 8, 20 + i * 15, 72));
    c.strokeStyle = '#6d7d68'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(9, 66); c.lineTo(60, 66); c.stroke();
    c.fillStyle = '#fff6d15c'; c.fillRect(23, -3, 39, 10); c.restore();
}

export function drawStudyGraphics(c, id, phase, accent) {
    const topics = STUDY_TOPICS[id]; if (!topics) return;
    // Legible, contextual work notes replace anonymous placeholder bars.
    c.save(); c.fillStyle = '#eee8d8'; c.fillRect(420, 120, 310, 310);
    c.fillStyle = accent; c.font = '600 15px sans-serif'; c.fillText(topics[0].toUpperCase(), 425, 145, 290);
    for (let n = 1; n < topics.length; n++) {
        const y = 178 + (n - 1) * 57;
        c.strokeStyle = '#8b9b8c'; c.lineWidth = 1; c.strokeRect(425, y - 10, 9, 9);
        c.fillStyle = '#4e6059'; c.font = '14px Georgia, serif'; c.fillText(topics[n], 445, y, 275);
        c.strokeStyle = '#8b9b8c'; c.beginPath(); c.moveTo(445, y + 17); c.lineTo(700 - n * 11, y + 17); c.stroke();
        if (n <= phase) { c.strokeStyle = accent; c.lineWidth = 1.5; c.beginPath(); c.moveTo(426, y - 6); c.lineTo(429, y - 3); c.lineTo(434, y - 11); c.stroke(); }
    }
    c.restore();
    const diagram = ['library','study','university','occmedialab','workshop','gaming','scifi','mobileit','middleschool','highschool','laboratory','office','coworking','government','college','home','bedroom','lounge','kitchen','hospital','police','security'].includes(id);
    if (!diagram) return;
    c.save(); c.beginPath(); c.rect(40, 119, 310, 293); c.clip(); c.translate(42, 124);
    c.fillStyle = '#e6e7d9'; c.fillRect(0, 0, 304, 286); c.strokeStyle = '#b6c2b3'; c.lineWidth = .6;
    for (let x = 0; x < 305; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 280); c.stroke(); }
    for (let y = 0; y < 281; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(304, y); c.stroke(); }
    c.strokeStyle = accent; c.fillStyle = accent; c.lineWidth = 2;
    const line = points => { c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.stroke(); };
    const label = (text,x,y) => { c.fillStyle = '#4d625a'; c.font = '11px monospace'; c.fillText(text,x,y); c.fillStyle = accent; };
    if (['library','study','university'].includes(id)) {
        for (let r = 0; r < 11; r++) { c.strokeStyle = r % 3 ? '#9eaa7f' : '#73896e'; line(Array.from({length:40},(_,n)=>[n*8,30+r*21+Math.sin(n*.2+r*.4)*18])); }
        c.strokeStyle = '#6b96a2'; c.lineWidth = 4; line(Array.from({length:45},(_,n)=>[125+Math.sin(n*.12)*48,n*6]));
        c.strokeStyle = accent; c.lineWidth = 2; c.setLineDash([5,4]); line([[30,215],[77,158],[142,180],[213,96],[269,51]]); c.setLineDash([]);
        for (let n=0;n<3;n++) { c.beginPath();c.arc(77+n*68,158-n*31,5,0,Math.PI*2);c.fill();label('0'+(n+1),86+n*68,148-n*31); }
        label('CONCEPT FIELD MAP',12,272);
    } else if (id==='occmedialab') {
        for(let n=0;n<6;n++) { const x=8+n%2*150,y=8+Math.floor(n/2)*88;
            c.fillStyle=['#a6b9b6','#b6b5a0','#a9bac5'][(n+phase)%3];c.fillRect(x,y,136,66);
            c.fillStyle='#5d7475';c.fillRect(x,y+45,136,21);c.fillStyle='#e4d8bb';c.beginPath();c.arc(x+35+n*6,y+23,7+n%2*5,0,7);c.fill();
            c.fillRect(x+28+n*6,y+32,14,24);c.strokeStyle=accent;c.strokeRect(x,y,136,66);label(['WIDE','MID','DETAIL'][n%3]+' / '+(n+1),x+3,y+80);
        }
    } else if (['highschool','laboratory'].includes(id)) {
        for(let r=0;r<3;r++){c.strokeStyle=['#c17e55','#628c83','#657f98'][r];line(Array.from({length:80},(_,n)=>[10+n*3.6,50+r*85+Math.sin(n*(.12+r*.08)+phase*.35)*(14+r*5)]));label(['OBSERVE','COMPARE','REVIEW'][r],14,82+r*85);}
    } else if (['mobileit','middleschool'].includes(id)) {
        c.lineWidth=3;for(let n=0;n<4;n++){line([[24,40+n*62],[60+n*12,40+n*62],[60+n*12,138],[237,138],[237,38+n*62],[282,38+n*62]]);c.strokeRect(13,32+n*62,16,16);}
        c.fillStyle='#e6e7d9';c.fillRect(112,99,74,78);c.strokeRect(112,99,74,78);label('MODULE',126,140);
    } else if (id==='scifi') {
        for(let n=0;n<3;n++){c.beginPath();c.ellipse(150,138,50+n*35,30+n*24,-.4,0,7);c.stroke();}
        c.beginPath();c.arc(150,138,13,0,7);c.fill();c.setLineDash([5,4]);line([[20,230],[82,180],[180,75],[278,40]]);c.setLineDash([]);label('SURVEY / 0'+(phase+1),16,267);
    } else if (id==='workshop') {
        c.lineWidth=3;line([[65,51],[220,51],[220,219],[176,219],[176,100],[65,100],[65,51]]);
        for(const [x,y] of [[88,75],[197,75],[197,193]]){c.beginPath();c.arc(x,y,8,0,7);c.stroke();}
        c.lineWidth=1;line([[65,31],[220,31]]);line([[65,24],[65,38]]);line([[220,24],[220,38]]);label('155',131,24);label('FIT STUDY / REV '+(phase+1),12,267);
    } else if (id==='gaming') {
        for(const [x,y,w,h] of [[25,32,70,45],[205,30,70,80],[98,120,70,60],[20,205,65,52],[210,206,65,45]]){c.fillStyle='#a7b4b0';c.fillRect(x,y,w,h);}
        c.strokeStyle=accent;c.setLineDash([5,4]);line([[45,230],[75,170],[180,90],[250,60]]);c.setLineDash([]);c.fillStyle=accent;c.beginPath();c.arc(180,90,6,0,7);c.fill();label('ROUTE '+(phase+1),12,279);
    } else if (id==='kitchen') {
        for(let n=0;n<3;n++){c.fillStyle=['#b38860','#76936d','#c1a25f'][n];c.beginPath();c.ellipse(64+n*87,92,28,36,n*.25,0,7);c.fill();}
        label('SEASONAL / PREP NOTES',14,171);for(let n=0;n<4;n++){label(['01  GATHER','02  PREPARE','03  TASTE','04  SHARE'][n],24,196+n*22);}
    } else {
        const domestic=['home','bedroom','lounge'].includes(id), rows=domestic?4:3;
        for(let row=0;row<rows;row++)for(let col=0;col<3;col++){const x=8+col*99,y=18+row*(domestic?61:82);c.fillStyle=['#d7c19b','#b4c7bb','#bac6d0'][(row+col+phase)%3];c.fillRect(x,y,88,domestic?49:67);c.fillStyle='#5e726a';c.fillRect(x+9,y+12,50,2);c.fillRect(x+9,y+22,31+(row%2)*16,2);label(String(row*3+col+1).padStart(2,'0'),x+65,y+42);}
        label(domestic?'ONE WEEK / SMALL PLANS':'PLAN / WORK / REVIEW',12,279);
    }
    c.restore();
}
