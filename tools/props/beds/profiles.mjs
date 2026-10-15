const nordic={textile:'boucle',frameColor:'#d7d0bd',linenColor:'#f1ede3',accentColor:'#7b8e7d',woodColor:'#8a6c4a',metalColor:'#b0a183'};
const milano={textile:'boucle',frameColor:'#535b56',linenColor:'#ede5d5',accentColor:'#ad7754',woodColor:'#503a28',metalColor:'#b69a5e'};
const cloud={textile:'boucle',frameColor:'#ded4c4',linenColor:'#f3ede3',accentColor:'#b77f69',woodColor:'#71533b',metalColor:'#afa694'};
const walnut={textile:'velvet',frameColor:'#596d60',linenColor:'#e6dcc9',accentColor:'#bf9770',woodColor:'#493223',metalColor:'#b69a5e'};
const obsidian={textile:'velvet',frameColor:'#333b3e',linenColor:'#e0e2dc',accentColor:'#a67554',woodColor:'#38291f',metalColor:'#a4abad'};
const room={scenes:['bedroom'],mattressL:1.9,headInset:.025,lengthExtra:.10,integratedShelves:false,puffScale:.9};
export const ATELIER_BED_PROFILES=[
 {...room,...nordic,id:'atelier-bed-tatami-compact',name:'Atelier bed · Compact oak tatami & sage linen',family:'compact',archetype:'tatami',mattressW:1.4,deckOverhang:.18,headHeight:.9},
 {...room,...milano,id:'atelier-bed-platform-queen',name:'Atelier bed · Milano platform & warm linen',family:'home',archetype:'platform',mattressW:1.7,wingSpan:1.96,headHeight:1.08},
 {...room,...cloud,id:'atelier-bed-wingback-ivory',name:'Atelier bed · Ivory wingback & clay throw',family:'spacious',archetype:'wingback',mattressW:1.5,headHeight:1.18},
 {...room,...walnut,id:'atelier-bed-canopy-walnut',name:'Atelier bed · Walnut canopy & sage velvet',family:'premium',archetype:'canopy',mattressW:1.75,headHeight:1.18},
 {...room,...obsidian,id:'atelier-bed-platform-graphite',name:'Atelier bed · Graphite platform & walnut',family:'executive',archetype:'platform',mattressW:1.7,wingSpan:1.96,headHeight:1.22},
 {...milano,id:'atelier-bed-platform-king',name:'Atelier bed · King platform with floating shelves',family:'catalog',archetype:'platform',mattressW:1.95,mattressL:2.03,headHeight:1.2,scenes:['bedroom']},
 {...walnut,id:'atelier-bed-canopy-king',name:'Atelier bed · King walnut canopy',family:'catalog',archetype:'canopy',mattressW:1.95,mattressL:2.03,headHeight:1.28,scenes:['bedroom']},
 {...cloud,id:'atelier-bed-wingback-king',name:'Atelier bed · King cloud wingback',family:'catalog',archetype:'wingback',mattressW:1.95,mattressL:2.03,headHeight:1.28,scenes:['bedroom']},
 {...nordic,id:'atelier-bed-tatami-king',name:'Atelier bed · King low oak tatami',family:'catalog',archetype:'tatami',mattressW:1.95,mattressL:2.03,headHeight:.98,scenes:['bedroom']}
];
