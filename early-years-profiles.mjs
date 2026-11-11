// Authored child-interest portraits, not age or ability prescriptions. These
// are defaults for the five floor plans: a child's interests are independent
// of bedroom size, and a shared-play setting does not add resident children.
export const EARLY_YEARS_PROFILES={
 apartment:{
  id:'little-noticer',title:'Little noticer · shapes & soft friends',
  interest:'Animals, big shapes, familiar picture books and things to notice',
  developmentalFocus:'Simple matching, choosing, repeating and sharing attention',
  participation:'One resident child; a grown-up joins the shared story',partyParticipants:1,motif:'nature',
  design:{flags:5,booksPerRow:2,paintings:2,muralScenes:2,focus:'familiar shapes and a soft reading corner'},
  palette:{wall:'#f7f0df',dado:'#a8bca4',feature:'#edcf87',accent:'#c98e70',second:'#769b87',cloth:'#dfbb76',ink:'#416858',curtain:'#e5d5b3',title:'HELLO, LITTLE WORLD',sub:'notice / choose / try again',poster:'ANIMALS / SHAPES / HOME'},
  activities:{
   morning:'Choose a familiar animal book and match a few large shapes',
   afternoon:'Make broad crayon marks and try the same shape in another colour',
   evening:'A grown-up shares a favourite picture book beside the soft friends',
   night:'The favourite book is closed and the soft friends are back in their basket',
   party:'One child and a grown-up build a simple railway and tell its story'
  }
 },
 house:{
  id:'busy-helper',title:'Busy helper · everyday adventures',
  interest:'Family routines, market play, pretend meals and helping',
  developmentalFocus:'Imitation, naming, taking turns and making everyday choices',
  participation:'One resident child; one visiting friend joins pretend play',partyParticipants:2,motif:'pretend',
  design:{flags:7,booksPerRow:3,paintings:3,muralScenes:3,focus:'one pretend market and everyday family stories'},
  palette:{wall:'#fbefdf',dado:'#8bb9b1',feature:'#e5af90',accent:'#be795e',second:'#609c97',cloth:'#e4b09a',ink:'#3a6668',curtain:'#d9c4a7',title:'TODAY I AM THE HELPER',sub:'wash / choose / cook / share',poster:'OUR LITTLE MARKET'},
  activities:{
   morning:'Choose breakfast ingredients and open the picture menu at the little market',
   afternoon:'Draw a shopping list and prepare a pretend meal for a soft friend',
   evening:'The market closes and a familiar home-and-family story opens',
   night:'The picture menu is put away, baskets are filled and the room is ready for sleep',
   party:'Two children take turns as shopper and helper, with a place prepared for each'
  }
 },
 spacious:{
  id:'little-inventor',title:'Little inventor · bridges & wheels',
  interest:'Building, vehicles, colour experiments and how things fit together',
  developmentalFocus:'Trying alternatives, planning a small build and returning to work in progress',
  participation:'One resident child; one visiting friend joins a shared build',partyParticipants:2,motif:'building',
  design:{flags:7,booksPerRow:3,paintings:3,muralScenes:2,focus:'an unfinished bridge and a clear building mat'},
  palette:{wall:'#f3efdf',dado:'#8eaebb',feature:'#d6b36a',accent:'#c7795e',second:'#547e95',cloth:'#a8bec4',ink:'#355c6e',curtain:'#d4ccb4',title:'WHAT COULD WE BUILD?',sub:'stack / connect / test / change',poster:'BRIDGES / WHEELS / IDEAS'},
  activities:{
   morning:'Start with two kinds of blocks and a delivery truck waiting for a route',
   afternoon:'A bridge remains in progress while drawings test another way across',
   evening:'Park the truck, keep the finished build and share a story about making things',
   night:'Loose blocks return to labelled baskets and the drawings wait for tomorrow',
   party:'Two builders bring different colours and ideas to the same railway village'
  }
 },
 premium:{
  id:'story-makers',title:'Story makers · little worlds',
  interest:'Characters, pretend places, picture sequences and stories invented with friends',
  developmentalFocus:'Symbolic play, sequencing, different viewpoints and shared storytelling',
  participation:'One resident child; two visiting friends join the little-world story',partyParticipants:3,motif:'stories',
  design:{flags:9,booksPerRow:3,paintings:3,muralScenes:2,focus:'the little house and one evolving character story'},
  palette:{wall:'#f7eadf',dado:'#acb2c1',feature:'#d8a17e',accent:'#bc7e83',second:'#7c8cae',cloth:'#d6a7a7',ink:'#56576e',curtain:'#d8c4bb',title:'ONCE UPON OUR DAY',sub:'choose a character / make a story',poster:'LITTLE WORLDS / BIG STORIES'},
  activities:{
   morning:'Choose wooden characters and arrange the first scene in their little house',
   afternoon:'Invent the next scene at the little house and draw its picture at the making table',
   evening:'The characters return home and the reading corner holds the final chapter',
   night:'The wooden family is put to bed and the story pictures stay clipped on the wall',
   party:'Three friends choose different characters and add their own part to one shared story'
  }
 },
 executive:{
  id:'nature-and-rhythm',title:'Nature & rhythm · discovery with friends',
  interest:'Wooden sounds, leaf shapes, patterns, movement and group discoveries',
  developmentalFocus:'Comparing, making patterns, listening to others and combining ideas',
  participation:'One resident child; three visiting friends join the discovery session',partyParticipants:4,motif:'music',
  design:{flags:7,booksPerRow:3,paintings:3,muralScenes:2,focus:'a listening bench and an open movement area'},
  palette:{wall:'#f2efdf',dado:'#9fb8a7',feature:'#d4b768',accent:'#bd895f',second:'#5f9998',cloth:'#bdc89e',ink:'#3e6866',curtain:'#d9d2b3',title:'LISTEN TO OUR WORLD',sub:'notice / listen / make a pattern',poster:'LEAVES / SOUNDS / DISCOVERIES'},
  activities:{
   morning:'Notice the leaf shapes, choose a wooden sound and begin a simple repeating pattern',
   afternoon:'Compare a few wooden sounds and draw the colour pattern they suggest',
   evening:'The discovery bench quiets down and a nature story gathers everyone at the reading corner',
   night:'Sound materials are packed, the drum rests and the shaded making light is off',
   party:'Four friends each bring a colour, a sound or a character to a shared discovery session'
  }
 }
};

export function earlyYearsProfile(layout){
 if(layout?.ageStage!=='early')return null;
 return EARLY_YEARS_PROFILES[layout.baseLayoutId||layout.id]||EARLY_YEARS_PROFILES.house;
}
