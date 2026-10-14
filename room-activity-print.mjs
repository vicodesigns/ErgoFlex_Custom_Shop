import * as THREE from 'three';

// Original printed activity pages, sized to the existing tabletop books. No
// asset keys, furniture footprints, imported materials or project data change.
const THEMES = {
    home: ['DAILY NOTES', 'PLAN / MAKE / REFLECT', '#647b69'],
    office: ['PROJECT JOURNAL', 'IDEAS / ACTIONS / REVIEW', '#3d7470'],
    coworking: ['SHARED IDEAS', 'DISCOVER / CONNECT / BUILD', '#b27857'],
    library: ['READING NOTES', 'QUESTION / SOURCE / INSIGHT', '#456d55'],
    study: ['RESEARCH JOURNAL', 'READ / ANNOTATE / REFLECT', '#738361'],
    creative: ['COLOUR STUDIES', 'FORM / LIGHT / COMPOSITION', '#b87554'],
    music: ['SESSION NOTES', 'ORIGINAL STUDY / 4:4 / 88 BPM', '#946552'],
    gaming: ['STRATEGY NOTES', 'MAP / TIMING / TEAMWORK', '#7376a2'],
    lounge: ['WEEKEND JOURNAL', 'READ / PLAY / UNWIND', '#a47c5b'],
    kitchen: ['RECIPE JOURNAL', 'SEASONAL / FRESH / SHARE', '#678c7a'],
    gym: ['TRAINING LOG', 'WARM UP / WORK / RECOVER', '#538879'],
    bedroom: ['QUIET MOMENTS', 'SMALL PLANS / SLOW MORNINGS', '#9b8077'],
    workshop: ['BUILD NOTES', 'MEASURE / MAKE / REFINE', '#597c85'],
    gallery: ['EXHIBITION NOTES', 'FORM / MATERIAL / SPACE', '#9c8058'],
    scifi: ['MISSION LOG', 'SURVEY / ANALYSE / REPORT', '#558d9d'],
    security: ['SHIFT NOTES', 'CHECK / REVIEW / HAND OVER', '#557a86'],
    police: ['WORKSPACE LOG', 'PLAN / PREPARE / REVIEW', '#647b8c'],
    government: ['SERVICE JOURNAL', 'PREPARE / MEET / FOLLOW UP', '#9b8357'],
    kindergarten: ['LITTLE DISCOVERIES', 'COLOUR / SHAPE / STORY', '#b58d42'],
    elementary: ['LEARNING JOURNAL', 'READ / EXPLORE / CREATE', '#668c6d'],
    middleschool: ['MAKER NOTEBOOK', 'QUESTION / DESIGN / TEST', '#547e81'],
    highschool: ['LAB NOTES', 'OBSERVE / MEASURE / EXPLAIN', '#e8702a'],
    college: ['SEMINAR NOTES', 'READ / COMPARE / DEBATE', '#8b7760'],
    university: ['RESEARCH NOTES', 'QUESTION / EVIDENCE / INSIGHT', '#4b715d'],
    hospital: ['WORKSPACE CHECKLIST', 'PREPARE / CHECK / HAND OVER', '#598b85'],
    laboratory: ['LAB NOTEBOOK', 'OBSERVE / RECORD / REVIEW', '#64808c'],
    mobileit: ['SERVICE CHECKLIST', 'IDENTIFY / TEST / DEPLOY', '#617b86'],
    occmedialab: ['PRODUCTION NOTES', 'STORY / IMAGE / SOUND', '#d77b23']
};
function printMaterial(canvas) {
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    return new THREE.MeshStandardMaterial({ map, color: '#ffffff', roughness: .95, side: THREE.DoubleSide });
}
export function activityPageMaterial(id, phase = 0, coverColor = null) {
    const [title, subtitle, accent] = THEMES[id] || THEMES.home;
    if (coverColor) {
        const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 512;
        const c = canvas.getContext('2d');
        c.fillStyle = coverColor; c.fillRect(0, 0, 384, 512);
        c.strokeStyle = '#c3b899'; c.lineWidth = 2; c.strokeRect(24, 28, 336, 456);
        c.fillStyle = '#ede3c9'; c.textAlign = 'center'; c.font = '600 28px sans-serif';
        const words = title.split(' '), last = words.pop(); c.fillText(words.join(' '), 192, 190, 310); c.fillText(last, 192, 228, 310);
        c.fillRect(130, 256, 124, 2); c.font = '12px sans-serif';
        c.fillText(['PLAN', 'CREATE', 'REVIEW', 'REFLECT', 'SHARE'][phase], 192, 298);
        c.font = '11px sans-serif'; c.fillText('FIELD NOTES / ' + String(phase + 1).padStart(2, '0'), 192, 444);
        return printMaterial(canvas);
    }
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 512;
    const c = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    c.fillStyle = '#eee8d8'; c.fillRect(0, 0, W, H);
    // Gutter shade, page edges and a restrained print palette stay legible in
    // close views without emissive paper or dozens of little text meshes.
    const gutter = c.createLinearGradient(W / 2 - 20, 0, W / 2 + 20, 0);
    gutter.addColorStop(0, '#eee8d8'); gutter.addColorStop(.5, '#c9c0ac'); gutter.addColorStop(1, '#eee8d8');
    c.fillStyle = gutter; c.fillRect(W / 2 - 20, 0, 40, H);
    c.fillStyle = accent; c.fillRect(34, 38, 7, 62);
    c.fillStyle = '#354440'; c.font = '600 20px sans-serif'; c.fillText(title, 55, 60, 290);
    c.font = '10px sans-serif'; c.fillText(subtitle, 55, 83, 290);
    c.font = '11px sans-serif'; c.fillText(['MORNING PLAN', 'WORK IN PROGRESS', 'EVENING REVIEW', 'LATE NOTES', 'SHARED SESSION'][phase], 425, 58);
    c.strokeStyle = '#b6b7a8'; c.lineWidth = 1;
    for (let y = 127; y < 468; y += 29) for (const x of [40, 422]) {
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 300, y); c.stroke();
    }
    c.fillStyle = '#66716a';
    for (let n = 0; n < 7; n++) {
        c.fillRect(438, 145 + n * 39, 135 + (n * 47 + phase * 23) % 135, 3);
        c.fillStyle = accent; c.strokeStyle = accent; c.strokeRect(424, 138 + n * 39, 8, 8);
        c.fillStyle = '#66716a';
    }
    if (id === 'music') {
        c.fillStyle = '#eee8d8'; c.fillRect(40, 118, 305, 294);
        c.strokeStyle = '#66716a';
        for (let row = 0; row < 3; row++) {
            for (let line = 0; line < 5; line++) { const y = 150 + row * 94 + line * 9; c.beginPath(); c.moveTo(44, y); c.lineTo(339, y); c.stroke(); }
            for (let n = 0; n < 8; n++) { const x = 65 + n * 36, y = 160 + row * 94 + ((n * 3 + phase) % 5) * 5; c.beginPath(); c.ellipse(x, y, 5, 3.5, -.3, 0, Math.PI * 2); c.fill(); c.fillRect(x + 4, y - 24, 1.5, 24); }
        }
    } else if (['workshop', 'scifi', 'gaming', 'mobileit', 'laboratory', 'middleschool', 'occmedialab'].includes(id)) {
        c.fillStyle = '#e0e8e4'; c.fillRect(42, 134, 300, 196);
        c.strokeStyle = '#afc2bc';
        for (let x = 42; x <= 342; x += 20) { c.beginPath(); c.moveTo(x, 134); c.lineTo(x, 330); c.stroke(); }
        for (let y = 134; y <= 330; y += 20) { c.beginPath(); c.moveTo(42, y); c.lineTo(342, y); c.stroke(); }
        c.strokeStyle = accent; c.lineWidth = 3; c.strokeRect(90, 185, 160, 80); c.strokeRect(132, 154, 76, 142);
        c.lineWidth = 1; c.beginPath(); c.moveTo(70, 285); c.lineTo(270, 285); c.moveTo(70, 280); c.lineTo(70, 290); c.moveTo(270, 280); c.lineTo(270, 290); c.stroke();
    } else if (['creative', 'gallery', 'kindergarten', 'elementary'].includes(id)) {
        for (let n = 0; n < 6; n++) { c.fillStyle = ['#496b62', '#b67e61', '#c6ae70', '#647e98', '#996e7b', '#d8d0b9'][n]; c.fillRect(46 + n % 3 * 99, 145 + Math.floor(n / 3) * 105, 87, 82); }
        c.fillStyle = '#546057'; c.font = '12px sans-serif'; c.fillText('Balance • texture • negative space', 45, 393, 290);
    } else if (id === 'gym') {
        c.fillStyle = '#eee8d8'; c.fillRect(40, 120, 310, 285); c.strokeStyle = accent;
        c.beginPath(); c.moveTo(54, 360); c.lineTo(332, 360); c.stroke();
        for (let n = 0; n < 7; n++) { c.fillStyle = n === phase ? accent : '#b6c3b7'; c.fillRect(64 + n * 38, 360 - 65 - n % 3 * 34, 22, 65 + n % 3 * 34); }
        c.fillStyle = '#546057'; c.font = '12px sans-serif'; c.fillText('Repeat • rest • record', 54, 395);
    } else {
        c.fillStyle = '#546057'; c.font = '13px Georgia, serif';
        ['One useful idea', 'A question to explore', 'Next small step'].forEach((t, n) => { c.fillText(t, 46, 151 + n * 89); for (let k = 0; k < 2; k++) c.fillRect(46, 164 + n * 89 + k * 19, 230 - k * 38, 2); });
        c.fillStyle = accent; c.fillRect(46, 415, 122, 29); c.fillStyle = '#f9f6ed'; c.font = '10px sans-serif'; c.fillText('NOTES / ' + String(phase + 1).padStart(2, '0'), 57, 433);
    }
    c.fillStyle = '#8e9587'; c.font = '10px sans-serif'; c.fillText(String(phase * 2 + 1).padStart(2, '0'), 44, 493); c.fillText(String(phase * 2 + 2).padStart(2, '0'), 708, 493);
    return printMaterial(canvas);
}
