// Keyboard tray: the joint limits and the coupling between joints, as DATA (docs/keyboard-tray/SPEC.md, 0.1 and 2.3, 6.2).
// Pure: no three.js, no DOM. tray-pose.mjs reads these; the clearance probe (tools/experience/tray-clearance.cjs, phase 6)
// will regenerate the tables below from the real desk geometry, so keep them tables and keep the shape.
//
// Pose = { slide, swing, tilt, drop }
//   slide  0..1       0 = as authored (the tray out in front), 1 = pushed all the way in under the desk
//   swing  degrees    about the vertical pivot at the track's end; + = the plate's front moves to the user's right
//   tilt   degrees    about the horizontal hinge at the front rod; + = front edge up
//   drop   millimetres  the whole tray lowered at the mount (the product's "height adjustable", 6.5 in)
// All four at 0 is the glb exactly as authored (today's rigid tray).

// Hard limits of each joint (Vico, 22 Nov 2026: slide 254 mm, tilt +-15 degrees, swing +-180 degrees, height 0..165 mm).
export const JOINT_LIMITS = Object.freeze({ slide: [0, 1], swing: [-180, 180], tilt: [-15, 15], drop: [0, 165] });
export const SLIDE_TRAVEL_MM = 254;            // 10 in, the product. The CAD track gives 239.5 mm: phase 2 reconciles
export const DROP_CAD_LINKS_MM = 58;           // what the CAD's sloped links alone would give (not a limit)
export const PLATE_BELOW_TRACK_MM = 19.7;      // the plate top is this far under the track top (= the desktop underside), measured in the glb
export const RIDER_CLEARANCE_MM = 3;           // air kept between a rider and the desktop

// Coupling 1: what the slide allows (starting values, spec 6.2; the probe replaces them).
// Linear between rows. swing = largest |swing|; tilt = [lowest, highest].
export const SLIDE_COUPLING = Object.freeze([
    { slide: 0,    swing: 180, tilt: [-15, 15] },
    { slide: 0.4,  swing: 180, tilt: [-15, 15] },
    { slide: 0.85, swing: 0,   tilt: [-2, 0] },     // pushed in: level, no swing
    { slide: 1,    swing: 0,   tilt: [-2, 0] },
]);
// Coupling 2: the swing carries the plate under the desk, where it cannot tilt up into the desktop.
export const SWING_TILT = Object.freeze([
    { swing: 0,   tilt: [-15, 15] },
    { swing: 20,  tilt: [-15, 15] },
    { swing: 60,  tilt: [-2, 0] },
    { swing: 180, tilt: [-2, 0] },
]);
// How far the plate is under the desk, 0..1: the larger of the two ramps. (The probe measures the real thing; this is a
// pose-only stand-in with the authored pose = 0 by construction, so keys at rest never lower the tray.)
export const UNDER_RAMPS = Object.freeze({ slide: [0.45, 0.75], swing: [20, 60] });

// Thickness of what rides on the plate, mm (assets/props/index.json, the height of each model). A tray with no rider is 0.
export const RIDER_MM = Object.freeze({
    'apple-keyboard': 30.3, 'office-keyboard': 13.4, 'razer-keyboard': 42.2, 'rgb-keyboard': 37.9,
    'ergoflex-ergo-keyboard': 45, 'ergoflex-mechanical-keyboard': 41.7, 'kenney-furniture-computer-keyboard': 42.96,
    'magic-mouse': 22.2, 'gaming-mouse': 56.9, 'ergoflex-mx-master-mouse': 47.2, 'ergoflex-mouse-2': 49.3,
    'kenney-furniture-computer-mouse': 31.85,
});
export const RIDER_UNKNOWN_MM = 45;            // a rider this table does not know is taken as the thickest keyboard
