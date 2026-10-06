import { LedCommandCenter } from './led-command-center.mjs?v=desktop-bands-back-20261005';
import { normalizeCustomLook, customLookUsesMusic, CustomLookSampler, tintCustomMusic } from './led-custom-presets.mjs?v=desktop-bands-back-20261005';
import { configureRoomLightRig, resetRoomLightRig } from './room-refinement.mjs?v=groove-routines-20261002';
import { roomLifeBaseTransform, roomLifeDisplayTransform, ROOM_STORIES, DAY_PHASES } from './room-life.mjs?v=groove-routines-20261002';
import { RoomGroove } from './room-groove-runtime.mjs?v=room-safety-20261006';
import { RoomInteractions } from './room-interactions.mjs?v=room-safety-20261006';
import { RoomSafety } from './room-safety.mjs?v=room-safety-20261006';
import { TouchscreenDisplay } from './touchscreen-display.mjs?v=room-safety-20261006';
import { RoomLedSpill } from './room-led-spill.mjs?v=room-furnishings-20261006';
import { LIBRARY_MODES, LIBRARY_LAYOUTS, libraryLayoutForSize, libraryLayoutById } from './library-room.mjs?v=groove-routines-20261002';
import { COWORKING_MODES, COWORKING_LAYOUTS, coworkingLayoutForSize, coworkingLayoutById } from './coworking-room.mjs?v=groove-routines-20261002';
import { SCIFI_MODES, SCIFI_LAYOUTS, scifiLayoutForSize, scifiLayoutById } from './scifi-room.mjs?v=groove-routines-20261002';
import { GALLERY_MODES, GALLERY_LAYOUTS, galleryLayoutForSize, galleryLayoutById } from './gallery-room.mjs?v=groove-routines-20261002';
import { BEDROOM_MODES, BEDROOM_LAYOUTS, bedroomLayoutForSize, bedroomLayoutById } from './bedroom-room.mjs?v=groove-routines-20261002';
import { WORKSHOP_MODES, WORKSHOP_LAYOUTS, workshopLayoutForSize, workshopLayoutById } from './workshop-room.mjs?v=groove-routines-20261002';
import * as THREE from 'three';
import { LED_EFFECTS, normalizeLedEffect, sampleLedEffect } from './led-effects.mjs?v=led-effects-20261003';
import { LED_STRIPS, LED_STRIP_MAP_VERSION, createLedFrame, sampleLedDiagnostic } from './led-strip-map.mjs?v=led-game-20261003';
import { LedPixelRenderer } from './led-pixel-renderer.mjs?v=desktop-bands-back-20261005';
import { LedMotion } from './led-movement.mjs?v=led-game-20261003';
import { LedSounds } from './led-sounds.mjs?v=room-safety-20261006';
import { LedGameMode } from './led-game-mode.mjs?v=desktop-bands-back-20261005';
import { LedMusicMode } from './led-music-mode.mjs?v=room-furnishings-20261006';
import { sampleDecorativeInto } from './led-showcase-effects.mjs?v=desktop-bands-back-20261005';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PRODUCT_CONFIG, defaultConfig, money, configurationPrice, priceBreakdown, validConfig, cleanConfig,
         WOOD_SPECIES, woodSpecies, SURFACE_TREATMENTS,
         ACCESSORIES, PRESETS, accessory, accessoryFits, incompatibleAccessories } from './catalog.mjs?v=public-plates-controls-20260930';
import { PROJECT_FORMAT_VERSION, validateProjectFile, hardProblems, softProblems } from './project-io.mjs';
import { TILT_SPEEDS, GLIDE_SPEEDS, TILT_MIN, TILT_MAX, maximumTiltForHeight, minimumHeightForTilt, rigDegreesForTilt } from './motion-limits.mjs?v=desktop-bands-back-20261005';
import { validateBuild, blockingFindings, validationCacheKey } from './validation.mjs';
import { WorkspaceAccessories, WorkspaceRoom, ROOM_SCENES, ROOM_ATMOSPHERES, PROP_LIBRARY } from './workspace-3d.mjs?v=room-furnishings-20261006';
import { HOME_MODES, HOME_LAYOUTS, homeLayoutForSize, homeLayoutById } from './home-office.mjs?v=groove-routines-20261002';
import { GAMING_MODES, GAMING_LAYOUTS, gamingLayoutForSize, gamingLayoutById } from './gaming-room.mjs?v=groove-routines-20261002';
import { MUSIC_MODES, MUSIC_LAYOUTS, musicLayoutForSize, musicLayoutById } from './music-room.mjs?v=room-furnishings-20261006';
import { ARTIST_MODES, ARTIST_LAYOUTS, artistLayoutForSize, artistLayoutById } from './artist-room.mjs?v=groove-routines-20261002';
import { STUDY_MODES, STUDY_LAYOUTS, studyLayoutForSize, studyLayoutById } from './study-room.mjs?v=groove-routines-20261002';
import { OFFICE_MODES, OFFICE_LAYOUTS, officeLayoutForSize, officeLayoutById } from './office-room.mjs?v=groove-routines-20261002';
import { GYM_MODES, GYM_LAYOUTS, gymLayoutForSize, gymLayoutById } from './gym-room.mjs?v=groove-routines-20261002';
import { KITCHEN_MODES, KITCHEN_LAYOUTS, kitchenLayoutForSize, kitchenLayoutById } from './kitchen-room.mjs?v=groove-routines-20261002';
import { LOUNGE_MODES, LOUNGE_LAYOUTS, loungeLayoutForSize, loungeLayoutById } from './lounge-room.mjs?v=groove-routines-20261002';
import { ARWorkspace } from './ar-workspace.mjs?v=desktop-bands-back-20261005';
import { accessoryIllustration } from './workspace-icons.mjs';

// Configuration
const EVENT_DEMO = location.pathname.endsWith('/product-demo.html');
const TRIM_MODEL_URL = './assets/trim/fullTrim.glb?v=public-plates-controls-20260930';
const SMALL_TRIM_MODEL_URL = './assets/trim/shelveanddesktopTrim.glb?v=public-plates-controls-20260930';
const LARGE_DESKTOP_MODEL_URL = './assets/trim/desktopLwTrim.glb?v=public-plates-controls-20260930';
const LARGE_DESKTOP_TRIM_URL = './assets/trim/desktopLwTrimV2.glb?v=desktop-trim-v2-20261001';
const TOUCHSCREEN_PULLED_URL = './assets/motion/touchscreenPulledOut.glb?v=public-plates-controls-20260930';
const TOUCHSCREEN_EXTENDED_URL = './assets/motion/touchscreenExtended.glb?v=public-plates-controls-20260930';
const TOUCHSCREEN_WIDE_URL = './assets/motion/touchscreenExtendedForWideDesktop.glb?v=public-plates-controls-20260930';
const touchscreenDisplay = new TouchscreenDisplay();
let touchscreenTexture = null, touchscreenDrawAt = 0;
const roomSafety = new RoomSafety();
const LED_MODEL_URL = './assets/motion/LEDS.glb?v=public-plates-controls-20260930';
const WIDE_DESKTOP_LED_URL = './assets/motion/LEDSforWideDesktop.glb?v=public-plates-controls-20260930';
const LED_COLOR_KEY = 'ergoflex.ledColorV1';
const LED_GLOW_KEY = 'ergoflex.ledGlowV4';
const LED_SURFACE_KEY = 'ergoflex.ledSurfacesV1';
const LED_EFFECT_KEY = 'ergoflex.ledEffectV1';
// The former 85% output is the new ceiling shown to visitors as 100%.
const LED_FULL_BRIGHTNESS = 123.25;
const LED_COLOR_PRESETS = Object.freeze([
    { name: 'Red', value: '#f10404' },
    { name: 'Amber', value: '#ffb347' },
    { name: 'Violet', value: '#a66bff' },
    { name: 'Blue', value: '#497bff' },
    { name: 'Cyan', value: '#40eaff' },
    { name: 'Green', value: '#42d89c' },
    { name: 'Day pure white', value: '#ffffff' },
    { name: 'Evening white', value: '#fff1d6' }
]);
const SCREEN_PIVOT = new THREE.Vector3(-141.99034318, 49.56108308, 0);
const WIDE_SCREEN_PIVOT = new THREE.Vector3(-139.79, 49.56108308, 0);
const SCREEN_SLIDE = 4.7;
const SCREEN_TURN = THREE.MathUtils.degToRad(146.457954);
// The wide export's open screen face is 12° steeper than the Standard face.
// Remove that authored difference before applying their shared slide and turn.
const WIDE_SCREEN_REST_TURN = SCREEN_TURN + THREE.MathUtils.degToRad(12);
let screenAssembly = null;
let screenProgress = 0;
let screenTarget = 0;
let ledParts = [];
let ledDesktopFit = null;
let ledStandardStrips = null;
let ledExtendedStrips = null;
let ledSpillMaterials = [];
let ledsEnabled = false;
const TRIM_COLOR_KEY = 'ergoflex.trimColorV1';
// The Rhino export has ten unnamed nodes, each split into many mesh primitives.
// These labels and rest-pose roles
// follow their measured bounds against the matching full.glb desk model.
const TRIM_PARTS = [
    { name: 'Desktop trim', role: 'tilt' },
    { name: 'Left leg profile trim', role: 'base' },
    { name: 'Right leg profile trim', role: 'base' },
    { name: 'Left wing trim', role: 'tilt' },
    { name: 'Right wing trim', role: 'tilt' },
    { name: 'Shelf back trim', role: 'lift' },
    { name: 'Shelf left trim', role: 'lift' },
    { name: 'Shelf right trim', role: 'lift' },
    { name: 'Leg back connector trim', role: 'base' },
    { name: 'Base panel trim', role: 'base' }
];

const STARTING_POS = { x: 4.8, y: 3.4, z: 4.2 };
const STARTING_TARGET = { x: -0.1, y: 0.9, z: 0.0 };

const TELESCOPING_PARTS = [
    "Lift_Column_Center_1",
    "Lift_Column_Center"
];

// Specific World Coordinate Overrides for parts at 28" Height (LIFT_MIN)
const PART_BAKE_DATA = {
    "Lift_Column_Center": {
        "position": { "x": 6.283983309254151, "y": -0.7430694811477421, "z": 12.6278441313198 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 0.03859392694789662, "y": 0.03859392694789662, "z": 0.03859392694789662 }
    },
    "Lift_Column_Center_1": {
        "position": { "x": 6.283983309254151, "y": -0.7430694811477421, "z": 12.6278441313198 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 0.03859392694789662, "y": 0.03859392694789662, "z": 0.03859392694789662 }
    }
};

const INITIAL_ANIMATED_PARTS = [
    "Power", "Power_1", "Power_2", "Desktop", "Desktop_1", "Desktop_2", "Desktop_3", "Power_3", "Power_4", "Power_5", "Power_6", "Power_7", "Lift_Column_Top", "Lift_Column_Top_1", "Lift_Column_Top_2", "Lift_Column_Top_3", "Lift_Column_Top_4", "Lift_Column_Top_5", "Lift_Column_Top_6", "Lift_Column_Top_7", "Lift_Column_Top_8", "Lift_Column_Top_9", "Lift_Column_Top_10", "Lift_Column_Top_11", "Lift_Column_Top_12", "Lift_Column_Top_13", "Lift_Column_Top_14", "Lift_Column_Top_15", "L_A_Hardware_Top", "L_A_Hardware_Top_1", "L_A_Hardware_Top_2", "L_A_Hardware_Top_3", "Linear_Actuators", "Linear_Actuators_1", "Linear_Actuators_2", "Linear_Actuators_3", "Linear_Actuators_4", "Linear_Actuators_5", "Linear_Actuators_6", "Linear_Actuators_7", "Linear_Actuators_8", "Linear_Actuators_9", "Lift_Column_Top_16", "Lift_Column_Top_17", "L_A_Hardware_Top_4", "L_A_Hardware_Top_5", "L_A_Hardware_Top_6", "L_A_Hardware_Top_7", "Leds", "Leds_1", "Leds_2", "Revolve2", "Plates_Hardware", "Plates_Hardware_1", "Plates_Hardware_2", "Plates_Hardware_3", "Plates_Hardware_4", "Plates_Hardware_5", "Plates_Hardware_6", "Plates_Hardware_7", "Plates_Hardware_8", "Plates_Hardware_9", "Plates_Hardware_10", "Plates_Hardware_11", "Plates_Hardware_12", "Plates_Hardware_13", "Plates_Hardware_14", "Plates_Hardware_15", "Plates_Hardware_16", "Plates_Hardware_17", "Plates_Hardware_18", "Plates_Hardware_19", "Plates_Hardware_20", "Plates_Hardware_21", "Plates_Hardware_22", "Plates_Hardware_23", "Plates_Hardware_24", "Plates_Hardware_25", "Plates_Hardware_26", "Plates_Hardware_27", "Plates_Hardware_28", "Plates_Hardware_29", "Plates_Hardware_30", "Plates_Hardware_31", "Plates_Hardware_32", "Plates_Hardware_33", "Plates_Hardware_34", "Plates_Hardware_35", "Plates_Hardware_36", "Plates_Hardware_37", "Plates_Hardware_38", "Plates_Hardware_39", "Plates_Hardware_40", "Plates_Hardware_41", "Plates_Hardware_42", "Plates_Hardware_43", "Plates_Hardware_44", "Plates_Hardware_45", "Plates_Hardware_46", "Plates_Hardware_47", "Plates_Hardware_48", "Plates_Hardware_49", "Plates_Hardware_50", "Plates_Hardware_51", "Plates_Hardware_52", "Plates_Hardware_53", "Plates_Hardware_54", "Plates_Hardware_55", "Plates_Hardware_56", "Plates_Hardware_57", "Plates_Hardware_58", "Plates_Hardware_59", "Plates_Hardware_60", "Plates_Hardware_61", "Plates_Hardware_62", "Plates_Hardware_63", "Plates_Hardware_64", "Plates_Hardware_65", "Plates_Hardware_66", "Plates_Hardware_67", "Plates_Hardware_68", "Plates_Hardware_69", "Plates_Hardware_70", "Plates_Hardware_71", "Plates_Hardware_72", "Plates_Hardware_73", "Plates_Hardware_74", "Plates_Hardware_75", "Plates_Hardware_76", "Plates_Hardware_77", "Plates_Hardware_78", "Plates_Hardware_79", "Plates_Hardware_80", "Plates_Hardware_81", "Plates_Hardware_82", "Plates_Hardware_83", "Plates_Hardware_84", "Plates_Hardware_85", "Plates_Hardware_86", "Plates_Hardware_87", "Plates_Hardware_88", "Plates_Hardware_89", "Plates_Hardware_90", "Plates_Hardware_91", "Plates_Hardware_92", "Plates_Hardware_93", "Plates_Hardware_94", "Plates_Hardware_95", "Plates_Hardware_96", "Plates_Hardware_97", "Plates_Hardware_98", "Plates_Hardware_99", "Plates_Hardware_100", "Plates_Hardware_101", "Plates_Hardware_102", "Plates_Hardware_103", "Plates_Hardware_104", "Plates_Hardware_105", "Plates_Hardware_106", "Plates_Hardware_107", "Plates_Hardware_108", "Plates_Hardware_109", "Plates_Hardware_110", "Plates_Hardware_111", "Plates_Hardware_112", "Plates_Hardware_113", "Plates_Hardware_114", "Plates_Hardware_115", "Plates_Hardware_116", "Plates_Hardware_117", "Plates_Hardware_118", "Plates_Hardware_119", "Plates_Hardware_120", "Plates_Hardware_121", "Plates_Hardware_122", "Plates_Hardware_123", "Plates_Hardware_124", "Plates_Hardware_125", "Plates_Hardware_126", "Plates_Hardware_127", "Plates_Hardware_128", "Plates_Hardware_129", "Plates_Hardware_130", "Plates_Hardware_131", "Plates_Hardware_132", "Plates_Hardware_133", "Plates_Hardware_134", "Plates_Hardware_135", "Plates_Hardware_136", "Plates_Hardware_137", "Plates_Hardware_138", "Plates_Hardware_139", "Plates_Hardware_140", "Plates_Hardware_141", "Plates_Hardware_142", "Plates_Hardware_143", "Plates_Hardware_144", "Plates_Hardware_145", "Plates_Hardware_146", "Plates_Hardware_147", "Plates_Hardware_148", "Plates_Hardware_149", "Plates_Hardware_150", "Plates_Hardware_151", "Plates_Hardware_152", "Plates_Hardware_153", "Plates_Hardware_154", "Plates_Hardware_155", "Plates_Hardware_156", "Plates_Hardware_157", "Plates_Hardware_158", "Plates_Hardware_159", "Plates_Hardware_160", "Plates_Hardware_161", "Plates_Hardware_162", "Plates_Hardware_163", "Plates_Hardware_164", "Plates_Hardware_165", "Plates_Hardware_166", "Plates_Hardware_167", "Plates_Hardware_168", "Plates_Hardware_169", "Plates_Hardware_170", "Plates_Hardware_171", "Plates_Hardware_172", "Plates_Hardware_173", "Plates_Hardware_174", "Plates_Hardware_175", "Plates_Hardware_176", "Plates_Hardware_177", "Plates_Hardware_178", "Plates_Hardware_179", "Plates_Hardware_180", "Plates_Hardware_181", "Plates_Hardware_182", "Plates_Hardware_183", "Plates_Hardware_184", "Plates_Hardware_185", "Plates_Hardware_186", "Plates_Hardware_187", "Plates_Hardware_188", "Plates_Hardware_189", "Plates_Hardware_190", "Plates_Hardware_191", "Plates_Hardware_192", "Plates_Hardware_193", "Plates_Hardware_194", "Plates_Hardware_195", "Plates_Hardware_196", "Plates_Hardware_197", "Plates_Hardware_198", "Plates_Hardware_199", "Plates_Hardware_200", "Combine1", "Revolve2_1", "Combine1_1", "mesh_471", "mesh_472", "mesh_473", "mesh_474", "mesh_475", "mesh_476", "mesh_477", "Leds_3", "Combine1_2", "Revolve2_2", "mesh_481", "mesh_482", "mesh_483", "mesh_484", "Combine1_3", "Revolve2_3", "mesh_487", "mesh_488", "mesh_489", "mesh_490", "Plates_Hardware_201", "Plates_Hardware_202", "Plates_Hardware_203", "Plates_Hardware_204", "Plates_Hardware_205", "Plates_Hardware_206", "Plates_Hardware_207", "Plates_Hardware_208", "Plates_Hardware_209", "Plates_Hardware_210", "Plates_Hardware_211", "Plates_Hardware_212", "Plates_Hardware_213", "Plates_Hardware_214", "Plates_Hardware_215", "Plates_Hardware_216", "Plates_Hardware_217", "Plates_Hardware_218", "Plates_Hardware_219", "Plates_Hardware_220", "Plates_Hardware_221", "Plates_Hardware_222", "Plates_Hardware_223", "Plates_Hardware_224", "Plates_Hardware_225", "Plates_Hardware_226", "Plates_Hardware_227", "Plates_Hardware_228", "Plates_Hardware_229", "Plates_Hardware_230", "Plates_Hardware_231", "Plates_Hardware_232", "Plates_Hardware_233", "Plates_Hardware_234", "Plates_Hardware_235", "Plates_Hardware_236", "Plates_Hardware_237", "Plates_Hardware_238", "Plates_Hardware_239", "Plates_Hardware_240", "Plates_Hardware_241", "Plates_Hardware_242", "Plates_Hardware_243", "Plates_Hardware_244", "Plates_Hardware_245", "Plates_Hardware_246", "Plates_Hardware_247", "Plates_Hardware_248", "Plates_Hardware_249", "Plates_Hardware_250", "Plates_Hardware_251", "Plates_Hardware_252", "Plates_Hardware_253", "Plates_Hardware_254", "Plates_Hardware_255", "Plates_Hardware_256", "Plates_Hardware_257", "Plates_Hardware_258", "Plates_Hardware_259", "Plates_Hardware_260", "Plates_Hardware_261", "Plates_Hardware_262", "Plates_Hardware_263", "Plates_Hardware_264", "Plates_Hardware_265", "Plates_Hardware_266", "Plates_Hardware_267", "Plates_Hardware_268", "Plates_Hardware_269", "Plates_Hardware_270", "Plates_Hardware_271", "Plates_Hardware_272", "Plates_Hardware_273", "Plates_Hardware_274", "Plates_Hardware_275", "Plates_Hardware_276", "Plates_Hardware_277", "Plates_Hardware_278", "Plates_Hardware_279", "Plates_Hardware_280", "Plates_Hardware_281", "Plates_Hardware_282", "Plates_Hardware_283", "Plates_Hardware_284", "Plates_Hardware_285", "Plates_Hardware_286", "Plates_Hardware_287", "Plates_Hardware_288", "Plates_Hardware_289", "Plates_Hardware_290", "Plates_Hardware_291", "Touch_Screen", "Touch_Screen_1", "Touch_Screen_2", "Touch_Screen_3", "mesh_624", "mesh_625", "mesh_626", "Leds_4", "Leds_5", "Leds_6", "Leds_7", "Leds_8", "Leds_9", "Leds_10", "Leds_11", "Leds_12", "Leds_13", "Leds_14", "Leds_15", "Leds_16", "Leds_17", "Leds_18", "Leds_19", "Leds_20", "Leds_21", "Leds_22", "Leds_23", "Leds_24", "Leds_25", "Leds_26", "Leds_27", "Leds_28", "Leds_29", "Leds_30", "Leds_31", "Leds_32", "Leds_33", "Leds_34", "Leds_35", "Leds_36", "Leds_37", "Leds_38", "Joinery_6", "Joinery_7", "Joinery_8", "Joinery_9", "Joinery_10", "Joinery_11", "Joinery_12", "Joinery_13", "Joinery_14", "Joinery_15", "Joinery_16", "Joinery_17", "Joinery_18", "Plates_Hardware_292", "Plates_Hardware_293", "Plates_Hardware_294", "Plates_Hardware_295", "mesh_679", "mesh_680", "mesh_681", "mesh_682", "Touch_Screen_4", "Touch_Screen_5", "Touch_Screen_6", "Touch_Screen_7", "Leds_40", "Leds_41", "Leds_42", "Leds_43", "mesh_692", "Screws_24", "Screws_25", "Screws_26", "Screws_27", "Screws_28", "Screws_29", "Screws_30", "Screws_31", "Screws_32", "Screws_33", "Screws_34", "Screws_35", "Screws_36", "Screws_37", "Screws_38", "Screws_39", "Screws_40", "Screws_41", "Screws_42", "Screws_43", "Screws_44", "Screws_45", "Screws_46", "Screws_47", "Screws_48", "Screws_49", "Screws_50", "Screws_51", "Screws_52", "Screws_53", "Screws_54", "Screws_55", "Screws_56", "Screws_57", "Screws_58", "Screws_59", "Screws_60", "Screws_61", "Screws_62", "Screws_63", "Screws_64", "Screws_65", "Screws_66", "Screws_67", "Screws_68", "Screws_69", "Screws_70", "Screws_71", "Screws_72", "Screws_73", "Screws_74", "Screws_75", "Screws_76", "Screws_77", "Screws_78", "Screws_79", "Screws_80", "Screws_81", "Screws_82", "Screws_83", "Screws_84", "Screws_85", "Screws_86", "Screws_87", "Screws_88", "Screws_89", "Screws_90", "Screws_91", "Screws_92", "Screws_93", "Screws_94", "Screws_95", "Screws_96", "Screws_97", "Screws_98", "Screws_99", "Screws_100", "Screws_101", "Screws_102", "Screws_103", "Screws_104", "Screws_105", "Screws_106", "Screws_107", "Screws_108", "Screws_109", "Screws_110", "Screws_111", "Screws_112", "Screws_113", "Screws_114", "Screws_115", "Screws_116", "Screws_117", "Screws_118", "Screws_119", "Screws_120", "Screws_121", "Screws_122", "Screws_123", "Screws_124", "Screws_125", "Screws_126", "Screws_127", "Top_Shelf", "Top_Shelf_1", "Top_Shelf_2", "Top_Shelf_3", "Top_Shelf_4"
];

let currentConfig = { ...defaultConfig(), ...(EVENT_DEMO ? { size: '60x30' } : {}) };
let cartItems = [];
// V2 keys: the configuration gained an accessories list. V1 keys are still read
// once, as a migration, and never written again.
const SAVED_BUILD_KEY = 'ergoflexSavedBuildV2';
const CART_KEY = 'ergoflexCartV2';
let cartIdCounter = 0;
const nextCartId = () => `item-${Date.now()}-${cartIdCounter++}`;

// Constants for mathematically mapping 3D space to physical inches
const LIFT_MIN = -19.25;
const LIFT_MAX = 6.53;
const HEIGHT_MIN = 28.0;
const HEIGHT_MAX = 52.5;

// Telescoping ratio: how much center columns move relative to full lift
const TELESCOPING_RATIO = 0.5;

// Animation & Selection Variables
let isStanding = false;
let currentLift = LIFT_MIN;
let targetLift = LIFT_MIN;
let manualLiftOverride = false;
let movingObjects = []; // Editor selection; independent of lift membership.
const liftObjects = new Map();
let telescopingObjects = [];
let interactableObjects = [];
let sizeVariantParts = null;
let boxHelpers = new Map();
let isSelectionMode = false;

// Phase 2.0: Stable Editor IDs + Part Registry
let editorIdCounter = 0;
const partRegistry = new Map(); // editorId -> { obj, name, editorId, isClone }
const sceneAssetRegistry = new Map(); // editorId -> one whole room/desk-dressing prop
const sceneAssetStates = new Map();   // room id -> removed defaults, additions and local transforms
let sceneAssetCounter = 0;
let sceneAssetHydrationToken = 0;
const SCENE_ASSET_STATE_KEY = 'ergoflex.sceneAssets.v1';

function editorEntry(editorId) {
    return partRegistry.get(editorId) || sceneAssetRegistry.get(editorId);
}

function sceneAssetState(sceneId = selectedRoomScene) {
    // Apartment edits stay separate from the larger home office layout.
    const profile = measuredRoomProfile(sceneId);
    if (profile) sceneId = `${sceneId}:${(workspaceRoom?.id === sceneId ? workspaceRoom.roomLayout?.id : null) || profile.layout.id}`;
    if (!sceneAssetStates.has(sceneId)) {
        sceneAssetStates.set(sceneId, { removed: new Set(), added: new Map(), transforms: new Map() });
    }
    return sceneAssetStates.get(sceneId);
}

function plainLocalTransform(obj) {
    return {
        p: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        q: { x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w },
        s: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
    };
}

function applyPlainLocalTransform(obj, transform) {
    if (!transform) return;
    transform = roomLifeDisplayTransform(obj, transform);
    obj.position.set(transform.p.x, transform.p.y, transform.p.z);
    obj.quaternion.set(transform.q.x, transform.q.y, transform.q.z, transform.q.w);
    obj.scale.set(transform.s.x, transform.s.y, transform.s.z);
    obj.updateMatrixWorld(true);
}

function serializeSceneAssetStates() {
    captureActiveSceneAssetTransforms();
    return Object.fromEntries([...sceneAssetStates].map(([sceneId, state]) => [sceneId, {
        removed: [...state.removed],
        added: [...state.added.values()],
        transforms: Object.fromEntries(state.transforms)
    }]));
}

function restoreSceneAssetStates(value) {
    sceneAssetStates.clear();
    if (!value || typeof value !== 'object') return;
    for (const [sceneId, saved] of Object.entries(value)) {
        const state = sceneAssetState(sceneId);
        for (const id of saved.removed || []) state.removed.add(id);
        for (const addition of saved.added || []) {
            if (addition?.editorId && addition?.propId) state.added.set(addition.editorId, addition);
        }
        for (const [id, transform] of Object.entries(saved.transforms || {})) state.transforms.set(id, transform);
    }
}

function persistSceneAssetStates() {
    try { localStorage.setItem(SCENE_ASSET_STATE_KEY, JSON.stringify(serializeSceneAssetStates())); } catch (_) {}
}

try { restoreSceneAssetStates(JSON.parse(localStorage.getItem(SCENE_ASSET_STATE_KEY) || '{}')); } catch (_) {}

// --- Custom part names ---------------------------------------------------------
// editorId is immutable — baked tilt configs, actuator rigs and saved groups all key
// off it, and obj.name is what the loader's TELESCOPING_PARTS / INITIAL_ANIMATED_PARTS
// lookups match on. So a "rename" stores a display label alongside, and every export
// carries editorId + model name + label so a renamed part is still unambiguous.
const partLabels = new Map(); // editorId -> custom label
let lastSelectedEditorId = null;

function partLabel(eid) {
    if (!eid) return '';
    return partLabels.get(eid) || editorEntry(eid)?.name || eid;
}

function objLabel(obj) {
    return obj ? partLabel(obj.userData?.editorId) : '';
}

function persistPartLabels() {
    try { localStorage.setItem('ergoflexPartLabels', JSON.stringify([...partLabels])); } catch (e) {}
}

function restorePartLabels() {
    try {
        const saved = JSON.parse(localStorage.getItem('ergoflexPartLabels') || '[]');
        if (Array.isArray(saved)) saved.forEach(([k, v]) => { if (k && v) partLabels.set(k, v); });
    } catch (e) {}
}

function setPartLabel(eid, label) {
    if (!eid) return;
    const clean = (label || '').trim();
    const modelName = editorEntry(eid)?.name;
    if (clean && clean !== modelName) partLabels.set(eid, clean);
    else partLabels.delete(eid);
    persistPartLabels();
    refreshSelectedPartUI();
    buildSceneTree();
    const search = document.getElementById('part-search-input');
    if (search && search.value) onPartSearch(search.value);
    rebuildRigUI();
}

function sceneAssetEditorId(obj) {
    const key = obj?.userData?.sceneAssetKey;
    return key ? `scene:${key}` : null;
}

function sceneAssetName(obj) {
    const catalogName = PROP_LIBRARY.entry(obj?.userData?.propId)?.name;
    return catalogName || obj?.userData?.sceneAssetName || obj?.userData?.propId || obj?.name || 'Scene asset';
}

function selectionTarget(obj) {
    for (let node = obj; node; node = node.parent) {
        if (node.userData?.sceneAsset) return node;
    }
    return obj;
}

function registerSceneAsset(obj) {
    const editorId = sceneAssetEditorId(obj);
    if (!editorId || sceneAssetRegistry.has(editorId)) return;
    obj.userData.editorId = editorId;
    const entry = {
        obj, editorId, name: sceneAssetName(obj), kind: 'sceneAsset',
        propId: obj.userData.propId, isCustom: Boolean(obj.userData.sceneAssetCustom)
    };
    sceneAssetRegistry.set(editorId, entry);
    obj.traverse(child => {
        if (child.isMesh && !interactableObjects.includes(child)) interactableObjects.push(child);
    });
}

function unregisterSceneAsset(obj) {
    toggleMovingObject(obj, false, true);
    obj.traverse(child => {
        const index = interactableObjects.indexOf(child);
        if (index > -1) interactableObjects.splice(index, 1);
    });
    const editorId = obj.userData?.editorId || sceneAssetEditorId(obj);
    if (editorId) sceneAssetRegistry.delete(editorId);
}

function clearSceneAssetRegistration() {
    // Deselect first so the transform proxy returns assets to their real parent
    // before the old room and its mount groups are removed.
    [...sceneAssetRegistry.values()].forEach(entry => unregisterSceneAsset(entry.obj));
    sceneAssetRegistry.clear();
    updateTransformProxy();
    refreshSelectedPartUI();
}

function discardSceneAssetUndoEntries() {
    const clean = stack => stack.flatMap(entry => {
        if (entry.type === 'scene-assets') return [];
        if (entry.type !== 'transform') return [entry];
        const items = entry.items.filter(item => !item.obj.userData?.sceneAsset);
        return items.length ? [{ ...entry, items }] : [];
    });
    undoStack.splice(0, undoStack.length, ...clean(undoStack));
    redoStack.splice(0, redoStack.length, ...clean(redoStack));
    updateUndoBtn();
}

function canonicalTransformPlain(obj) {
    const transform = canonicalTransform(obj);
    return roomLifeBaseTransform(obj, transform ? {
        p: { x: transform.p.x, y: transform.p.y, z: transform.p.z },
        q: { x: transform.q.x, y: transform.q.y, z: transform.q.z, w: transform.q.w },
        s: { x: transform.s.x, y: transform.s.y, z: transform.s.z }
    } : plainLocalTransform(obj));
}

function captureActiveSceneAssetTransforms() {
    if (!sceneAssetRegistry.size) return;
    const state = sceneAssetState();
    sceneAssetRegistry.forEach(entry => state.transforms.set(entry.editorId, canonicalTransformPlain(entry.obj)));
}

async function hydrateSceneAssets(sceneId, token = sceneAssetHydrationToken) {
    if (sceneId !== selectedRoomScene || token !== sceneAssetHydrationToken) return;
    const state = sceneAssetState(sceneId);
    const defaults = [...(workspaceRoom?.assets() || []), ...(workspaceAccessories?.dressAssets() || [])];
    for (const obj of defaults) {
        const editorId = sceneAssetEditorId(obj);
        if (state.removed.has(editorId)) { obj.removeFromParent(); continue; }
        applyPlainLocalTransform(obj, state.transforms.get(editorId));
        registerSceneAsset(obj);
    }
    for (const addition of state.added.values()) {
        if (sceneId !== selectedRoomScene || token !== sceneAssetHydrationToken) return;
        const key = addition.editorId.replace(/^scene:/, '');
        const object = await workspaceRoom?.addAsset(addition.propId, key, addition.position || [0, 0, 800]);
        if (!object || sceneId !== selectedRoomScene || token !== sceneAssetHydrationToken) continue;
        applyPlainLocalTransform(object, state.transforms.get(addition.editorId));
        registerSceneAsset(object);
    }
    buildSceneTree();
    renderSceneAssetList();
    updateSceneLibraryStatus();
}

let selectedPartUIQueued = false;
function queueSelectedPartUI() {
    if (selectedPartUIQueued) return;
    selectedPartUIQueued = true;
    requestAnimationFrame(() => { selectedPartUIQueued = false; refreshSelectedPartUI(); });
}

function refreshSelectedPartUI() {
    const idEl = document.getElementById('selected-part-id');
    const emptyEl = document.getElementById('selected-part-empty');
    const bodyEl = document.getElementById('selected-part-body');
    if (!idEl || !emptyEl || !bodyEl) return;

    // Fall back to whatever is still selected if the tracked part was deselected
    let eid = lastSelectedEditorId;
    if (!eid || !editorEntry(eid) || !movingObjects.some(i => i.obj.userData.editorId === eid)) {
        const last = movingObjects[movingObjects.length - 1];
        eid = last ? last.obj.userData.editorId : null;
        lastSelectedEditorId = eid;
    }

    if (!eid) {
        idEl.textContent = '—';
        emptyEl.classList.remove('hidden');
        bodyEl.classList.add('hidden');
        bodyEl.classList.remove('flex');
        return;
    }

    const entry = editorEntry(eid);
    idEl.textContent = eid;
    emptyEl.classList.add('hidden');
    bodyEl.classList.remove('hidden');
    bodyEl.classList.add('flex');
    document.getElementById('selected-part-modelname').textContent = entry ? entry.name : '(missing)';
    const input = document.getElementById('selected-part-label');
    if (input && document.activeElement !== input) input.value = partLabels.get(eid) || '';
}

// Parent references live in Maps, NOT in userData: three.js deep-copies
// userData as JSON during clone()/export, and an Object3D reference there
// is a circular structure (crashes clone and the AR exporter).
const proxyOriginalParents = new Map(); // obj -> parent before transform-proxy attach
const animOriginalParents = new Map();  // obj -> parent before tilt/rig wrapper attach

// Phase 2.1: Named Groups
// Baked default groups — always available in the dropdown, survive everything.
// (Tilt_Desktop recovered from the group_Tilt_DeskTop.json export, all IDs verified.)
const BAKED_GROUPS = {
    "Tilt_Desktop": [
        "Desktop_1_4", "Desktop_2_5", "Desktop_3", "Desktop_3_6",
        "L_A_Hardware_Top_1_33", "L_A_Hardware_Top_3_35", "L_A_Hardware_Top_4_255",
        "L_A_Hardware_Top_6_257", "L_A_Hardware_Top_7_258", "mesh_692_692",
        "Power_1_1", "Power_2_2", "Power_4_8", "Power_7_11"
    ]
};
let savedGroups = {}; // groupName -> array of editorIds

// Phase 2.5: Debug panel collapse state

// Use vector distance to separate precise clicks from mouse movements
let mouseDownPos = new THREE.Vector2();
let isDraggingTransform = false; // Tracks if the 3D gizmo is actively being dragged
let blockCanvasClick = false; // Blocks selection toggle if interacting with the gizmo

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let scene, camera, renderer, controls, transformControl, transformProxy, loadedModel, floorMesh;
let trimMaterial = null;
let trimColor = '#dc0909';
let ledColor = '#f10404';
let ledGlow = LED_FULL_BRIGHTNESS * 0.75;
const LED_SURFACE_DEFAULTS = Object.freeze({
    desktopStrength: 157, desktopReach: 100, desktopWidth: 5,
    desktopCone: 100, desktopEdgeFade: 46, desktopSharpness: 62,
    shelfStrength: 176, shelfReach: 98,
    baseStrength: 54, baseReach: 20,
    topStrength: 143, topReach: 77,
    floorStrength: 156, floorReach: 4, floorWidth: 50, floorSharpness: 73,
    leftWingStrength: 111, leftWingReach: 85,
    rightWingStrength: 110, rightWingReach: 87
});
let ledSurfaces = { ...LED_SURFACE_DEFAULTS };
let ledEffect = normalizeLedEffect();
let ledEffectStart = performance.now() / 1000;
const ledFrameColor = new THREE.Color();
const ledReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let ledPixels = null;
const ledPixelFrame = createLedFrame();
let ledDiagnostic = { strip: null, pixel: null };
const ledMotion = new LedMotion();
const ledSounds = new LedSounds();
const ledGame = new LedGameMode(LED_STRIPS.map(s => s.count));
const ledMusic = new LedMusicMode(LED_STRIPS.map(s => s.count));
let customLedLook = null;
const customLookSampler = new CustomLookSampler(LED_STRIPS.map(s => s.count));
function applyCustomLedLook(value) {
    const look = normalizeCustomLook(value);
    ledGame.stop();ledMusic.stopDJ();setLedEffect({mode:'solid'}, false);
    const primary=look.strips[0].col[0];
    setLedColor('#'+primary.slice(0,3).map(channel=>Math.min(255,channel+primary[3]).toString(16).padStart(2,'0')).join(''), false);
    setLedGlow(look.bri / 255 * LED_FULL_BRIGHTNESS, false);
    customLookSampler.music.reset();customLookSampler.decorativeFrames.clear();
    customLedLook=look;setLedsEnabled(look.on);
    // Preset changes do not revoke a shared source, rewind a song or undo Pause.
    // A saved music recipe starts Music Mode only when it isn't already active.
    if(customLookUsesMusic(look)&&!ledMusic.active)ledMusic.start();
    ledMusic.syncUI();
    updateLedEffectFrame();
}
document.addEventListener('ergoflex-music-effect-selected',()=>{customLedLook=null;});
function applyCustomLedPalette(palette) {
    ledMusic.applyPalette(palette);
    const definition=ledMusic.paletteOverride;
    if(customLedLook)customLedLook={...customLedLook,strips:customLedLook.strips.map(strip=>({...strip,pal:0,palette:definition}))};
    else if(!ledMusic.active)customLedLook=normalizeCustomLook({name:definition.name,bri:255,on:true,strips:LED_STRIPS.map(({id})=>({id,fx:Number(ledEffect.mode.replace('fx-',''))||0,pal:0,col:[[255,255,255,0]],palette:definition,sx:128,ix:128}))});
    setLedsEnabled(true);updateLedEffectFrame();
}
let ledMotionEnabled = true, ledAutoLift = false, ledAutoTilt = false, ledPlaybackUIAt = 0;
let ledPixelSource = 'base';
try {
    if (!EVENT_DEMO) ledEffect = normalizeLedEffect(JSON.parse(localStorage.getItem(LED_EFFECT_KEY) || '{}'));
} catch (_) {}
try {
    const stored = localStorage.getItem(TRIM_COLOR_KEY);
    if (/^#[0-9a-f]{6}$/i.test(stored || '')) trimColor = stored;
    if (!EVENT_DEMO) {
        const storedLed = localStorage.getItem(LED_COLOR_KEY);
        if (/^#[0-9a-f]{6}$/i.test(storedLed || '')) ledColor = storedLed;
        const storedGlow = localStorage.getItem(LED_GLOW_KEY);
        if (storedGlow !== null && Number(storedGlow) >= 0)
            ledGlow = THREE.MathUtils.clamp(Number(storedGlow), 0, LED_FULL_BRIGHTNESS);
        const storedSurfaces = JSON.parse(localStorage.getItem(LED_SURFACE_KEY) || '{}');
        for (const key of Object.keys(LED_SURFACE_DEFAULTS)) {
            const value = storedSurfaces[key];
            if (value !== undefined && Number.isFinite(Number(value)))
                ledSurfaces[key] = THREE.MathUtils.clamp(Number(value), 0,
                    key.endsWith('Strength') ? 200 : 100);
        }
    }
} catch (_) {}
let workspaceAccessories = null, workspaceRoom = null, selectedRoomScene = 'product';
let roomInteractions = null, roomFurnitureSaveTimer = null, roomCollisionBlocked = false;
const roomLedSpill = new RoomLedSpill();
let roomLedGain = 0;
let roomGroove = null, grooveSettingPose = false;
let homeMode = 'afternoon', homeDeskReturn = null;
let homeLayoutId = 'apartment';
try { const stored = localStorage.getItem('ergoflex.homeLayout'); if (HOME_LAYOUTS[stored]) homeLayoutId = stored; } catch {}
function selectedHomeLayout() { return homeLayoutId ? homeLayoutById(homeLayoutId) : homeLayoutForSize(currentConfig.size); }
try { const stored = localStorage.getItem('ergoflex.homeMode'); if (HOME_MODES[stored]) homeMode = stored; } catch {}
let gamingMode = 'evening', gamingLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.gamingLayout'), mode = localStorage.getItem('ergoflex.gamingMode');
    if (GAMING_LAYOUTS[layout]) gamingLayoutId = layout;
    if (GAMING_MODES[mode]) gamingMode = mode;
} catch {}
function selectedGamingLayout() { return gamingLayoutId ? gamingLayoutById(gamingLayoutId) : gamingLayoutForSize(currentConfig.size); }
let musicMode = 'afternoon', musicLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.musicLayout'), mode = localStorage.getItem('ergoflex.musicMode');
    if (MUSIC_LAYOUTS[layout]) musicLayoutId = layout;
    if (MUSIC_MODES[mode]) musicMode = mode;
} catch {}
function selectedMusicLayout() { return musicLayoutId ? musicLayoutById(musicLayoutId) : musicLayoutForSize(currentConfig.size); }
let artistMode = 'afternoon', artistLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.creativeLayout'), mode = localStorage.getItem('ergoflex.creativeMode');
    if (ARTIST_LAYOUTS[layout]) artistLayoutId = layout;
    if (ARTIST_MODES[mode]) artistMode = mode;
} catch {}
function selectedArtistLayout() { return artistLayoutId ? artistLayoutById(artistLayoutId) : artistLayoutForSize(currentConfig.size); }
let studyMode = 'afternoon', studyLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.studyLayout'), mode = localStorage.getItem('ergoflex.studyMode');
    if (STUDY_LAYOUTS[layout]) studyLayoutId = layout;
    if (STUDY_MODES[mode]) studyMode = mode;
} catch {}
function selectedStudyLayout() { return studyLayoutId ? studyLayoutById(studyLayoutId) : studyLayoutForSize(currentConfig.size); }
let officeMode = 'afternoon', officeLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.officeLayout'), mode = localStorage.getItem('ergoflex.officeMode');
    if (OFFICE_LAYOUTS[layout]) officeLayoutId = layout;
    if (OFFICE_MODES[mode]) officeMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'office' && OFFICE_LAYOUTS[query.get('layout')]) officeLayoutId = query.get('layout');
} catch {}
function selectedOfficeLayout() { return officeLayoutId ? officeLayoutById(officeLayoutId) : officeLayoutForSize(currentConfig.size); }
let gymMode = 'morning', gymLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.gymLayout'), mode = localStorage.getItem('ergoflex.gymMode');
    if (GYM_LAYOUTS[layout]) gymLayoutId = layout;
    if (GYM_MODES[mode]) gymMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'gym' && GYM_LAYOUTS[query.get('layout')]) gymLayoutId = query.get('layout');
} catch {}
function selectedGymLayout() { return gymLayoutId ? gymLayoutById(gymLayoutId) : gymLayoutForSize(currentConfig.size); }
let kitchenMode = 'morning', kitchenLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.kitchenLayout'), mode = localStorage.getItem('ergoflex.kitchenMode');
    if (KITCHEN_LAYOUTS[layout]) kitchenLayoutId = layout;
    if (KITCHEN_MODES[mode]) kitchenMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'kitchen' && KITCHEN_LAYOUTS[query.get('layout')]) kitchenLayoutId = query.get('layout');
} catch {}
function selectedKitchenLayout() { return kitchenLayoutId ? kitchenLayoutById(kitchenLayoutId) : kitchenLayoutForSize(currentConfig.size); }
let libraryMode = 'morning', libraryLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.libraryLayout'), mode = localStorage.getItem('ergoflex.libraryMode');
    if (LIBRARY_LAYOUTS[layout]) libraryLayoutId = layout;
    if (LIBRARY_MODES[mode]) libraryMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'library' && LIBRARY_LAYOUTS[query.get('layout')]) libraryLayoutId = query.get('layout');
} catch {}
function selectedLibraryLayout() { return libraryLayoutId ? libraryLayoutById(libraryLayoutId) : libraryLayoutForSize(currentConfig.size); }
let coworkingMode = 'morning', coworkingLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.coworkingLayout'), mode = localStorage.getItem('ergoflex.coworkingMode');
    if (COWORKING_LAYOUTS[layout]) coworkingLayoutId = layout;
    if (COWORKING_MODES[mode]) coworkingMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'coworking' && COWORKING_LAYOUTS[query.get('layout')]) coworkingLayoutId = query.get('layout');
} catch {}
function selectedCoworkingLayout() { return coworkingLayoutId ? coworkingLayoutById(coworkingLayoutId) : coworkingLayoutForSize(currentConfig.size); }
let scifiMode = 'morning', scifiLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.scifiLayout'), mode = localStorage.getItem('ergoflex.scifiMode');
    if (SCIFI_LAYOUTS[layout]) scifiLayoutId = layout;
    if (SCIFI_MODES[mode]) scifiMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'scifi' && SCIFI_LAYOUTS[query.get('layout')]) scifiLayoutId = query.get('layout');
} catch {}
function selectedScifiLayout() { return scifiLayoutId ? scifiLayoutById(scifiLayoutId) : scifiLayoutForSize(currentConfig.size); }
let galleryMode = 'morning', galleryLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.galleryLayout'), mode = localStorage.getItem('ergoflex.galleryMode');
    if (GALLERY_LAYOUTS[layout]) galleryLayoutId = layout;
    if (GALLERY_MODES[mode]) galleryMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'gallery' && GALLERY_LAYOUTS[query.get('layout')]) galleryLayoutId = query.get('layout');
} catch {}
function selectedGalleryLayout() { return galleryLayoutId ? galleryLayoutById(galleryLayoutId) : galleryLayoutForSize(currentConfig.size); }
let bedroomMode = 'morning', bedroomLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.bedroomLayout'), mode = localStorage.getItem('ergoflex.bedroomMode');
    if (BEDROOM_LAYOUTS[layout]) bedroomLayoutId = layout;
    if (BEDROOM_MODES[mode]) bedroomMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'bedroom' && BEDROOM_LAYOUTS[query.get('layout')]) bedroomLayoutId = query.get('layout');
} catch {}
function selectedBedroomLayout() { return bedroomLayoutId ? bedroomLayoutById(bedroomLayoutId) : bedroomLayoutForSize(currentConfig.size); }
let workshopMode = 'morning', workshopLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.workshopLayout'), mode = localStorage.getItem('ergoflex.workshopMode');
    if (WORKSHOP_LAYOUTS[layout]) workshopLayoutId = layout;
    if (WORKSHOP_MODES[mode]) workshopMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'workshop' && WORKSHOP_LAYOUTS[query.get('layout')]) workshopLayoutId = query.get('layout');
} catch {}
function selectedWorkshopLayout() { return workshopLayoutId ? workshopLayoutById(workshopLayoutId) : workshopLayoutForSize(currentConfig.size); }
let loungeMode = 'afternoon', loungeLayoutId = null;
try {
    const layout = localStorage.getItem('ergoflex.loungeLayout'), mode = localStorage.getItem('ergoflex.loungeMode');
    if (LOUNGE_LAYOUTS[layout]) loungeLayoutId = layout;
    if (LOUNGE_MODES[mode]) loungeMode = mode;
    const query = new URLSearchParams(location.search);
    if (query.get('room') === 'lounge' && LOUNGE_LAYOUTS[query.get('layout')]) loungeLayoutId = query.get('layout');
} catch {}
function selectedLoungeLayout() { return loungeLayoutId ? loungeLayoutById(loungeLayoutId) : loungeLayoutForSize(currentConfig.size); }
function measuredRoomPanelId(id) { return id === 'home' ? 'home-office-controls' : `${id}-room-controls`; }
function measuredRoomProfile(id = selectedRoomScene) {
    if (id === 'library') return { id, layouts: LIBRARY_LAYOUTS, modes: LIBRARY_MODES, layout: selectedLibraryLayout(), mode: libraryMode, prefix: 'library' };
    if (id === 'coworking') return { id, layouts: COWORKING_LAYOUTS, modes: COWORKING_MODES, layout: selectedCoworkingLayout(), mode: coworkingMode, prefix: 'coworking' };
    if (id === 'bedroom') return { id, layouts: BEDROOM_LAYOUTS, modes: BEDROOM_MODES, layout: selectedBedroomLayout(), mode: bedroomMode, prefix: 'bedroom' };
    if (id === 'gallery') return { id, layouts: GALLERY_LAYOUTS, modes: GALLERY_MODES, layout: selectedGalleryLayout(), mode: galleryMode, prefix: 'gallery' };
    if (id === 'scifi') return { id, layouts: SCIFI_LAYOUTS, modes: SCIFI_MODES, layout: selectedScifiLayout(), mode: scifiMode, prefix: 'scifi' };
    if (id === 'workshop') return { id, layouts: WORKSHOP_LAYOUTS, modes: WORKSHOP_MODES, layout: selectedWorkshopLayout(), mode: workshopMode, prefix: 'workshop' };
    if (id === 'home') return { id, layouts: HOME_LAYOUTS, modes: HOME_MODES, layout: selectedHomeLayout(), mode: homeMode, prefix: 'home' };
    if (id === 'gaming') return { id, layouts: GAMING_LAYOUTS, modes: GAMING_MODES, layout: selectedGamingLayout(), mode: gamingMode, prefix: 'gaming' };
    if (id === 'music') return { id, layouts: MUSIC_LAYOUTS, modes: MUSIC_MODES, layout: selectedMusicLayout(), mode: musicMode, prefix: 'music' };
    if (id === 'creative') return { id, layouts: ARTIST_LAYOUTS, modes: ARTIST_MODES, layout: selectedArtistLayout(), mode: artistMode, prefix: 'artist' };
    if (id === 'office') return { id, layouts: OFFICE_LAYOUTS, modes: OFFICE_MODES, layout: selectedOfficeLayout(), mode: officeMode, prefix: 'office' };
    if (id === 'lounge') return { id, layouts: LOUNGE_LAYOUTS, modes: LOUNGE_MODES, layout: selectedLoungeLayout(), mode: loungeMode, prefix: 'lounge' };
    if (id === 'kitchen') return { id, layouts: KITCHEN_LAYOUTS, modes: KITCHEN_MODES, layout: selectedKitchenLayout(), mode: kitchenMode, prefix: 'kitchen' };
    if (id === 'gym') return { id, layouts: GYM_LAYOUTS, modes: GYM_MODES, layout: selectedGymLayout(), mode: gymMode, prefix: 'gym' };
    if (id === 'study') return { id, layouts: STUDY_LAYOUTS, modes: STUDY_MODES, layout: selectedStudyLayout(), mode: studyMode, prefix: 'study' };
    return null;
}
let sceneLights = null;
const roomLightSettings = {};
let accessoryCategory = 'Desktop';
let sharedBirchMaterial = null;
let sharedBasePaintMaterial = null;
let sharedPolishedAluminumMaterial = null;
let sharedBlackPlasticMaterial = null;
let sharedBlackMetalMaterial = null;

const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

const BIRCH_COLORS = ["eaeda2", "ebee87", "ffff00", "bbff00"];
const BASE_PAINT_COLORS = ["4fa5bd", "51b8d3", "51d0ef", "d4b3e6", "ffbbff", "689bad"];
const POLISHED_ALUMINUM_COLORS = ["e8e800", "7ec7f9", "ce8ca4", "000000", "4db6c1", "e7e7e7", "00ffff", "ff0000", "6288aa", "bbffe0", "babb95", "a5f1d0"];
const BLACK_PLASTIC_COLORS = ["0000ff", "e6dabd"];
const BLACK_METAL_COLORS = ["7c5f5f", "75b4bd"];

const canvas = document.getElementById('model-canvas');
const loader = document.getElementById('loader');
const woodFinishesGrid = document.getElementById('wood-finishes');
const baseFinishesGrid = document.getElementById('base-finishes');
const sizeSelect = document.getElementById('size-select');
const totalPrice = document.getElementById('total-price');
const cartPrice = document.getElementById('cart-price');
const addToCartBtn = document.getElementById('add-to-cart');
const cartCount = document.getElementById('cart-count');

// Desk Height Slider Elements
let deskHeightSlider, toggleHeightBtn, selectionModeToggle, selectedPartsCount, copyPartsBtn, clearPartsBtn;

function liftToHeight(l) {
    return HEIGHT_MIN + ((l - LIFT_MIN) / (LIFT_MAX - LIFT_MIN)) * (HEIGHT_MAX - HEIGHT_MIN);
}

function heightToLift(h) {
    return LIFT_MIN + ((h - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * (LIFT_MAX - LIFT_MIN);
}

// One collapse mechanism. The app had four — this accordion, the debug panel's
// display:none toggle, the scene tree's inline style toggle, and a native
// <details> — so a fifth for the motion dock would have been the wrong move.
//
// `storageKey` is optional; when given, the state is remembered per section.
// `onToggle` lets a caller react, which the motion dock needs because
// syncViewerSize derives the canvas height from the dock's height.
const collapsibles = new Map();

function setCollapsed(sectionId, collapsed, { persist = true } = {}) {
    const entry = collapsibles.get(sectionId);
    const content = document.getElementById(entry?.contentId || `${sectionId}-content`);
    const arrow = document.getElementById(entry?.arrowId || `${sectionId}-arrow`);
    if (!content) return;
    // Two modes on purpose. The store accordion animates a max-height, which is
    // right for short sections; a tall panel like the debug tools would be
    // clipped by that ceiling, so it toggles display instead.
    if (entry?.mode === 'display') content.style.display = collapsed ? 'none' : '';
    else content.classList.toggle('expanded', !collapsed);
    if (arrow) arrow.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    const header = document.querySelector(`[aria-controls="${sectionId}-content"]`);
    if (header) header.setAttribute('aria-expanded', String(!collapsed));
    if (entry) {
        entry.collapsed = collapsed;
        if (persist && entry.storageKey) {
            try { localStorage.setItem(entry.storageKey, String(collapsed)); } catch {}
        }
        entry.onToggle?.(collapsed);
    }
}

function makeCollapsible(sectionId, { storageKey = null, defaultCollapsed = false, onToggle = null,
                                      mode = 'max-height', contentId = null, arrowId = null } = {}) {
    let collapsed = defaultCollapsed;
    if (storageKey) {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored !== null) collapsed = stored === 'true';
        } catch {}
    }
    collapsibles.set(sectionId, { storageKey, onToggle, collapsed, mode, contentId, arrowId });
    setCollapsed(sectionId, collapsed, { persist: false });
    return () => setCollapsed(sectionId, !collapsibles.get(sectionId).collapsed);
}

window.toggleSection = function(sectionId) {
    const entry = collapsibles.get(sectionId);
    const content = document.getElementById(`${sectionId}-content`);
    const collapsed = entry ? entry.collapsed : content?.classList.contains('expanded');
    setCollapsed(sectionId, !collapsed);
}

// Custom studio environment: softbox panels around a dark shell.
// Gives shaped, product-shot reflections (long highlights on the desktop,
// crisp gradients on metal) instead of RoomEnvironment's flat gray sheen.
function createStudioEnvironment() {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x1e1f22);

    const panel = (w, h, intensity, x, y, z) => {
        const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        mat.color.setScalar(intensity);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        envScene.add(mesh);
        return mesh;
    };

    panel(14, 7, 3.2, 0, 9, 0.01);   // main overhead softbox
    panel(4, 10, 2.6, -9, 3, 2);     // tall key-side strip (left)
    panel(4, 8, 1.4, 9, 2.5, 3);     // soft fill card (right)
    panel(10, 2.5, 3.0, 0, 4, -9);   // back rim strip for edge highlights
    panel(12, 12, 0.55, 0, -6, 0);   // dim floor bounce for undersides

    return envScene;
}

// Three.js renders translate, rotate and scale as separate gizmos. This wrapper
// layers the three handle families around one object, arbitrates overlapping
// hit targets, and exposes the same small API the rest of the editor already
// uses. A gesture can therefore move, rotate OR scale while producing one undo
// transaction, without a mode switch in between.
class UnifiedTransformGumball extends THREE.Group {
    constructor(camera, domElement) {
        super();
        this.type = 'UnifiedTransformGumball';
        this.mode = 'unified';
        this._object = undefined;
        this._active = null;
        this._sizes = { translate: 1.45, rotate: 1.05, scale: 0.78 };
        // Scale pickers get first refusal where their cubes cross a translation
        // shaft; the longer arrowheads remain an unambiguous move target.
        this.controls = ['scale', 'rotate', 'translate'].map(mode => {
            const control = new TransformControls(camera, domElement);
            control.setMode(mode);
            control.setSize(this._sizes[mode]);
            control.addEventListener('objectChange', () => {
                if (!this._active || this._active === control) this.dispatchEvent({ type: 'objectChange', mode });
            });
            control.addEventListener('dragging-changed', event => this.onDraggingChanged(control, mode, event.value));
            this.add(control);
            return control;
        });
        this._capturePointerDown = event => {
            if (!this._object || this._active || this.mode !== 'unified' || event.button !== 0) return;
            const rect = domElement.getBoundingClientRect();
            const pointer = {
                x: (event.clientX - rect.left) / rect.width * 2 - 1,
                y: -(event.clientY - rect.top) / rect.height * 2 + 1,
                button: event.button
            };
            this.controls.forEach(control => { control.enabled = true; control.pointerHover(pointer); });
            const winner = this.controls.find(control => control.axis !== null);
            if (winner) this.controls.forEach(control => {
                if (control !== winner) { control.enabled = false; control.axis = null; }
            });
        };
        domElement.addEventListener('pointerdown', this._capturePointerDown, true);
        this._resolveHover = () => {
            if (this._active || this.mode !== 'unified') return;
            const hovered = this.controls.find(control => control.enabled && control.axis !== null);
            if (hovered) this.controls.forEach(control => { if (control !== hovered) control.axis = null; });
        };
        // Runs after the child controls' hover listeners, leaving exactly one
        // highlighted handle when invisible picker volumes overlap.
        domElement.addEventListener('pointermove', this._resolveHover);
        this.domElement = domElement;
    }

    onDraggingChanged(control, mode, dragging) {
        if (dragging) {
            if (this._active && this._active !== control) return;
            this._active = control;
            this.controls.forEach(other => {
                if (other !== control) { other.enabled = false; other.axis = null; }
            });
            this.dispatchEvent({ type: 'dragging-changed', value: true, mode });
            return;
        }
        if (this._active !== control) return;
        this.dispatchEvent({ type: 'dragging-changed', value: false, mode });
        this._active = null;
        // Defer until every TransformControls pointerup listener on the shared
        // canvas has finished handling the current event.
        setTimeout(() => this.syncEnabledModes(), 0);
    }

    syncEnabledModes() {
        const enabledModes = this.mode === 'unified' ? new Set(['translate', 'rotate', 'scale']) : new Set([this.mode]);
        this.controls.forEach(control => {
            const on = Boolean(this._object) && enabledModes.has(control.mode);
            control.enabled = on;
            control.visible = on;
            if (!on) control.axis = null;
        });
    }

    attach(object) {
        this._object = object;
        this.controls.forEach(control => control.attach(object));
        this.syncEnabledModes();
        return this;
    }

    detach() {
        this._object = undefined;
        this._active = null;
        this.controls.forEach(control => { control.detach(); control.enabled = false; });
        return this;
    }

    setMode(mode) {
        this.mode = ['translate', 'rotate', 'scale'].includes(mode) ? mode : 'unified';
        this.syncEnabledModes();
        return this;
    }

    setSize(size) {
        const factor = size / 1.5;
        this.controls.forEach(control => control.setSize(this._sizes[control.mode] * factor));
        return this;
    }

    setSpace(space) { this.controls.forEach(control => control.setSpace(space)); return this; }
    setTranslationSnap(value) { this.controls.forEach(control => control.setTranslationSnap(value)); return this; }
    setRotationSnap(value) { this.controls.forEach(control => control.setRotationSnap(value)); return this; }
    setScaleSnap(value) { this.controls.forEach(control => control.setScaleSnap(value)); return this; }

    controlFor(mode) { return this.controls.find(control => control.mode === mode); }
    get object() { return this._object; }
    get dragging() { return Boolean(this._active?.dragging); }
    get axis() { return this._active?.axis || this.controls.find(control => control.axis !== null)?.axis || null; }
    get space() { return this.controlFor('translate').space; }
    get translationSnap() { return this.controlFor('translate').translationSnap; }
    get rotationSnap() { return this.controlFor('rotate').rotationSnap; }
    get scaleSnap() { return this.controlFor('scale').scaleSnap; }

    dispose() {
        this.domElement.removeEventListener('pointermove', this._resolveHover);
        this.domElement.removeEventListener('pointerdown', this._capturePointerDown, true);
        this.controls.forEach(control => control.dispose());
    }
}

function initThreeJS() {
    const container = canvas.parentElement;
    scene = new THREE.Scene();

    // Transparent canvas — the CSS studio-gradient backdrop shows through
    scene.background = null;

    camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(STARTING_POS.x, STARTING_POS.y, STARTING_POS.z);

    // WebGL can be unavailable (GPU process crash, hardware acceleration off).
    // Fail gracefully instead of dying with an endless spinner.
    try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    } catch (e) {
        console.error('[ErgoFlex] WebGL context creation failed:', e);
        showWebGLError();
        return;
    }
    renderer.setClearColor(0x000000, 0);
    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        showContextLostOverlay();
    }, false);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, EVENT_DEMO && matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.001;
    controls.target.set(STARTING_TARGET.x, STARTING_TARGET.y, STARTING_TARGET.z);

    // Gentle idle spin (enabled once the model loads), stops on first interaction
    controls.autoRotateSpeed = 0.9;
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    // Master Group to easily manipulate multiple selected parts from their combined center
    transformProxy = new THREE.Group();
    scene.add(transformProxy);

    // Initialize TransformControls
    transformControl = new UnifiedTransformGumball(camera, renderer.domElement);
    transformControl.setSize(1.5); // Make the gizmo large and easy to grab
    transformControl.addEventListener('objectChange', () => {
        if (pivotGizmoOn && transformControl.object === pivotMarker) {
            syncPivotInputs(pivotFromMarker());
        }
    });

    transformControl.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;
        isDraggingTransform = event.value;

        // Snapshot world matrices at drag start, commit at drag end. commitTransform
        // is the single place an edit is recorded — it pushes the undo entry, stores
        // the canonical transform, and re-derives the lift baseline. Numeric fields
        // and alignment tools go through the same call.
        if (event.value) {
            pendingTransformSnapshot = [...transformProxy.children].map(obj => {
                obj.updateWorldMatrix(true, false);
                return { obj: obj, before: obj.matrixWorld.clone() };
            });
        } else if (pendingTransformSnapshot) {
            commitTransform(pendingTransformSnapshot);
            pendingTransformSnapshot = null;
        }
    });
    scene.add(transformControl);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(createStudioEnvironment(), 0.06).texture;
    scene.environmentIntensity = 1.15;
    pmremGenerator.dispose();

    // Shadow-catcher floor: renders ONLY the soft shadow over the CSS backdrop
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.24 });
    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Studio setup: hemisphere ambience + warm key + cool fill + rim
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd1d6, 0.35);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff9f0, 1.5);
    keyLight.position.set(4.5, 8, 5.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.setScalar(EVENT_DEMO && matchMedia('(pointer: coarse)').matches ? 1024 : 2048);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0002;
    keyLight.shadow.normalBias = 0.004;
    keyLight.shadow.radius = 8;
    keyLight.shadow.blurSamples = 16;
    scene.add(keyLight, keyLight.target);

    const fillLight = new THREE.DirectionalLight(0xe8f0ff, 0.35);
    fillLight.position.set(-6, 3.5, 3);
    scene.add(fillLight, fillLight.target);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
    rimLight.position.set(-4, 5.5, -7.5);
    scene.add(rimLight, rimLight.target);
    sceneLights = { key: keyLight, fill: fillLight, rim: rimLight, hemi: hemiLight };

    // Pointer events for ultra-reliable click detection
    renderer.domElement.addEventListener('pointerdown', (e) => {
        // If the user is clicking on or dragging the 3D Gizmo, block the canvas selection logic!
        if (transformControl && (transformControl.axis !== null || isDraggingTransform)) {
            blockCanvasClick = true;
            return;
        }
        blockCanvasClick = false;
        mouseDownPos.set(e.clientX, e.clientY);
    });

    // Shift/Alt + left-drag (or plain left-drag in sticky mode) starts a
    // rubber-band box select instead of orbiting the camera.
    //
    // This has to run in the CAPTURE phase on window: OrbitControls and
    // TransformControls both listen on the canvas itself, and same-element
    // listeners fire in registration order — they were registered first, so a
    // canvas-level handler here would let an orbit start before we could stop
    // it. Capturing on an ancestor gets us ahead of all of them, and
    // stopPropagation keeps the drag from reaching them at all.
    window.addEventListener('pointerdown', (e) => {
        if (e.target !== renderer.domElement) return;
        if (e.button !== 0 || !isSelectionMode) return;
        if (transformControl && (transformControl.axis !== null || isDraggingTransform)) return;
        if (!wantsMarquee(e)) return;

        beginMarquee(e);
        e.stopPropagation();
    }, true);

    renderer.domElement.addEventListener('pointermove', (e) => {
        if (marquee.active) { updateMarquee(e); return; }
        if (isPickModeActive()) updatePickHover(e);
    });

    renderer.domElement.addEventListener('pointerleave', () => {
        if (isPickModeActive()) clearHoverHighlight();
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        if (marquee.active) {
            endMarquee(e);
            return;
        }
        if (blockCanvasClick) return; // Do not fire selection logic if we just used the gizmo

        const mouseUpPos = new THREE.Vector2(e.clientX, e.clientY);
        if (mouseDownPos.distanceTo(mouseUpPos) < 5) {
            onCanvasClick(e);
        }
    });

    renderer.domElement.addEventListener('pointercancel', () => {
        if (marquee.active) cancelMarquee();
    });

    roomInteractions = new RoomInteractions({canvas:renderer.domElement,camera,controls,scene,
        room:()=>workspaceRoom,deskBox:deskCollisionBox,deskObject:()=>loadedModel,safety:roomSafety,
        enabled:()=>!!workspaceRoom?.root&&!liveAR?.active&&!isSelectionMode&&!isDraggingTransform&&!roomGroove?.run,
        onSelection:entry=>{
            const toolbar=document.getElementById('room-object-controls');if(!toolbar)return;
            toolbar.hidden=!entry;
            toolbar.querySelector('[data-room-object-name]').textContent=entry?.name||'';
            toolbar.querySelectorAll('[data-room-object-turn]').forEach(button=>button.hidden=entry?.surface!=='floor');
        },
        onStatus:notifyUser,onChange:()=>{
            if(roomGroove?.prepared)roomGroove.reset();
            clearTimeout(roomFurnitureSaveTimer);
            roomFurnitureSaveTimer=setTimeout(persistSceneAssetStates,350);
        }});
    loadModel();

    window.addEventListener('resize', syncViewerSize);

    // The viewer changes size without a window resize (entering/leaving setup
    // mode, dragging the sidebar splitter), so watch the container directly.
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
        // The panel floats inside this box, so a change in its shape is exactly
        // when a saved panel position can fall outside the usable area.
        new ResizeObserver(() => { syncViewerSize(); clampDockPosition(); }).observe(canvas.parentElement);
    }

    renderer.xr.enabled = true;
    renderer.setAnimationLoop(animate);
}

// --- Undo system for setup edits ---
// Undoable: transform gizmo drags, part clones, tilt config saves.
const undoStack = [];
const redoStack = [];
const UNDO_LIMIT = 50;
let pendingTransformSnapshot = null;

function pushUndo(entry) {
    undoStack.push(entry);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    // A new edit invalidates the redo branch, as everywhere else.
    redoStack.length = 0;
    updateUndoBtn();
}

function updateUndoBtn() {
    const btn = document.getElementById('undo-btn');
    if (btn) {
        btn.disabled = undoStack.length === 0;
        btn.textContent = undoStack.length ? 'Undo (' + undoStack.length + ')' : 'Undo';
    }
    const redoBtn = document.getElementById('redo-btn');
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.textContent = redoStack.length ? 'Redo (' + redoStack.length + ')' : 'Redo';
    }
    refreshTransformInspector();
}

// Restores a world-space matrix onto an object regardless of its current parent
// (original parent, transform proxy, or tilt wrapper).
function setWorldMatrix(obj, matrix) {
    if (!obj.parent) return;
    obj.parent.updateWorldMatrix(true, false);
    const local = new THREE.Matrix4().copy(obj.parent.matrixWorld).invert().multiply(matrix);
    local.decompose(obj.position, obj.quaternion, obj.scale);
    obj.updateMatrixWorld(true);
}

// --- Canonical edit transforms ---------------------------------------------
//
// A part's canonical transform is its local TRS in the parent it actually
// belongs to in the model, independent of where the editor has temporarily
// parented it. Selection reparents onto transformProxy and rigs reparent into
// wrapper groups, so obj.position is routinely expressed in some other space.
//
// This matters most for baseY. updateMovingObjectsPosition writes
//   obj.position.y = baseY + liftOffset
// so baseY has to be a local Y in the part's settled parent. Reading
// obj.position.y at drag-commit time would read a proxy-local value, which is
// why the old code declined to update baseY at all — and why a vertical edit to
// a lift member used to be silently overwritten by the stale baseY on the next
// height change.

// The pristine local TRS of every part, captured once at load before any rig
// builds. Sizing recomputes from this, never from the live scene, so repeated
// resizes cannot accumulate drift. User edits are composed on top of it.
const assetBaseline = new Map();   // editorId -> canonical TRS as authored

const editTransforms = new Map();  // editorId -> canonical TRS after user edits
let editRevision = 0;              // bumped by every edit; a validation cache key
let suppressTransactions = false;  // set while neutralising, so housekeeping is not an edit

const _canonM = new THREE.Matrix4();
const _canonP = new THREE.Vector3();
const _canonQ = new THREE.Quaternion();
const _canonS = new THREE.Vector3();

// Walks out through the transform proxy and any animation wrapper. The anim
// entry wins when both exist: a selected part inside a tilt wrapper has
// proxyOriginalParents pointing at the wrapper and animOriginalParents pointing
// at the model parent, and the model parent is the canonical one.
function canonicalParent(obj) {
    const parent = animOriginalParents.get(obj)
        || proxyOriginalParents.get(obj)
        || (obj.parent === transformProxy ? null : obj.parent);
    return parent || loadedModel || obj.parent;
}

function canonicalTransform(obj) {
    const parent = canonicalParent(obj);
    if (!parent) return null;
    obj.updateWorldMatrix(true, false);
    parent.updateWorldMatrix(true, false);
    _canonM.copy(parent.matrixWorld).invert().multiply(obj.matrixWorld);
    _canonM.decompose(_canonP, _canonQ, _canonS);
    return { p: _canonP.clone(), q: _canonQ.clone(), s: _canonS.clone() };
}

// Re-derives the lift baseline from the canonical transform. Mutates the entry
// in place: movingObjects and liftObjects share entry objects for parts that
// joined at load time, and replacing one would desynchronise the other.
function refreshLiftBaseline(obj) {
    const canon = canonicalTransform(obj);
    if (!canon) return;
    const liftOffset = currentLift - LIFT_MIN;
    const lift = liftObjects.get(obj);
    if (lift) lift.baseY = canon.p.y - liftOffset;
    const tele = telescopingObjects.find(item => item.obj === obj);
    if (tele) tele.baseY = canon.p.y - liftOffset * TELESCOPING_RATIO;
}

// Records one part's edit. Every edit path ends here.
function captureAssetBaseline(obj) {
    const editorId = obj.userData?.editorId;
    if (!editorId || obj.userData?.sceneAsset || assetBaseline.has(editorId)) return;
    const canon = canonicalTransform(obj);
    if (canon) assetBaseline.set(editorId, canon);
}

function recordCanonicalEdit(obj) {
    const editorId = obj.userData?.editorId;
    if (editorId && obj.userData?.sceneAsset) {
        sceneAssetState().transforms.set(editorId, canonicalTransformPlain(obj));
        persistSceneAssetStates();
    } else if (editorId) {
        editTransforms.set(editorId, canonicalTransform(obj));
    }
    refreshLiftBaseline(obj);
}

// The single commit point for transform edits: gizmo drags, numeric fields and
// alignment tools all call this, so they produce identical undo entries and
// identical bookkeeping. Returns whether anything actually moved.
function commitTransform(items) {
    if (!items || !items.length) return false;
    const changed = items.filter(item => {
        item.obj.updateWorldMatrix(true, false);
        return !item.obj.matrixWorld.equals(item.before);
    });
    if (!changed.length) return false;
    changed.forEach(item => { item.after = item.obj.matrixWorld.clone(); });
    transaction({ type: 'transform', items: changed });
    changed.forEach(item => recordCanonicalEdit(item.obj));
    return true;
}

// Undoable mutation. pushUndo is the raw stack push; this is what callers use,
// so that every recorded edit also advances the revision counter.
function transaction(entry) {
    if (suppressTransactions) return;
    editRevision++;
    pushUndo(entry);
    scheduleAutosave();
}

// A mutation that changed the scene without pushing its own undo entry
// (undo and redo themselves, imports, resizes).
function markEdited() {
    if (suppressTransactions) return;
    editRevision++;
}

// --- Neutral pose ----------------------------------------------------------
//
// Lift, tilt, glide and wheel spin all write into part transforms, so anything
// that captures or compares geometry has to establish a rest pose first.
// buildActuatorRig already does this for tilt when capturing rest state; this
// generalises it to every motion source.
//
// Two guards matter. Motion is paused so a requestAnimationFrame tick cannot
// advance the lift mid-capture, and transactions are suppressed so neutralising
// does not register as a user edit. Restore runs in a finally block: a
// half-neutralised scene left behind by a throw is worse than a failed save.
let motionPaused = false;

function withNeutralPose(fn) {
    const saved = {
        currentLift, targetLift, manualLiftOverride,
        tilt: tiltConfigs.map(c => c.currentDeg),
        glide: glideOffset.clone(),
        glideTarget: glideTarget.clone(),
        spins: wheelRigs.map(r => r.spin),
        suppressed: suppressTransactions,
        paused: motionPaused
    };
    motionPaused = true;
    suppressTransactions = true;
    try {
        if (glideOffset.lengthSq() > 0) applyGlideOffset(new THREE.Vector3(0, 0, 0));
        wheelRigs.forEach(rig => { rig.spin = 0; rig.wrapper.rotation.z = 0; });
        // Neutral here means the authored GLB transform, which is the physical
        // -5-degree desk pose. Keep the editor's numeric neutral at zero while
        // clearing the wrapper rotation directly for transform deltas.
        tiltConfigs.forEach(config => {
            config.currentDeg = 0;
            config.wrapperGroup.rotation.set(0, 0, 0);
            config.wrapperGroup.updateMatrixWorld(true);
        });
        updateActuatorRigs();
        manualLiftOverride = true;
        currentLift = LIFT_MIN;
        targetLift = LIFT_MIN;
        updateMovingObjectsPosition();
        return fn();
    } finally {
        currentLift = saved.currentLift;
        targetLift = saved.targetLift;
        manualLiftOverride = saved.manualLiftOverride;
        updateMovingObjectsPosition();
        tiltConfigs.forEach((config, i) => {
            if (saved.tilt[i] !== undefined) { config.currentDeg = saved.tilt[i]; applyTiltConfig(config); }
        });
        applyGlideOffset(saved.glide);
        glideTarget.copy(saved.glideTarget);
        wheelRigs.forEach((rig, i) => {
            if (saved.spins[i] !== undefined) { rig.spin = saved.spins[i]; rig.wrapper.rotation.z = rig.spin; }
        });
        suppressTransactions = saved.suppressed;
        motionPaused = saved.paused;
    }
}

// Secondary Office desks are pose snapshots of the actual current desk model.
// Capture synchronously under the existing motion guard, then restore the main
// rig. Batch by material so a shared office does not multiply CAD draw calls.
function captureOfficeStation(spec, millimetreScale) {
    return withNeutralPose(() => {
        currentLift = heightToLift(spec.height);
        updateMovingObjectsPosition();
        const tilt = primaryTiltConfig();
        if (tilt) { tilt.currentDeg = spec.tilt; applyTiltConfig(tilt); }
        loadedModel.updateWorldMatrix(true, true);
        workspaceAccessories?.update();
        const toRoom = new THREE.Matrix4().makeRotationY(-Math.PI / 2)
            .multiply(new THREE.Matrix4().makeScale(...Array(3).fill(loadedModel.scale.x / millimetreScale)))
            .multiply(loadedModel.matrixWorld.clone().invert());
        const group = new THREE.Group(), batches = new Map();
        let sourceMeshCount = 0;
        const ledMeshes = new Set(ledParts.map(p => p.part));
        loadedModel.traverseVisible(source => {
            if (!source.isMesh || ledMeshes.has(source) || /^(Leds|LED)/i.test(source.name)) return;
            sourceMeshCount++;
            const sourceMaterials = Array.isArray(source.material) ? source.material : [source.material];
            // Current public CAD surfaces have one material; preserve groups if
            // an imported replacement carries multiple material assignments.
            sourceMaterials.forEach((mat, index) => {
                if (!mat || mat.isShaderMaterial) return;
                const geometry = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone();
                if (sourceMaterials.length > 1) {
                    const ranges = source.geometry.groups.filter(g => g.materialIndex === index);
                    if (!ranges.length) { geometry.dispose(); return; }
                    const selected = new THREE.BufferGeometry();
                    for (const name of ['position', 'normal', 'uv']) {
                        const attr = geometry.getAttribute(name); if (!attr) continue;
                        const values = [];
                        for (const range of ranges) for (let i = range.start; i < range.start + range.count; i++)
                            for (let k = 0; k < attr.itemSize; k++) values.push(attr.array[i * attr.itemSize + k]);
                        selected.setAttribute(name, new THREE.Float32BufferAttribute(values, attr.itemSize));
                    }
                    geometry.dispose();
                    append(selected, mat, source);
                } else append(geometry, mat, source);
            });
        });
        function append(geometry, mat, source) {
            for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
            if (!geometry.attributes.normal) geometry.computeVertexNormals();
            if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2));
            geometry.clearGroups(); geometry.applyMatrix4(toRoom.clone().multiply(source.matrixWorld));
            // Rhino exports many identical material objects. Compare appearance,
            // retaining distinct texture maps and UVs, rather than object identity.
            const key = JSON.stringify(['type', 'roughness', 'metalness', 'clearcoat', 'clearcoatRoughness', 'opacity', 'transparent', 'alphaTest', 'side', 'depthTest', 'depthWrite', 'vertexColors', 'bumpScale', 'envMapIntensity', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits']
                .map(k => mat[k]).concat([mat.color?.getHex(), mat.normalScale?.toArray()],
                    ['map', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap'].map(k => mat[k]?.uuid)));
            if (!batches.has(key)) batches.set(key, { sourceMaterial: mat, geometries: [] });
            batches.get(key).geometries.push(geometry);
        }
        for (const { sourceMaterial, geometries } of batches.values()) {
            const geometry = mergeGeometries(geometries, false);
            geometries.forEach(g => g.dispose());
            if (!geometry) throw new Error('Could not batch Office desk surfaces');
            const material = sourceMaterial.clone();
            // Grain maps belong to the live desk; disposal must leave them valid.
            material.userData = { ...material.userData, sharedTextures: true };
            if (material.emissive) material.emissive.setHex(0);
            const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
        }
        group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(group), center = bounds.getCenter(new THREE.Vector3());
        const offset = new THREE.Vector3(-center.x, -bounds.min.y, -center.z);
        group.children.forEach(mesh => mesh.position.add(offset));
        const mounts = {};
        for (const role of ['desktop', 'shelf']) {
            const mount = workspaceAccessories?.mounts.get(role); if (!mount) continue;
            mounts[role] = new THREE.Matrix4().makeTranslation(...offset.toArray()).multiply(toRoom.clone().multiply(mount.dress.matrixWorld));
        }
        group.userData.officeStation = { role: spec.id, height: spec.height, tilt: spec.tilt, widthMm: arSizeReference().nominalWidth * 25.4, sourceMeshCount, surfaceBatches: batches.size, main: false };
        return { group, mounts };
    });
}

// Undo and redo run the same code in opposite directions. Each entry knows how
// to reverse itself and returns the entry that would reverse THAT, which is
// pushed onto the other stack — so a redo is just an undo of an undo.
function invertEntry(entry) {
    switch (entry.type) {
        case 'transform':
            return { ...entry, items: entry.items.map(i => ({ obj: i.obj, before: i.after, after: i.before })) };
        case 'clone':
            return { ...entry, type: 'clone-restore' };
        case 'clone-restore':
            return { ...entry, type: 'clone' };
        case 'tilt-save':
            return { type: 'rig-restore', kind: 'tilt', definition: entry.definition };
        case 'rig-save':
            return { type: 'rig-restore', kind: 'actuator', definition: entry.definition };
        case 'rig-restore':
            return { type: entry.kind === 'tilt' ? 'tilt-save' : 'rig-save',
                     name: entry.definition?.name, definition: entry.definition };
        case 'lift-membership':
            return { ...entry, added: !entry.added };
        case 'tilt-parts':
            return { ...entry, added: !entry.added };
        case 'scene-assets':
            return { ...entry, present: !entry.present };
        default:
            return null;
    }
}

function applyEntry(entry) {
    if (entry.type === 'transform') {
        // Restoring the world matrix alone would leave baseY holding the value
        // derived from the undone edit, reintroducing the same overwrite one step
        // into the past. Re-record the canonical state exactly as a fresh commit does.
        entry.items.forEach(item => { setWorldMatrix(item.obj, item.before); recordCanonicalEdit(item.obj); });
        markEdited();
        boxHelpers.forEach(h => h.update());
        updateTransformProxy();
    } else if (entry.type === 'clone') {
        // Detach, but keep the objects: redo re-adds these very instances, so the
        // editorIds that groups, rigs and later undo entries refer to stay valid.
        entry.clones.forEach(clone => {
            liftObjects.delete(clone);
            toggleMovingObject(clone, false, true);
            const idx = interactableObjects.indexOf(clone);
            if (idx > -1) interactableObjects.splice(idx, 1);
            if (clone.userData.editorId) partRegistry.delete(clone.userData.editorId);
            entry.parents = entry.parents || new Map();
            if (clone.parent) { entry.parents.set(clone, clone.parent); clone.parent.remove(clone); }
        });
        updateTransformProxy();
        if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
        buildSceneTree();
    } else if (entry.type === 'clone-restore') {
        entry.clones.forEach(clone => {
            const parent = entry.parents?.get(clone) || loadedModel || scene;
            parent.add(clone);
            partRegistry.set(clone.userData.editorId,
                { obj: clone, name: clone.name, editorId: clone.userData.editorId, isClone: true });
            interactableObjects.push(clone);
        });
        updateTransformProxy();
        buildSceneTree();
        markEdited();
    } else if (entry.type === 'tilt-save') {
        const idx = tiltConfigs.findIndex(c => c.name === entry.name);
        if (idx > -1) {
            // Capture the definition before removing, so redo can rebuild it.
            entry.definition = entry.definition || serializeTiltConfigs()[idx];
            removeTiltConfig(idx, { recordUndo: false });
        }
    } else if (entry.type === 'rig-save') {
        const idx = actuatorRigs.findIndex(r => r.name === entry.name);
        if (idx > -1) {
            entry.definition = entry.definition || serializeActuatorRigs()[idx];
            removeActuatorRig(idx, { recordUndo: false });
        }
    } else if (entry.type === 'rig-restore') {
        if (entry.definition) deletedBakedRigs[entry.kind]?.delete(entry.definition.name);
        if (entry.definition && entry.kind === 'tilt') {
            const parts = entry.definition.groupEditorIds.map(eid => partRegistry.get(eid)?.obj).filter(Boolean);
            createTiltConfig({ ...entry.definition, parts });
            persistTiltConfigs();
            rebuildTiltUI();
        } else if (entry.definition && entry.kind === 'actuator') {
            buildActuatorRig(entry.definition);
            persistActuatorRigs();
            rebuildRigUI();
        }
        markEdited();
    } else if (entry.type === 'lift-membership') {
        if (entry.added) {
            entry.objects.forEach(item => liftObjects.delete(item.obj || item));
        } else {
            entry.objects.forEach(item => {
                const obj = item.obj || item;
                const canon = canonicalTransform(obj);
                liftObjects.set(obj, { obj, baseY: item.baseY ?? (canon ? canon.p.y - (currentLift - LIFT_MIN) : obj.position.y) });
            });
        }
        markEdited();
    } else if (entry.type === 'tilt-parts') {
        const config = tiltConfigs.find(c => c.name === entry.name);
        if (config) {
            const parts = entry.editorIds.map(eid => partRegistry.get(eid)?.obj).filter(Boolean);
            if (entry.added) detachPartsFromTilt(config, parts);
            else attachPartsToTilt(config, parts);
            if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
            updateTransformProxy();
            persistTiltConfigs();
            rebuildTiltUI();
        }
    } else if (entry.type === 'scene-assets') {
        entry.records.forEach(record => setSceneAssetPresence(record, entry.present));
        persistSceneAssetStates();
        updateTransformProxy();
        buildSceneTree();
        renderSceneAssetList();
        updateSceneLibraryStatus();
        markEdited();
    }
}

function performUndo() {
    const entry = undoStack.pop();
    if (!entry) return;
    const wasSuppressed = suppressTransactions;
    suppressTransactions = true;
    try {
        applyEntry(entry);
        const inverse = invertEntry(entry);
        if (inverse) redoStack.push(inverse);
    } finally { suppressTransactions = wasSuppressed; }
    updateUndoBtn();
}

function performRedo() {
    const entry = redoStack.pop();
    if (!entry) return;
    const wasSuppressed = suppressTransactions;
    suppressTransactions = true;
    try {
        applyEntry(entry);
        const inverse = invertEntry(entry);
        if (inverse) undoStack.push(inverse);
    } finally { suppressTransactions = wasSuppressed; }
    updateUndoBtn();
}

// Chrome's GPU process can crash mid-session (observed on this machine).
// Catch the WebGL context loss and offer one-click recovery instead of a
// silent freeze — groups and tilt configs persist, so a reload is lossless.
function showContextLostOverlay() {
    if (document.getElementById('ctx-lost-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'ctx-lost-overlay';
    overlay.className = 'absolute inset-0 z-20 flex items-center justify-center';
    overlay.style.background = 'rgba(245,245,247,0.92)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.innerHTML = `
        <div class="flex flex-col items-center p-6 text-center max-w-sm">
            <svg class="w-10 h-10 text-amber-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"></path></svg>
            <p class="text-sm text-gray-900 font-semibold mb-1">3D view interrupted</p>
            <p class="text-xs text-gray-600 leading-relaxed mb-4">The browser's graphics process was interrupted. Your groups and tilt configs are saved — reloading brings everything back.</p>
            <button class="btn-primary px-6 py-2.5 text-sm" onclick="location.reload()">Reload 3D View</button>
        </div>
    `;
    canvas.parentElement.appendChild(overlay);
}

function showWebGLError() {
    if (!loader) return;
    loader.innerHTML = `
        <div class="flex flex-col items-center p-6 text-center max-w-sm">
            <svg class="w-10 h-10 text-amber-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"></path></svg>
            <p class="text-sm text-gray-900 font-semibold mb-1">3D preview unavailable</p>
            <p class="text-xs text-gray-600 leading-relaxed">Your browser couldn't start WebGL. This is usually fixed by fully restarting the browser, or enabling hardware acceleration (chrome://settings/system). You can still configure your desk using the options panel.</p>
        </div>
    `;
}

// Centers the 3D Gizmo perfectly on the selection
function updateTransformProxy() {
    if (!transformProxy || !transformControl) return;
    // While the pivot marker owns the gizmo, selection changes must not steal it back
    if (pivotGizmoOn) return;

    // 1. Detach current children back to their original parents to preserve world transforms
    [...transformProxy.children].forEach(child => {
        const origParent = proxyOriginalParents.get(child);
        if (origParent) {
            origParent.attach(child);
            proxyOriginalParents.delete(child);
        } else {
            scene.attach(child);
        }
    });

    const tMode = document.querySelector('input[name="transform_mode"]:checked');
    if (!isSelectionMode || !tMode || tMode.value === 'none' || movingObjects.length === 0) {
        transformControl.detach();
        return;
    }

    // 2. Calculate bounding box of all selected objects
    const box = new THREE.Box3();
    movingObjects.forEach(item => {
        item.obj.updateMatrixWorld(true);
        box.expandByObject(item.obj);
    });

    const center = new THREE.Vector3();
    box.getCenter(center);

    // If a tilt pivot has been picked, anchor the gizmo on the pivot part's
    // geometry instead of the selection center — Rotate then previews exactly
    // how the saved tilt config will move.
    if (tiltPivotEditorId) {
        const pivotEntry = partRegistry.get(tiltPivotEditorId);
        if (pivotEntry) {
            pivotEntry.obj.updateMatrixWorld(true);
            const pivotBox = new THREE.Box3().setFromObject(pivotEntry.obj);
            pivotBox.getCenter(center);
        }
    }

    // 3. Move proxy to centroid
    transformProxy.position.copy(center);
    transformProxy.rotation.set(0,0,0);
    transformProxy.scale.set(1,1,1);
    transformProxy.updateMatrixWorld();

    // 4. Attach all moving objects to the proxy
    movingObjects.forEach(item => {
        const obj = item.obj;
        if (!proxyOriginalParents.has(obj)) {
            proxyOriginalParents.set(obj, obj.parent);
        }
        transformProxy.attach(obj);
    });

    // 5. Attach TransformControls to proxy
    transformControl.attach(transformProxy);
}

function toggleMovingObject(obj, forceState = null, skipUpdate = false) {
    if (roomGroove?.run && forceState !== false) haltAllMotion();
    const existingIndex = movingObjects.findIndex(item => item.obj === obj);
    const currentlySelected = existingIndex > -1;
    // A locked part can always be deselected, never selected.
    if (!currentlySelected && forceState !== false && isLocked(obj)) return;

    let shouldSelect = forceState !== null ? forceState : !currentlySelected;

    if (!shouldSelect && currentlySelected) {
        movingObjects.splice(existingIndex, 1);
        if (boxHelpers.has(obj.uuid)) {
            scene.remove(boxHelpers.get(obj.uuid));
            boxHelpers.delete(obj.uuid);
        }
    } else if (shouldSelect && !currentlySelected) {
        // Add to moving list — baseY is position at LIFT_MIN, offset relative to LIFT_MIN
        movingObjects.push({
            obj: obj,
            baseY: obj.position.y - (currentLift - LIFT_MIN)
        });

        const helper = new THREE.BoxHelper(obj, 0x30d158);
        scene.add(helper);
        boxHelpers.set(obj.uuid, helper);
        helper.visible = isSelectionMode;
    }

    if (shouldSelect && obj.userData.editorId) lastSelectedEditorId = obj.userData.editorId;
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    queueSelectedPartUI();
    if (obj.userData?.sceneAsset) renderSceneAssetList();
    if (!skipUpdate) updateTransformProxy();
}


// --- Box (marquee) selection -------------------------------------------------
// Hold Shift or Alt and drag across the canvas to rubber-band select parts.
// Screen positions are projected once when the drag starts (the camera is
// frozen for the duration), so dragging itself is just cheap rectangle math
// even with a few thousand meshes in the scene.
const marquee = {
    active: false,
    startX: 0, startY: 0, curX: 0, curY: 0,
    pointerId: null,
    candidates: [],
    hits: []
};
let marqueeBoxEl = null, marqueeCountEl = null;

function wantsMarquee(e) {
    const sticky = document.getElementById('box-select-sticky');
    const modifier = e.shiftKey || e.altKey;
    // Sticky mode inverts the roles: plain drag box-selects, modifier+drag orbits.
    // (Without the inversion a sticky left-drag would leave no way to rotate.)
    return (sticky && sticky.checked) ? !modifier : modifier;
}

function getBoxSelectMode() {
    const input = document.querySelector('input[name="box_mode"]:checked');
    return input ? input.value : 'enclose';
}

// An object only counts if it and every ancestor is visible.
function isRenderable(obj) {
    let node = obj;
    while (node) {
        if (!node.visible) return false;
        node = node.parent;
    }
    return true;
}

// Projects every interactable mesh's world bounding box into canvas pixel
// space and caches the resulting 2D AABB.
function buildMarqueeCandidates() {
    const rect = canvas.getBoundingClientRect();
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    const out = [];

    camera.updateMatrixWorld();

    const selectionObjects = new Set(interactableObjects.map(selectionTarget));
    for (const obj of selectionObjects) {
        if (!obj.parent || !isRenderable(obj)) continue;

        obj.updateWorldMatrix(true, false);
        box.setFromObject(obj);
        if (box.isEmpty()) continue;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let behind = 0;

        for (let i = 0; i < 8; i++) {
            v.set(
                (i & 1) ? box.max.x : box.min.x,
                (i & 2) ? box.max.y : box.min.y,
                (i & 4) ? box.max.z : box.min.z
            );
            v.project(camera);
            if (v.z > 1) behind++;
            const x = (v.x * 0.5 + 0.5) * rect.width;
            const y = (-v.y * 0.5 + 0.5) * rect.height;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        if (behind === 8) continue; // entirely behind the camera
        out.push({ obj, minX, minY, maxX, maxY });
    }

    return out;
}

function beginMarquee(e) {
    const rect = canvas.getBoundingClientRect();
    marquee.active = true;
    marquee.pointerId = e.pointerId;
    marquee.startX = marquee.curX = e.clientX - rect.left;
    marquee.startY = marquee.curY = e.clientY - rect.top;
    marquee.candidates = buildMarqueeCandidates();
    marquee.hits = [];

    // Freeze the camera so the drag doesn't orbit underneath the rubber band
    if (controls) {
        controls.enabled = false;
        controls.autoRotate = false;
    }
    blockCanvasClick = true;

    if (!marqueeBoxEl) {
        marqueeBoxEl = document.getElementById('marquee-box');
        marqueeCountEl = document.getElementById('marquee-count');
    }
    if (marqueeBoxEl) marqueeBoxEl.classList.remove('hidden');

    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    drawMarquee();
}

function marqueeRect() {
    return {
        left: Math.min(marquee.startX, marquee.curX),
        right: Math.max(marquee.startX, marquee.curX),
        top: Math.min(marquee.startY, marquee.curY),
        bottom: Math.max(marquee.startY, marquee.curY)
    };
}

function drawMarquee() {
    if (!marqueeBoxEl) return;
    const r = marqueeRect();
    marqueeBoxEl.style.left = (r.left + canvas.offsetLeft) + 'px';
    marqueeBoxEl.style.top = (r.top + canvas.offsetTop) + 'px';
    marqueeBoxEl.style.width = (r.right - r.left) + 'px';
    marqueeBoxEl.style.height = (r.bottom - r.top) + 'px';
    if (marqueeCountEl) {
        marqueeCountEl.textContent = marquee.hits.length + (marquee.hits.length === 1 ? ' part' : ' parts');
    }
}

function computeMarqueeHits() {
    const r = marqueeRect();
    const touch = getBoxSelectMode() === 'touch';
    const hits = [];
    for (const c of marquee.candidates) {
        const inside = touch
            ? (c.maxX >= r.left && c.minX <= r.right && c.maxY >= r.top && c.minY <= r.bottom)
            : (c.minX >= r.left && c.maxX <= r.right && c.minY >= r.top && c.maxY <= r.bottom);
        if (inside) hits.push(c.obj);
    }
    return hits;
}

function updateMarquee(e) {
    const rect = canvas.getBoundingClientRect();
    marquee.curX = e.clientX - rect.left;
    marquee.curY = e.clientY - rect.top;
    marquee.hits = computeMarqueeHits();
    drawMarquee();
}

function endMarquee(e) {
    if (e) updateMarquee(e);
    const hits = marquee.hits;
    const r = marqueeRect();
    const dragged = (r.right - r.left) > 3 || (r.bottom - r.top) > 3;

    teardownMarquee(e);

    if (dragged && hits.length) applyMarqueeSelection(hits);
}

function cancelMarquee() {
    teardownMarquee(null);
}

function teardownMarquee(e) {
    marquee.active = false;
    marquee.candidates = [];
    marquee.hits = [];
    if (marqueeBoxEl) marqueeBoxEl.classList.add('hidden');
    if (controls) controls.enabled = true;
    if (e && marquee.pointerId !== null) {
        try { canvas.releasePointerCapture(marquee.pointerId); } catch (_) {}
    }
    marquee.pointerId = null;
    // Let the next plain click through again
    setTimeout(() => { blockCanvasClick = false; }, 0);
}

// Selected parts get reparented onto the transform proxy, so obj.parent is not
// a reliable stand-in for "the assembly this mesh belongs to".
function resolveSelectionParent(obj) {
    let parent = obj.parent;
    if (parent === transformProxy) parent = proxyOriginalParents.get(obj) || parent;
    return parent;
}

function applyMarqueeSelection(hits) {
    const modeInput = document.querySelector('input[name="select_mode"]:checked');
    const mode = modeInput ? modeInput.value : 'single';

    const actionInput = document.querySelector('input[name="click_action"]:checked');
    const action = actionInput ? actionInput.value : 'toggle';

    const interactableSet = new Set(interactableObjects);
    const targets = new Set();

    hits.forEach(obj => {
        if (mode === 'parent' && !obj.userData?.sceneAsset) {
            const parent = resolveSelectionParent(obj);
            if (parent && parent.type !== 'Scene') {
                parent.traverse(child => {
                    if (child.isMesh && interactableSet.has(child)) targets.add(child);
                });
                return;
            }
        }
        targets.add(obj);
    });

    targets.forEach(obj => {
        const isSelected = movingObjects.some(item => item.obj === obj);
        let state;
        if (action === 'select') state = true;
        else if (action === 'deselect') state = false;
        else state = !isSelected;
        toggleMovingObject(obj, state, true); // batch — proxy updated once below
    });

    updateTransformProxy();
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
}

// --- Shared store/studio shell -----------------------------------------------
// Both modes use one viewport shell. Only the editor/configurator nodes move;
// #viewer-shell stays put so its WebGL context survives every mode switch.
let setupLayoutOn = false;
let shellMode = null;
let shellChromeBuilt = false;
let shellWidths = null;
const layoutSlots = new Map(); // node -> placeholder comment marking its home position

const LEGACY_SIDEBAR_W_KEY = 'ergoflex.setupSidebarWidth';
const SHELL_W_KEY = 'ergoflex.shellWidthV1';
const SIDEBAR_W_MIN = 300;
const SHELL_MODES = Object.freeze({
    studio: {
        bodyClass: 'setup-layout',
        defaultWidth: 420,
        eyebrow: 'ERGOFLEX / DESIGN STUDIO',
        title: 'Your workspace. Refined.',
        exit: { label: 'Store preview ↗', to: 'store' },
        tabs: [
            { id: 'editor', label: 'Editor tools', nodeId: 'anim-debugger' },
            { id: 'finishes', label: 'Product & finishes', nodeId: 'config-column' }
        ]
    },
    store: {
        bodyClass: 'store-layout',
        defaultWidth: 360,
        eyebrow: 'ERGOFLEX / CUSTOM SHOP',
        title: 'Built around you.',
        exit: null,
        tabs: [{ id: 'build', label: 'Configure', nodeId: 'config-column' }]
    }
});

function loadShellWidths() {
    const stored = readStore(SHELL_W_KEY, 1, null);
    const widths = {
        v: 1,
        studio: numberOrNull(stored?.studio, SIDEBAR_W_MIN, 4000) ?? SHELL_MODES.studio.defaultWidth,
        store: numberOrNull(stored?.store, SIDEBAR_W_MIN, 4000) ?? SHELL_MODES.store.defaultWidth
    };
    if (!stored) {
        let legacy = null;
        try { legacy = Number.parseInt(localStorage.getItem(LEGACY_SIDEBAR_W_KEY), 10); } catch {}
        if (Number.isFinite(legacy) && legacy >= SIDEBAR_W_MIN && legacy <= 4000) {
            widths.studio = legacy;
            writeStore(SHELL_W_KEY, widths);
        }
    }
    return widths;
}

function setSidebarWidth(px, mode = shellMode || 'studio') {
    if (!SHELL_MODES[mode]) mode = 'studio';
    const max = Math.max(SIDEBAR_W_MIN, window.innerWidth - 420);
    const raw = Number(px);
    const w = raw === 0 ? 0 : Math.round(Math.max(SIDEBAR_W_MIN, Math.min(max, raw)));
    document.documentElement.style.setProperty('--shell-sidebar-w', w + 'px');
    if (shellWidths && w > 0) shellWidths[mode] = w;
    return w;
}

function persistShellWidths() {
    if (shellWidths) writeStore(SHELL_W_KEY, { v: 1, studio: shellWidths.studio, store: shellWidths.store });
}

function renderShellChrome(mode) {
    const config = SHELL_MODES[mode];
    const sidebar = document.getElementById('setup-sidebar');
    const exitBtn = document.getElementById('setup-exit-btn');
    if (!config || !sidebar || !exitBtn) return;
    const chrome = sidebar.querySelector('.studio-sidebar-header');
    chrome.innerHTML = `<div class="eyebrow">${config.eyebrow}</div><h2>${config.title}</h2><div class="studio-tabs">${config.tabs.map((tab, index) =>
        `<button data-sidebar-tab="${tab.id}" aria-pressed="${index === 0}">${tab.label}</button>`).join('')}</div>`;
    sidebar.dataset.tab = config.tabs[0].id;
    sidebar.dataset.tabs = String(config.tabs.length);
    exitBtn.textContent = config.exit?.label || '';
}

function buildShellChrome() {
    if (shellChromeBuilt) return;
    shellChromeBuilt = true;
    shellWidths = loadShellWidths();

    const backdrop = document.createElement('div');
    backdrop.id = 'setup-backdrop';

    const sidebar = document.createElement('aside');
    sidebar.id = 'setup-sidebar';
    sidebar.innerHTML = '<div class="studio-sidebar-header"></div>';
    sidebar.addEventListener('click', event => {
        const button = event.target.closest('[data-sidebar-tab]');
        if (!button) return;
        sidebar.dataset.tab = button.dataset.sidebarTab;
        sidebar.querySelectorAll('[data-sidebar-tab]').forEach(item =>
            item.setAttribute('aria-pressed', String(item === button)));
    });

    const resizer = document.createElement('div');
    resizer.id = 'setup-resizer';
    resizer.title = 'Drag to resize the panel';

    const exitBtn = document.createElement('button');
    exitBtn.id = 'setup-exit-btn';
    exitBtn.className = 'bg-white/90 hover:bg-white border border-gray-200 shadow-sm text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg';
    exitBtn.addEventListener('click', () => setSetupLayout(false));

    document.body.append(backdrop, sidebar, resizer, exitBtn);

    let draggingSplitter = false;
    resizer.addEventListener('pointerdown', event => {
        if (!shellMode) return;
        draggingSplitter = true;
        resizer.classList.add('dragging');
        try { resizer.setPointerCapture(event.pointerId); } catch {}
        event.preventDefault();
    });
    resizer.addEventListener('pointermove', event => {
        if (!draggingSplitter || !shellMode) return;
        setSidebarWidth(event.clientX, shellMode);
        syncViewerSize();
    });
    const stopSplitter = event => {
        if (!draggingSplitter) return;
        draggingSplitter = false;
        resizer.classList.remove('dragging');
        try { resizer.releasePointerCapture(event.pointerId); } catch {}
        const w = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--shell-sidebar-w'), 10);
        if (Number.isFinite(w) && shellMode) shellWidths[shellMode] = w;
        persistShellWidths();
        syncViewerSize();
    };
    resizer.addEventListener('pointerup', stopSplitter);
    resizer.addEventListener('pointercancel', stopSplitter);

    window.addEventListener('resize', () => {
        if (!shellMode) return;
        measureShellTop();
        const w = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue('--shell-sidebar-w'), 10);
        if (Number.isFinite(w)) setSidebarWidth(w, shellMode);
    });
}

function stashHome(node) {
    if (!node || layoutSlots.has(node) || !node.parentNode) return;
    const slot = document.createComment('layout-home');
    node.parentNode.insertBefore(slot, node);
    layoutSlots.set(node, slot);
}

function returnHome(node) {
    const slot = layoutSlots.get(node);
    if (slot && slot.parentNode) slot.parentNode.insertBefore(node, slot);
}

function measureShellTop() {
    const siteHeader = document.querySelector('body > header');
    const breadcrumbBar = document.querySelector('.breadcrumb')?.parentElement;
    const top = shellMode === 'studio'
        ? 54
        : (siteHeader?.offsetHeight || 0) + (breadcrumbBar?.offsetHeight || 0);
    document.documentElement.style.setProperty('--shell-top', top + 'px');
    return top;
}

function setShellMode(mode) {
    const config = SHELL_MODES[mode];
    if (!config) return false;
    buildShellChrome();

    const outgoing = SHELL_MODES[shellMode];
    outgoing?.tabs.forEach(tab => returnHome(document.getElementById(tab.nodeId)));

    shellMode = mode;
    setupLayoutOn = mode === 'studio';
    renderShellChrome(mode);
    setSidebarWidth(shellWidths?.[mode] ?? config.defaultWidth, mode);

    const sidebar = document.getElementById('setup-sidebar');
    config.tabs.forEach(tab => {
        const node = document.getElementById(tab.nodeId);
        if (!node) return;
        stashHome(node);
        node.dataset.shellTab = tab.id;
        sidebar.appendChild(node);
    });

    const animDebugger = document.getElementById('anim-debugger');
    if (animDebugger) animDebugger.style.display = setupLayoutOn ? '' : 'none';
    document.body.classList.remove('setup-layout', 'store-layout');
    document.body.classList.add('shell-layout', config.bodyClass);
    const configCollapsed = collapsibles.get('config-column')?.collapsed === true;
    document.body.classList.toggle('sidebar-collapsed', mode === 'store' && configCollapsed);

    if (!setupLayoutOn) {
        isSelectionMode = false;
        if (selectionModeToggle) selectionModeToggle.checked = false;
        document.querySelector('input[name="transform_mode"][value="none"]')?.click();
        if (transformProxy) updateTransformProxy();
        boxHelpers.forEach(helper => helper.visible = false);
        showAllParts();
        updateBoxSelectHint();
    }
    controls && (controls.autoRotate = false);
    measureShellTop();
    placeRemoteForMode();
    requestAnimationFrame(syncViewerSize);
    return true;
}

function setSetupLayout(on) {
    return setShellMode(on ? 'studio' : 'store');
}

function updateBoxSelectHint() {
    const hint = document.getElementById('boxselect-hint');
    if (hint) hint.classList.toggle('hidden', !isSelectionMode);
}

function onCanvasClick(event) {
    if (rigPickMode) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactableObjects, false);
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            if (rigPickMode === 'base') {
                obj.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(obj);
                const c = box.getCenter(new THREE.Vector3());
                loadedModel.updateMatrixWorld(true);
                loadedModel.worldToLocal(c);
                c.y -= (currentLift - LIFT_MIN); // normalize to 28" reference
                rigDraft.baseLocal = { x: c.x, y: c.y, z: c.z };
                rigDraft.baseName = obj.userData.editorId || obj.name;
                setRigPickHelper('base', obj);
                rigPickMode = null;
                clearHoverHighlight();
                canvas.style.cursor = '';
                updateRigPickButtons();
                updateRigStatus();
                openPivotEditor(-1); // show the pivot straight away so it can be corrected
                return;
            }
            rigDraft.targetEditorId = obj.userData.editorId;
            rigDraft.targetName = obj.userData.editorId || obj.name;
            setRigPickHelper('target', obj);
        }
        rigPickMode = null;
        clearHoverHighlight();
        canvas.style.cursor = '';
        updateRigPickButtons();
        updateRigStatus();
        return;
    }

    if (isPickingPivot) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactableObjects, false);
        if (intersects.length > 0) {
            const clickedObj = intersects[0].object;
            const editorId = clickedObj.userData.editorId;
            if (editorId) {
                setPivotPart(editorId);
            }
        }
        isPickingPivot = false;
        clearHoverHighlight();
        canvas.style.cursor = '';
        updatePickPivotBtnState();
        return;
    }

    if (!isSelectionMode && roomGroove?.prepared && !roomGroove.run) {
        const rect = canvas.getBoundingClientRect();
        mouse.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(mouse, camera);
        const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
        const hit = raycaster.intersectObject(loadedModel, true).find(h => visible(h.object));
        const obstruction = raycaster.intersectObject(workspaceRoom.root, true).find(h => visible(h.object) && !h.object.parent?.userData.grooveMarker);
        if (hit && (!obstruction || hit.distance < obstruction.distance)) grooveController().start();
        return;
    }
    if (!isSelectionMode) return;
    if (transformControl && transformControl.dragging) return;

    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, false);

    if (intersects.length > 0) {
        const clickedObj = selectionTarget(intersects[0].object);

        const modeInput = document.querySelector('input[name="select_mode"]:checked');
        const mode = modeInput ? modeInput.value : 'single';

        const actionInput = document.querySelector('input[name="click_action"]:checked');
        const action = actionInput ? actionInput.value : 'toggle';

        let targetState = null;
        if (action === 'select') targetState = true;
        if (action === 'deselect') targetState = false;

        const clickedParent = resolveSelectionParent(clickedObj);
        if (mode === 'parent' && !clickedObj.userData?.sceneAsset && clickedParent && clickedParent.type !== 'Scene') {
            const parent = clickedParent;
            const isSelected = movingObjects.some(item => item.obj === clickedObj);
            const finalState = action === 'toggle' ? !isSelected : targetState;

            parent.traverse((child) => {
                if (child.isMesh && interactableObjects.includes(child)) {
                    // Skip proxy update until all children are processed
                    toggleMovingObject(child, finalState, true);
                }
            });
            updateTransformProxy();
        } else {
            const finalState = action === 'toggle' ? null : targetState;
            toggleMovingObject(clickedObj, finalState);
        }
    }
}

// The identity of the asset a project was authored against. Hashing the GLB
// bytes is the only check that catches a mesh whose geometry changed under an
// unchanged name — a summary of names, vertex counts and bounding boxes misses
// a moved hole or a retopologised surface, which is exactly when restored
// transforms and rig pivots go quietly wrong.
let modelFingerprint = null;

async function fetchModelWithFingerprint(url) {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Model request failed: ${response.status}`);

    // Stream so the existing percentage readout keeps working.
    const total = Number(response.headers.get('content-length')) || 0;
    const statusEl = document.getElementById('loader-status');
    const chunks = [];
    let loaded = 0;
    const reader = response.body?.getReader();
    if (reader) {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (statusEl && total) {
                statusEl.textContent = 'Loading 3D workspace... ' + Math.min(100, Math.round((loaded / total) * 100)) + '%';
            }
        }
    }
    let buffer;
    if (reader) {
        const bytes = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        buffer = bytes.buffer;
    } else {
        buffer = await response.arrayBuffer();
    }

    let fingerprint = null;
    try {
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        fingerprint = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        // crypto.subtle is unavailable over plain HTTP on some origins. A project
        // saved without a fingerprint imports with a weaker check rather than none.
        console.warn('[ErgoFlex] Could not fingerprint the model:', error);
    }
    return { buffer, fingerprint };
}

function setTrimColor(value, persist = true) {
    if (!/^#[0-9a-f]{6}$/i.test(value || '')) return;
    trimColor = value;
    if (trimMaterial) trimMaterial.color.set(value);
    const picker = document.getElementById('trim-color');
    if (picker && picker.value !== value) picker.value = value;
    const readout = document.getElementById('trim-color-value');
    if (readout) readout.textContent = value.toUpperCase();
    if (persist) {
        try { localStorage.setItem(TRIM_COLOR_KEY, value); } catch (_) {}
    }
}

function setLedColor(value, persist = true) {
    if (!/^#[0-9a-f]{6}$/i.test(value || '')) return;
    customLedLook = null;
    ledMusic.paletteOverride = null;
    ledColor = value;
    ledParts.forEach((entry, index) => {
        if (index >= 3 && index <= 37) return;
        entry.color = value;
        entry.material.color.set(value).multiplyScalar(ledsEnabled ? 1 : 0.12);
        entry.material.emissive.set(value);
    });
    ledSpillMaterials.forEach(({ material }) => material.uniforms.ledColor.value.set(value));
    updateLedEffectFrame();
    const picker = document.getElementById('led-color');
    if (picker && picker.value !== value) picker.value = value;
    document.querySelectorAll('[data-led-color]').forEach(input => {
        if (input.value !== value) input.value = value;
    });
    document.querySelectorAll('.led-preset').forEach(button =>
        button.setAttribute('aria-pressed', String(button.dataset.ledPreset === value.toLowerCase())));
    const readout = document.getElementById('led-color-value');
    if (readout) readout.textContent = value.toUpperCase();
    if (persist) {
        try { localStorage.setItem(LED_COLOR_KEY, value); } catch (_) {}
    }
}

function updateLedEffectFrame(seconds = performance.now() / 1000) {
    const diagnostic = ledDiagnostic.strip !== null;
    let pixels = false, linear = false;
    if (roomSafety.alert) {
        const amber=roomSafety.alert.kind==='ahead',gain=ledReducedMotion.matches?1:.72+.28*Math.sin(seconds*3)**2;
        for(const row of ledPixelFrame)for(let p=0;p<row.length;p+=4)row.set([Math.round(255*gain),Math.round((amber?145:16)*gain),Math.round((amber?8:12)*gain),0],p);
        pixels=true;ledPixelSource=amber?'obstacle-ahead':'collision';
    }
    else if (diagnostic) {sampleLedDiagnostic(ledPixelFrame, LED_STRIPS, ledDiagnostic); pixels = true; ledPixelSource = 'diagnostic';}
    else if (ledMotionEnabled && ledMotion.sample(ledPixelFrame, seconds * 1000, ledReducedMotion.matches)) {pixels = true;ledPixelSource = ledMotion.owner ? 'movement' : 'completion';}
    else if (ledGame.sample(ledPixelFrame)) {pixels = true;linear = true;ledPixelSource = 'game';}
    else if (ledMusic.sample(ledPixelFrame)) {
        if(customLedLook){
            if(ledMusic.dj.enabled){if(!ledMusic.dj.currentLook&&!ledMusic.dj.currentPalette)tintCustomMusic(ledPixelFrame,customLedLook);}
            else if(customLookUsesMusic(customLedLook))customLookSampler.sample(ledPixelFrame,customLedLook,ledMusic.playbackTime,{...ledMusic.metrics,beat:!ledMusic.paused&&ledMusic.metrics.beat,bassBeat:!ledMusic.paused&&ledMusic.metrics.bassBeat},ledReducedMotion.matches,ledMusic.paused?0:.016);
            else tintCustomMusic(ledPixelFrame,customLedLook);
        }
        pixels = true;ledPixelSource = 'music';
    }
    else if (customLookSampler.sample(ledPixelFrame,customLedLook,seconds-ledEffectStart,{bands:[],volume:0,energy:0,beat:false,bassBeat:false},ledReducedMotion.matches,.016,(liftToHeight(currentLift)-28)/24)) {pixels=true;ledPixelSource='preset';}
    else if (sampleDecorativeInto(ledPixelFrame, ledEffect, seconds - ledEffectStart, ledColor,
        ledReducedMotion.matches, (liftToHeight(currentLift) - 28) / 24)) {pixels = true;ledPixelSource = 'effect';}
    else ledPixelSource = 'base';
    const frame = sampleLedEffect(ledEffect, seconds - ledEffectStart, ledsEnabled,
        ledReducedMotion.matches || pixels);
    if(roomSafety.alert)frame.gain=ledsEnabled?1:0;
    roomLedGain = 1.8 * ledGlow / 100 * frame.gain;
    if (pixels && ledsEnabled) ledPixels?.upload(ledPixelFrame, linear);
    ledPixels?.setActive(pixels && ledsEnabled, 3.6 * ledGlow / 100);
    if (roomSafety.alert) ledFrameColor.set(roomSafety.alert.kind==='ahead'?'#ff9108':'#ff100c');
    else if (frame.hue === null) ledFrameColor.set(ledColor);
    else ledFrameColor.setHSL(frame.hue, 1, 0.5, THREE.SRGBColorSpace);
    ledParts.forEach(({ material }, index) => {
        // The fixed red IC details are not part of the decorative effect.
        if (index >= 3 && index <= 37) return;
        material.color.copy(ledFrameColor).multiplyScalar(ledsEnabled ? 1 : 0.12);
        material.emissive.copy(ledFrameColor);
        material.emissiveIntensity = 3.6 * ledGlow / 100 * frame.gain;
    });
    ledSpillMaterials.forEach(({ material, receiver }) => {
        material.uniforms.ledColor.value.copy(ledFrameColor);
        material.uniforms.strength.value = ledGlow * ledSurfaces[`${receiver}Strength`] / 10000 * frame.gain;
    });
}

function ledPose() {return {lift:liftToHeight(currentLift),tilt:primaryTiltConfig()?.currentDeg || 0,x:glideOffset.x,z:glideOffset.z,yaw:deskYaw};}
function setLedMotionEnabled(value) {
    ledMotionEnabled = !!value; ledMotion.cancel(loadedModel ? ledPose() : null);
    ledAutoLift = ledAutoTilt = false; ledSounds.stop(); updateLedEffectFrame();
}
function mountLedPlayback(container) {
    ledGame.mountControls(container,{motionEnabled:()=>ledMotionEnabled,setMotionEnabled:setLedMotionEnabled,sounds:ledSounds,startLights:()=>{ledMusic.stop();setLedsEnabled(true);}});
    ledMusic.mountControls(container,()=>{ledGame.stop();setLedsEnabled(true);});
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {haltAllMotion();ledGame.video.pause();ledMusic.pause();ledSounds.stop();ledMotion.cancel();updateLedEffectFrame();ledGame.syncUI();}
});
window.addEventListener('pagehide', e => {if (!e.persisted) {ledSounds.dispose();ledGame.dispose();ledMusic.dispose();}else {ledSounds.stop();ledGame.video.pause();if(ledMusic.liveAudio||ledMusic.capturePending)ledMusic.stop();else ledMusic.pause();}});

function setLedDiagnostic(value = {}) {
    const strip = value.strip === null || value.strip === undefined ? null : Number(value.strip);
    const spec = LED_STRIPS.find(entry => entry.id === strip);
    const pixel = value.pixel === null || value.pixel === undefined ? null : Number(value.pixel);
    if (strip !== null && !spec) return false;
    if (pixel !== null && (!spec || !Number.isInteger(pixel) || pixel < 0 || pixel >= spec.count)) return false;
    ledDiagnostic = { strip, pixel };
    sampleLedDiagnostic(ledPixelFrame, LED_STRIPS, ledDiagnostic);
    ledPixels?.upload(ledPixelFrame);
    updateLedEffectFrame();
    document.querySelectorAll('[data-led-diagnostic-strip]').forEach(select => select.value = strip === null ? 'off' : String(strip));
    document.querySelectorAll('[data-led-diagnostic-pixel]').forEach(input => {
        input.disabled = !spec;
        input.max = spec ? String(spec.count - 1) : '0';
        input.value = pixel === null ? '' : String(pixel);
    });
    document.querySelectorAll('[data-led-diagnostic-label]').forEach(output => output.textContent = spec
        ? `Strip ${strip}: ${spec.name} · ${pixel === null ? 'all addresses' : `address ${pixel}`} · saved endpoint; visibility unverified`
        : 'Desk 02 saved endpoint calibration · confirm geometry, visible addresses and size-specific counts.');
    return true;
}

function mountLedDiagnostic(container) {
    if (!container || container.childElementCount) return;
    // Engineer tooling stays out of the normal customer controls.
    container.hidden = new URLSearchParams(location.search).get('ledDiagnostics') !== '1';
    if (container.hidden) return;
    const details = document.createElement('details');
    details.className = 'led-map-diagnostic';
    details.innerHTML = '<summary>LED strip mapping</summary><div class="led-effects-controls"><label>Strip <select data-led-diagnostic-strip aria-label="Diagnostic LED strip"><option value="off">Off</option></select></label><label>Address <input data-led-diagnostic-pixel type="number" min="0" step="1" placeholder="All" aria-label="Diagnostic LED address"></label><button type="button" data-led-diagnostic-next>Next address</button><button type="button" data-led-diagnostic-end>End test</button></div><p data-led-diagnostic-label role="status"></p>';
    const select = details.querySelector('select'), pixel = details.querySelector('input');
    LED_STRIPS.forEach(strip => select.add(new Option(`${strip.id} · ${strip.name}`, String(strip.id))));
    const change = () => setLedDiagnostic({ strip: select.value === 'off' ? null : Number(select.value), pixel: pixel.value === '' ? null : Number(pixel.value) });
    select.addEventListener('change', () => { pixel.value = ''; change(); });
    pixel.addEventListener('change', () => { if (!change()) pixel.value = ledDiagnostic.pixel ?? ''; });
    details.querySelector('[data-led-diagnostic-next]').addEventListener('click', () => {
        const spec = LED_STRIPS.find(strip => strip.id === ledDiagnostic.strip);
        if (spec) setLedDiagnostic({ strip: spec.id, pixel: ledDiagnostic.pixel === null ? 0 : (ledDiagnostic.pixel + 1) % spec.count });
    });
    details.querySelector('[data-led-diagnostic-end]').addEventListener('click', () => setLedDiagnostic());
    details.addEventListener('toggle', () => { if (!details.open) setLedDiagnostic(); });
    container.append(details);
    setLedDiagnostic(ledDiagnostic);
}

function bindLedPixels() {
    ledPixels?.dispose();
    ledPixels = new LedPixelRenderer(LED_STRIPS);
    LED_STRIPS.forEach(strip => ledPixels.bindStrip(ledParts[strip.mesh].part, strip.id));
    ledPixels.bindStrip(ledExtendedStrips.children[0], 6);
    ledPixels.bindStrip(ledExtendedStrips.children[1], 5);
    ledPixels.bindStrip(ledExtendedStrips.children[2], 4);
    const receiverIds = { desktop: [3], shelf: [1, 2], base: [7], top: [0], leftWing: [5], rightWing: [6], floor: [7] };
    ledSpillMaterials.forEach(entry => {
        const ids = entry.sourceIds || (entry.strip ? [entry.strip.userData.ledPhysicalId] : receiverIds[entry.receiver]);
        entry.material.userData.ledSpillSources = [...ids];
        const source = ledPixels.bindings.find(binding => binding.stripId === ids[0] && binding.part === entry.strip)
            || ledPixels.bindings.find(binding => binding.stripId === ids[0]);
        if (entry.receiver === 'floor') {
            // Floor UV.y runs opposite model-local Z; use the authored strip span.
            ledPixels.bindSpill(entry, ids, [source.min, source.max], '-327.1 - (ledUv.y - 0.5) * 60.0');
        } else ledPixels.bindSpill(entry, ids, [source.min, source.max], `ledPosition.${source.axis}`);
    });
    setLedDiagnostic(ledDiagnostic);
}

function setLedEffect(value, persist = true) {
    customLedLook = null;
    ledEffect = normalizeLedEffect(value);
    ledEffectStart = performance.now() / 1000;
    updateLedEffectFrame();
    document.querySelectorAll('[data-led-effect]').forEach(input => input.value = ledEffect.mode);
    document.querySelectorAll('[data-led-period]').forEach(input => input.value = String(ledEffect.period));
    document.querySelectorAll('[data-led-period-value]').forEach(output => output.textContent = `${ledEffect.period}s`);
    if (persist) {
        try { localStorage.setItem(LED_EFFECT_KEY, JSON.stringify(ledEffect)); } catch (_) {}
    }
}

function mountLedEffects(container) {
    if (!container || container.childElementCount) return;
    const label = document.createElement('label');
    label.textContent = 'LED effect ';
    const select = document.createElement('select');
    select.dataset.ledEffect = '';
    select.setAttribute('aria-label', 'LED effect');
    select.title = 'Decorative pixel previews; not byte-identical hardware output. Music effects are in Music Mode.';
    LED_EFFECTS.forEach(effect => select.add(new Option(effect.label, effect.id)));
    label.append(select);
    const periodLabel = document.createElement('label');
    periodLabel.textContent = 'Cycle ';
    const period = document.createElement('input');
    period.type = 'range'; period.min = '4'; period.max = '30'; period.step = '1';
    period.dataset.ledPeriod = '';
    period.setAttribute('aria-label', 'LED effect cycle seconds');
    const output = document.createElement('output');
    output.dataset.ledPeriodValue = '';
    periodLabel.append(period, output);
    container.append(label, periodLabel);
    select.addEventListener('change', () => {ledGame.stop();ledMusic.stop();setLedEffect({ ...ledEffect, mode: select.value }, !EVENT_DEMO);});
    period.addEventListener('input', () => setLedEffect({ ...ledEffect, period: Number(period.value) }, !EVENT_DEMO));
    setLedEffect(ledEffect, false);
}

function mountLedPalette(container) {
    if (!container || container.childElementCount) return;
    LED_COLOR_PRESETS.forEach(({ name, value }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'led-preset';
        button.dataset.ledPreset = value;
        button.style.backgroundColor = value;
        button.setAttribute('aria-label', `${name} LED color`);
        button.setAttribute('aria-pressed', String(ledColor.toLowerCase() === value));
        button.title = name;
        button.addEventListener('click', () => setLedColor(value, !EVENT_DEMO));
        container.append(button);
    });
}

function setLedGlow(value, persist = true) {
    ledGlow = THREE.MathUtils.clamp(Number(value) || 0, 0, LED_FULL_BRIGHTNESS);
    const brightness = Math.round(ledGlow / LED_FULL_BRIGHTNESS * 100);
    const picker = document.getElementById('led-glow');
    if (picker && Number(picker.value) !== brightness) picker.value = String(brightness);
    const readout = document.getElementById('led-glow-value');
    if (readout) readout.textContent = `${brightness}%`;
    setLedsEnabled(ledsEnabled);
    if (persist) {
        try { localStorage.setItem(LED_GLOW_KEY, String(ledGlow)); } catch (_) {}
    }
}

function setLedSurface(key, value, persist = true) {
    if (!Object.hasOwn(LED_SURFACE_DEFAULTS, key)) return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    ledSurfaces[key] = THREE.MathUtils.clamp(number, 0, key.endsWith('Strength') ? 200 : 100);
    const slider = document.querySelector(`[data-led-surface="${key}"]`);
    if (slider) slider.value = String(ledSurfaces[key]);
    const readout = document.querySelector(`[data-led-surface-value="${key}"]`);
    if (readout) readout.textContent = `${Math.round(ledSurfaces[key])}%`;
    setLedsEnabled(ledsEnabled);
    if (persist) {
        try { localStorage.setItem(LED_SURFACE_KEY, JSON.stringify(ledSurfaces)); } catch (_) {}
    }
}

function syncSizeGeometry() {
    if (!sizeVariantParts) return;
    // Switching from Standard to Extended at a steep tilt needs two more inches
    // of clearance. Raise first, then reveal the larger desktop mesh.
    const tilt = primaryTiltConfig()?.currentDeg ?? 0;
    const minimum = minimumHeightForTilt(tilt, currentConfig.size);
    if (liftToHeight(currentLift) < minimum - 0.001) {
        currentLift = heightToLift(minimum);
        targetLift = Math.max(targetLift, currentLift);
        updateMovingObjectsPosition();
        showHeight(minimum);
    }
    targetLift = Math.max(targetLift, heightToLift(minimum));
    const extended = currentConfig.size === '60x30';
    const setVisible = (obj, visible) => {
        obj.visible = visible;
        const index = interactableObjects.indexOf(obj);
        if (visible && index === -1) interactableObjects.push(obj);
        if (!visible && index !== -1) interactableObjects.splice(index, 1);
    };
    setVisible(sizeVariantParts.smallTop, !extended);
    setVisible(sizeVariantParts.smallTrim, !extended);
    setVisible(sizeVariantParts.largeTop, extended);
    setVisible(sizeVariantParts.largeTrim, extended);
    syncLedSizeGeometry();
    setScreenProgress(screenProgress);
    buildSceneTree();
    if (measuredRoomProfile() && workspaceRoom?.roomLayout) setRoomScene(selectedRoomScene, false, { preserveDesk: true });
}

function syncLedSizeGeometry() {
    if (!ledDesktopFit || !sizeVariantParts) return;
    const extendedSize = currentConfig.size === '60x30';
    // Use the three authored Standard strips, and the two authored wide side
    // strips with the same center strip for Extended. The tiny red desktop
    // details in the original export are not in the panel pockets.
    for (let index = 3; index < 38; index++) if (ledParts[index]) ledParts[index].part.visible = false;
    if (ledStandardStrips) ledStandardStrips.visible = !extendedSize;
    if (ledExtendedStrips) ledExtendedStrips.visible = extendedSize;
}

async function loadTrimOverlay() {
    try {
        const gltf = await gltfLoader.loadAsync(TRIM_MODEL_URL);
        const trimNodes = gltf.scene.children.filter(node => {
            let hasMesh = false;
            node.traverse(obj => { if (obj.isMesh) hasMesh = true; });
            return hasMesh;
        });
        if (trimNodes.length !== TRIM_PARTS.length) {
            throw new Error(`Expected ${TRIM_PARTS.length} trim parts; found ${trimNodes.length}. Check the Rhino export before assigning motion.`);
        }

        trimMaterial = new THREE.MeshPhysicalMaterial({
            color: trimColor, metalness: 0.35, roughness: 0.45,
            // The Rhino trim consists of open surfaces; either face can be
            // visible as the desk tilts or the camera moves around it.
            side: THREE.DoubleSide, polygonOffset: true,
            polygonOffsetFactor: -1, polygonOffsetUnits: -1
        });
        const tiltParts = [];
        const smallTop = [...partRegistry.values()].map(entry => entry.obj).find(obj => {
            if (!obj.name.startsWith('Desktop') || !obj.geometry) return false;
            obj.geometry.computeBoundingBox();
            const size = obj.geometry.boundingBox.getSize(new THREE.Vector3());
            return size.x > 30 && size.z > 40 && size.y < 5;
        });
        if (!smallTop) throw new Error('Could not identify the original desktop surface.');
        gltf.scene.updateMatrixWorld(true);
        const sceneInverse = gltf.scene.matrixWorld.clone().invert();
        trimNodes.forEach((node, index) => {
            if (index === 0) return; // Replaced by the corrected small desktop trim export.
            // Rhino wrote each part as 16-197 separate primitives. Merge each
            // node into one selectable mesh so Studio shows ten trim parts.
            const geometries = [];
            node.traverse(child => {
                if (!child.isMesh) return;
                const geometry = child.geometry.clone();
                geometry.applyMatrix4(sceneInverse.clone().multiply(child.matrixWorld));
                geometries.push(geometry);
            });
            const geometry = mergeGeometries(geometries, false);
            geometries.forEach(part => part.dispose());
            if (!geometry) throw new Error(`Could not combine trim part ${index + 1}.`);
            const obj = new THREE.Mesh(geometry, trimMaterial);
            const spec = TRIM_PARTS[index];
            const editorId = `Trim_${String(index).padStart(2, '0')}`;
            obj.name = spec.name;
            obj.userData.editorId = editorId;
            obj.userData.isTrim = true;
            obj.castShadow = false;
            obj.receiveShadow = false;
            loadedModel.add(obj);
            // full.glb is authored above the viewer's 28-inch starting pose.
            // Shift only parts that ride the lift, matching the base loader.
            if (spec.role !== 'base') obj.position.y += LIFT_MIN;
            partRegistry.set(editorId, { obj, name: obj.name, editorId, isClone: false });
            interactableObjects.push(obj);
            captureAssetBaseline(obj);
            if (spec.role === 'lift') liftObjects.set(obj, { obj, baseY: obj.position.y });
            if (spec.role === 'tilt') tiltParts.push(obj);
        });

        const [smallGltf, largeGltf, largeTrimGltf] = await Promise.all([
            gltfLoader.loadAsync(SMALL_TRIM_MODEL_URL),
            gltfLoader.loadAsync(LARGE_DESKTOP_MODEL_URL),
            gltfLoader.loadAsync(LARGE_DESKTOP_TRIM_URL)
        ]);
        if (smallGltf.scene.children.length !== 3 || largeGltf.scene.children.length !== 2 || largeTrimGltf.scene.children.length !== 1) {
            throw new Error('The size variant exports no longer contain the expected parts.');
        }
        const addVariantNode = (source, index, name, editorId, role, material, isTrim) => {
            source.scene.updateMatrixWorld(true);
            const inverse = source.scene.matrixWorld.clone().invert();
            const shift = new THREE.Matrix4().makeTranslation(-100, 0, 0);
            const geometries = [];
            source.scene.children[index].traverse(child => {
                if (!child.isMesh) return;
                const geometry = child.geometry.clone();
                geometry.applyMatrix4(inverse.clone().multiply(child.matrixWorld).premultiply(shift));
                geometries.push(geometry);
            });
            const geometry = mergeGeometries(geometries, false);
            geometries.forEach(part => part.dispose());
            if (!geometry) throw new Error(`Could not combine ${name}.`);
            const obj = new THREE.Mesh(geometry, material);
            obj.name = name;
            obj.userData.editorId = editorId;
            obj.userData.isTrim = isTrim;
            obj.userData.isSizeVariant = true;
            obj.castShadow = !isTrim;
            obj.receiveShadow = !isTrim;
            obj.position.y = LIFT_MIN;
            loadedModel.add(obj);
            partRegistry.set(editorId, { obj, name, editorId, isClone: false });
            interactableObjects.push(obj);
            captureAssetBaseline(obj);
            if (role === 'lift') liftObjects.set(obj, { obj, baseY: obj.position.y });
            if (role === 'tilt') tiltParts.push(obj);
            return obj;
        };
        addVariantNode(smallGltf, 0, 'Lower shelf trim', 'Trim_Shelf_Lower', 'lift', trimMaterial, true);
        addVariantNode(smallGltf, 1, 'Upper shelf trim', 'Trim_Shelf_Upper', 'lift', trimMaterial, true);
        const smallTrim = addVariantNode(smallGltf, 2, 'Standard desktop trim', 'Trim_Desktop_Standard', 'tilt', trimMaterial, true);
        const largeTop = addVariantNode(largeGltf, 0, 'Extended desktop', 'Variant_Desktop_Extended', 'tilt', smallTop.material, false);
        const largeTrim = addVariantNode(largeTrimGltf, 0, 'Extended desktop trim', 'Trim_Desktop_Extended', 'tilt', trimMaterial, true);
        sizeVariantParts = { smallTop, smallTrim, largeTop, largeTrim };
        syncSizeGeometry();
        return tiltParts;
    } catch (error) {
        console.warn('[ErgoFlex] Trim overlay did not load:', error);
        return [];
    }
}

// Rhino exports these overlays in the same rest pose as full.glb. Their X
// positions are shifted for export, so bake that translation into each mesh.
function makeOverlayNode(gltf, index, xShift, material, name) {
    gltf.scene.updateMatrixWorld(true);
    const sceneInverse = gltf.scene.matrixWorld.clone().invert();
    const group = new THREE.Group();
    group.name = name;
    const node = gltf.scene.children[index];
    if (!node) throw new Error(`Missing ${name} in GLB export.`);
    node.traverse(child => {
        if (!child.isMesh) return;
        const geometry = child.geometry.clone();
        geometry.applyMatrix4(sceneInverse.clone().multiply(child.matrixWorld));
        geometry.translate(xShift, 0, 0);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        group.add(mesh);
    });
    return group;
}

function updateTouchscreenDisplay() {
    const mode=measuredRoomProfile()?.mode;
    const theme=document.getElementById('studio-environment')?.value==='led'||['evening','night','party'].includes(mode)?'dark':'light';
    const changed=touchscreenDisplay.update({theme,height:Math.round(liftToHeight(currentLift)*10)/10,tilt:Math.round(primaryTiltConfig()?.currentDeg||0),
        guard:roomSafety.guard,sound:ledSounds.enabled,leds:ledsEnabled,alert:roomSafety.alert,
        heightSpeed:document.querySelector('#lift-speed option:checked')?.textContent?.trim()||'Medium',
        glideSpeed:document.querySelector('#glide-speed option:checked')?.textContent?.trim()||'Medium',
        tiltSpeed:document.querySelector('#tilt-speed option:checked')?.textContent?.trim()||'Fast',
        heightJog:Math.round(liftJog*10)/10,phase:mode||'Workspace',moving:!!(glideInput.lengthSq()||yawCommand||liftJog||tiltJog||glideActive||Math.abs(targetLift-currentLift)>.001)});
    if(changed&&touchscreenTexture)touchscreenTexture.needsUpdate=true;
}

function mountSafetyAlert() {
    if(document.getElementById('room-safety-alert'))return;
    const card=document.createElement('section');card.id='room-safety-alert';card.hidden=true;card.setAttribute('role','alert');
    card.innerHTML='<header><strong data-safety-title></strong><span>Desk stopped · movement held</span></header><div class="safety-content"><p data-safety-message></p><p class="safety-source" data-safety-source></p><p>Check the area around the desk, then press CLEAR before resuming.</p><button type="button" data-safety-clear>✓ CLEAR</button><small>3D preview · room geometry</small></div>';
    card.querySelector('[data-safety-clear]').onclick=clearCollisionAlert;document.body.append(card);
}
let safetyUIPrev='';
function syncSafetyUI() {
    const state=JSON.stringify([roomSafety.guard,roomSafety.alert,ledSounds.enabled,dockThemeName()]);if(state===safetyUIPrev)return;safetyUIPrev=state;
    const shield=document.getElementById('remote-shield');if(shield){shield.setAttribute('aria-pressed',String(roomSafety.guard));shield.title=roomSafety.guard?'Shield ON · stop 15 cm before contact':'Shield OFF · contact alerts active';}
    const sound=document.getElementById('remote-alert-sound');if(sound)sound.setAttribute('aria-pressed',String(ledSounds.enabled));
    document.querySelectorAll('[data-led-sounds]').forEach(input=>input.checked=ledSounds.enabled);
    const card=document.getElementById('room-safety-alert');if(!card)return;
    const alert=roomSafety.alert;card.hidden=!alert;card.dataset.theme=dockThemeName();
    if(alert){
        const ahead=alert.kind==='ahead';card.dataset.kind=alert.kind;
        card.querySelector('[data-safety-title]').textContent=ahead?'⚠ OBSTACLE AHEAD':alert.pushable?'✖ COLLISION':'✖ HEAVY COLLISION';
        card.querySelector('[data-safety-message]').textContent=ahead?'Shield stopped the desk before contact with '+alert.name+'.':'Desk stopped after detecting resistance from '+alert.name+'.';
        card.querySelector('[data-safety-source]').textContent='Source: Wheels'+(ahead?' · Preview clearance 15 cm (6 in)':'');
    }
}
function setCollisionGuard(on){roomSafety.guard=!!on;syncSafetyUI();updateTouchscreenDisplay();}
function announceRoomSafety(event){
    haltAllMotion();roomCollisionBlocked=true;glideUIPrev='';syncGlideUI();syncSafetyUI();updateTouchscreenDisplay();ledSounds.alert(event.kind);
}
function clearCollisionAlert(){
    haltAllMotion();roomSafety.clear();roomCollisionBlocked=false;glideUIPrev='';syncGlideUI();syncSafetyUI();updateTouchscreenDisplay();updateLedEffectFrame();
}

function makeTouchscreenFace(gltf, xShift, pivot, turn, material, name) {
    const face = makeOverlayNode(gltf, 0, xShift, material, name);
    face.children.forEach(mesh => {
        // Rhino's U runs across the short side of this panel and V along its
        // long side. The supplied 1024x600 image runs the other way.
        const uv = mesh.geometry.getAttribute('uv');
        if (!uv) throw new Error('Touchscreen display mesh has no UV coordinates.');
        for (let i = 0; i < uv.count; i++) {
            const u = uv.getX(i), v = uv.getY(i);
            uv.setXY(i, v, u);
        }
        uv.needsUpdate = true;
        mesh.geometry.translate(-pivot.x, -pivot.y, 0);
        mesh.geometry.rotateZ(-turn);
    });
    return face;
}

function setScreenProgress(value) {
    screenProgress = THREE.MathUtils.clamp(value, 0, 1);
    if (!screenAssembly) return;
    const { variants, baseParts } = screenAssembly;
    const opened = screenProgress > 0.001;
    baseParts.forEach(mesh => { mesh.visible = !opened; });
    const slide = Math.min(1, screenProgress * 2);
    const turn = Math.max(0, (screenProgress - 0.5) * 2);
    for (const [size, { moving, staticParts, pivot }] of Object.entries(variants)) {
        const visible = opened && (size === (currentConfig.size === '60x30' ? 'wide' : 'standard'));
        moving.visible = visible;
        staticParts.visible = visible;
        moving.position.x = pivot.x - SCREEN_SLIDE * (1 - slide);
        moving.rotation.z = SCREEN_TURN * turn;
    }
}

function setTouchscreenOpen(open) {
    screenTarget = open ? 1 : 0;
    document.body.dataset.touchscreenTarget = String(screenTarget);
    document.querySelectorAll('[data-touchscreen-toggle]').forEach(button =>
        button.setAttribute('aria-pressed', String(!!open)));
}

async function loadTouchscreenAssembly() {
    try {
        const [pulled, extended, wide] = await Promise.all([
            gltfLoader.loadAsync(TOUCHSCREEN_PULLED_URL),
            gltfLoader.loadAsync(TOUCHSCREEN_EXTENDED_URL),
            gltfLoader.loadAsync(TOUCHSCREEN_WIDE_URL)
        ]);
        if (pulled.scene.children.length !== 7 || extended.scene.children.length !== 12 || wide.scene.children.length !== 12)
            throw new Error('Touchscreen exports have changed; recheck the motion mapping.');
        updateTouchscreenDisplay();
        const faceTexture = touchscreenTexture = new THREE.CanvasTexture(touchscreenDisplay.canvas);
        faceTexture.colorSpace = THREE.SRGBColorSpace;
        faceTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        const faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture, side: THREE.DoubleSide, toneMapped: false });
        const dark = new THREE.MeshPhysicalMaterial({ color: 0x10141c, metalness: 0.4, roughness: 0.27, side: THREE.DoubleSide });
        const glass = new THREE.MeshPhysicalMaterial({ color: 0x111b29, metalness: 0.1, roughness: 0.16, side: THREE.DoubleSide });
        const metal = new THREE.MeshStandardMaterial({ color: 0x444a50, metalness: 0.75, roughness: 0.32, side: THREE.DoubleSide });
        const root = new THREE.Group();
        root.name = 'Animated touchscreen';
        root.position.y = LIFT_MIN;
        const moving = new THREE.Group();
        moving.position.copy(SCREEN_PIVOT);
        // The first five pulled-out nodes and extended nodes 5..1 are the same
        // rigid assembly. Their measured transform is a 146.46-degree turn.
        for (let i = 0; i < 5; i++) {
            const part = makeOverlayNode(pulled, i, -200, i === 0 ? glass : dark, `Touchscreen moving ${i + 1}`);
            part.children.forEach(mesh => mesh.geometry.translate(-SCREEN_PIVOT.x, -SCREEN_PIVOT.y, 0));
            moving.add(part);
        }
        // Extended node 0 is a detail absent from the pulled-out export.
        moving.add(makeTouchscreenFace(extended, -200, SCREEN_PIVOT, SCREEN_TURN,
            faceMaterial, 'Standard touchscreen display'));
        const staticParts = new THREE.Group();
        staticParts.name = 'Touchscreen slide rails';
        for (const i of [5, 6]) staticParts.add(makeOverlayNode(pulled, i, -200, metal, `Touchscreen rail ${i}`));
        for (const i of [6, 7, 8, 9]) staticParts.add(makeOverlayNode(extended, i, -200, metal, `Touchscreen extension ${i}`));
        // Reverse the wide export around its pivot, correcting its 12° extra
        // face tilt so both sizes share the same open angle and animation.
        const wideMoving = new THREE.Group();
        wideMoving.position.copy(WIDE_SCREEN_PIVOT);
        wideMoving.add(makeTouchscreenFace(wide, -100, WIDE_SCREEN_PIVOT, WIDE_SCREEN_REST_TURN,
            faceMaterial, 'Extended touchscreen display'));
        for (const i of [1, 8, 9, 10, 11]) {
            const part = makeOverlayNode(wide, i, -100, dark, `Extended touchscreen moving ${i}`);
            part.children.forEach(mesh => {
                mesh.geometry.translate(-WIDE_SCREEN_PIVOT.x, -WIDE_SCREEN_PIVOT.y, 0);
                mesh.geometry.rotateZ(-WIDE_SCREEN_REST_TURN);
            });
            wideMoving.add(part);
        }
        const wideStatic = new THREE.Group();
        wideStatic.name = 'Extended touchscreen slide rails';
        for (const i of [2, 3, 4, 5, 6, 7])
            wideStatic.add(makeOverlayNode(wide, i, -100, metal, `Extended touchscreen rail ${i}`));
        // Keep the wide screen the same distance from the front and right
        // desktop edges as the Standard screen. The wide GLB changes its X
        // anchor, but its Z position remains at the Standard desktop edge.
        const standardTopBounds = sizeVariantParts.smallTop.geometry;
        const wideTopBounds = sizeVariantParts.largeTop.geometry;
        standardTopBounds.computeBoundingBox();
        wideTopBounds.computeBoundingBox();
        const wideMount = new THREE.Group();
        wideMount.name = 'Extended touchscreen edge alignment';
        wideMount.position.set(
            wideTopBounds.boundingBox.max.x - standardTopBounds.boundingBox.max.x
                - (WIDE_SCREEN_PIVOT.x - SCREEN_PIVOT.x),
            0,
            wideTopBounds.boundingBox.min.z - standardTopBounds.boundingBox.min.z
        );
        wideMount.add(wideStatic, wideMoving);
        root.add(staticParts, moving, wideMount);
        loadedModel.add(root);
        const baseParts = [...partRegistry.values()].map(entry => entry.obj)
            .filter(obj => /^Touch_Screen(?:_|$)/.test(obj.name));
        screenAssembly = { root, baseParts, variants: {
            standard: { moving, staticParts, pivot: SCREEN_PIVOT },
            wide: { moving: wideMoving, staticParts: wideStatic, pivot: WIDE_SCREEN_PIVOT }
        } };
        setScreenProgress(screenProgress);
        return root;
    } catch (error) {
        console.warn('[ErgoFlex] Touchscreen animation did not load:', error);
        return null;
    }
}

function setLedsEnabled(on) {
    ledsEnabled = !!on;
    document.body.dataset.ledsEnabled = String(ledsEnabled);
    ledParts.forEach(({ material, color }) => {
        material.color.set(color).multiplyScalar(ledsEnabled ? 1 : 0.12);
        material.emissive.set(color);
        material.emissiveIntensity = ledsEnabled ? 3.6 * ledGlow / 100 : 0;
    });
    ledSpillMaterials.forEach(({ material, receiver, minReach, maxReach }) => {
        material.uniforms.strength.value = ledsEnabled
            ? ledGlow * ledSurfaces[`${receiver}Strength`] / 10000 : 0;
        material.uniforms.fadeReach.value = minReach +
            (maxReach - minReach) * ledSurfaces[`${receiver}Reach`] / 100;
        if (material.uniforms.falloffPower) {
            const sharpness = ledSurfaces[`${receiver}Sharpness`] ?? 0;
            material.uniforms.falloffPower.value = 2 + 6 * sharpness / 100;
        }
        if (receiver === 'desktop' && material.uniforms.stripBaseSpread) {
            const width = ledSurfaces.desktopWidth;
            material.uniforms.stripBaseSpread.value = width <= 20
                ? -3 + width / 5 : 1 + (width - 20) / 20;
            material.uniforms.stripFanSlope.value = ledSurfaces.desktopCone / 400;
            material.uniforms.stripFeather.value = 0.2 + ledSurfaces.desktopEdgeFade / 25;
        }
        if (receiver === 'floor' && material.uniforms.stripHalfSpan)
            material.uniforms.stripHalfSpan.value = 0.08 + 0.003 * ledSurfaces.floorWidth;
    });
    updateDesktopReflectionTilt();
    document.querySelectorAll('[data-led-toggle],.hub-led').forEach(button =>
        button.setAttribute('aria-pressed', String(ledsEnabled)));
    document.dispatchEvent(new CustomEvent('ergoflex-led-state', {detail:{enabled:ledsEnabled}}));
    updateLedEffectFrame();
}

function updateDesktopReflectionTilt() {
    // Owner-observed footprint: the authored -5° look covers roughly 80% of
    // the depth; level reaches the front. Positive tilt fills the front more.
    // Keep the rear edge anchored and saturate gently once the desk is raised.
    const tilt = primaryTiltConfig()?.currentDeg ?? -5;
    const depthScale = 1 + 0.25 * THREE.MathUtils.smoothstep(tilt, -5, 0)
        + 0.6 * THREE.MathUtils.smoothstep(tilt, 0, 15);
    for (const { material } of ledSpillMaterials) {
        if (material.uniforms.desktopDepthScale)
            material.uniforms.desktopDepthScale.value = depthScale;
    }
}

function addLedSurfaceSpill(surface, receiver, centerX, centerZ, zRadius,
    minReach, maxReach, peakAlpha, stripBounds = null, referenceSurface = null,
    reflectionBands = null) {
    // Follow the actual panel mesh so the light fade respects its outline and
    // cutouts as the lift, tilt, and desktop size change.
    const material = new THREE.ShaderMaterial({
        uniforms: {
            reflectionFrame: { value: new THREE.Matrix4() },
            reflectionNormal: { value: new THREE.Matrix3() },
            ledColor: { value: new THREE.Color(ledColor) },
            strength: { value: 0 },
            fadeReach: { value: (minReach + maxReach) / 2 },
            centerX: { value: centerX },
            centerZ: { value: centerZ },
            zRadius: { value: zRadius },
            peakAlpha: { value: peakAlpha },
            stripMinZ: { value: stripBounds?.minZ ?? 0 },
            stripMaxZ: { value: stripBounds?.maxZ ?? 0 },
            stripFeather: { value: stripBounds?.feather ?? 1 },
            stripSourceX: { value: stripBounds?.sourceX ?? 0 },
            stripBaseSpread: { value: stripBounds?.baseSpread ?? 0 },
            stripFanSlope: { value: stripBounds?.fanSlope ?? 0 },
            stripFanLimit: { value: stripBounds?.fanLimit ?? 0 },
            falloffPower: { value: 2 },
            reflectionBandActive: { value: reflectionBands ? 1 : 0 },
            reflectionBandCenters: { value: new THREE.Vector3(...(reflectionBands?.map(b => b.centerX) ?? [0, 0, 0])) },
            reflectionBandGains: { value: new THREE.Vector3(...(reflectionBands?.map(b => b.gain) ?? [1, 1, 1])) },
            reflectionBandWidths: { value: new THREE.Vector3(...(reflectionBands?.map(b => b.width) ?? [1, 1, 1])) }
        },
        vertexShader: `
            uniform mat4 reflectionFrame;
            uniform mat3 reflectionNormal;
            varying vec3 ledPosition;
            varying vec3 ledNormal;
            void main() {
                ledPosition = (reflectionFrame * vec4(position, 1.0)).xyz;
                ledNormal = reflectionNormal * normal;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 ledColor;
            uniform float strength;
            uniform float fadeReach;
            uniform float centerX;
            uniform float centerZ;
            uniform float zRadius;
            uniform float peakAlpha;
            uniform float stripMinZ;
            uniform float stripMaxZ;
            uniform float stripFeather;
            uniform float stripSourceX;
            uniform float stripBaseSpread;
            uniform float stripFanSlope;
            uniform float stripFanLimit;
            uniform float falloffPower;
            uniform float reflectionBandActive;
            uniform vec3 reflectionBandCenters;
            uniform vec3 reflectionBandGains;
            uniform vec3 reflectionBandWidths;
            uniform float desktopDepthScale;
            uniform float desktopRearX;
            varying vec3 ledPosition;
            varying vec3 ledNormal;
            void main() {
                float top = smoothstep(0.55, 0.95, normalize(ledNormal).y);
                float dx = (ledPosition.x - centerX) / fadeReach;
                float dz = (ledPosition.z - centerZ) / zRadius;
                float pool = exp(-0.5 * (dx * dx + dz * dz));
                float endFade = exp(-0.5 * dz * dz);
                if (stripMaxZ > stripMinZ) {
                    // The adjustable strip width and forward fan describe
                    // light bouncing past the shelf side plates.
                    float forward = max(0.0, ledPosition.x - stripSourceX);
                    float fan = min(stripFanLimit, forward * stripFanSlope);
                    float bandMin = stripMinZ - stripBaseSpread - fan;
                    float bandMax = stripMaxZ + stripBaseSpread + fan;
                    // Distance to a finite light strip gives its ends rounded
                    // falloff, avoiding a flat rectangular edge at oblique views.
                    float beyondEnd = max(max(bandMin - ledPosition.z,
                        ledPosition.z - bandMax), 0.0);
                    float across = exp(-0.5 * pow(abs(dx), falloffPower));
                    endFade = exp(-0.5 * pow(beyondEnd / stripFeather, 2.0));
                    pool = across * endFade;
                }
                vec3 reflectionWeights = vec3(pool, 0.0, 0.0);
                if (reflectionBandActive > 0.5) {
                    // Three overlapping depth pools: lower shelf nearest the
                    // back, upper front underneath in the middle, upper back
                    // underneath farther forward. Keep the photos' soft edges
                    // even at high sharpness, and share the existing width fan.
                    // Stretch the depth field forward from the rear edge as
                    // tilt increases. At -5° this is the original light field.
                    float reflectedX = desktopRearX + (ledPosition.x - desktopRearX)
                        / max(1.0, desktopDepthScale);
                    vec3 distance = abs(vec3(reflectedX) - reflectionBandCenters)
                        / (max(0.8, fadeReach * 0.24) * reflectionBandWidths);
                    float softness = mix(1.6, 2.4, clamp((falloffPower - 2.0) / 6.0, 0.0, 1.0));
                    reflectionWeights = exp(-0.5 * pow(distance, vec3(softness)))
                        * reflectionBandGains * endFade;
                    pool = min(1.25, dot(reflectionWeights, vec3(1.0)));
                }
                float alpha = min(0.9, peakAlpha * strength * pool * top);
                gl_FragColor = vec4(ledColor, alpha);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.FrontSide
    });
    if (reflectionBands) {
        // Both desktop sizes and their power modules use the same authored
        // rear anchor, so the colour bands stay aligned through every pose.
        material.uniforms.desktopDepthScale = { value: 1 };
        material.uniforms.desktopRearX = { value: -177.3 };
    }
    const spill = new THREE.Mesh(surface.geometry, material);
    spill.name = `${surface.name} LED reflection`;
    spill.renderOrder = 1;
    spill.raycast = () => {};
    if (referenceSurface) {
        // Power modules share the desktop's light field, but retain their own
        // mesh and mounting transform as the desk lifts, tilts, or is edited.
        spill.onBeforeRender = () => {
            material.uniforms.reflectionFrame.value.copy(referenceSurface.matrixWorld)
                .invert().multiply(surface.matrixWorld);
            material.uniforms.reflectionNormal.value.getNormalMatrix(
                material.uniforms.reflectionFrame.value);
        };
    }
    surface.add(spill);
    ledSpillMaterials.push({ material, receiver, minReach, maxReach, reflectionBands,
        ...(reflectionBands ? { sourceIds: reflectionBands.map(b => b.sourceId) } : {}) });
}

function addLedWingSpill(surface, receiver, inside = false) {
    // The two side wings are nearly vertical. Their reflection needs an X/Y
    // fade, unlike the horizontal desktop and shelves above.
    const minReach = 5;
    const maxReach = 18;
    surface.geometry.computeBoundingBox();
    const outward = Math.sign(surface.geometry.boundingBox.getCenter(new THREE.Vector3()).z + 327.1) || 1;
    const material = new THREE.ShaderMaterial({
        uniforms: {
            ledColor: { value: new THREE.Color(ledColor) },
            strength: { value: 0 },
            faceSign: { value: inside ? -outward : outward },
            bounceGain: { value: inside ? 0.18 : 1 },
            fadeReach: { value: (minReach + maxReach) / 2 }
        },
        vertexShader: `
            varying vec3 ledPosition;
            varying vec3 ledNormal;
            void main() {
                ledPosition = position;
                ledNormal = normal;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 ledColor;
            uniform float strength;
            uniform float fadeReach;
            uniform float faceSign;
            uniform float bounceGain;
            varying vec3 ledPosition;
            varying vec3 ledNormal;
            void main() {
                float face = smoothstep(0.7, 0.95, normalize(ledNormal).z * faceSign);
                float dx = (ledPosition.x + 159.8) / fadeReach;
                float dy = (ledPosition.y - 48.5) / 7.0;
                float pool = exp(-0.5 * (dx * dx + dy * dy));
                float alpha = min(0.75, 0.38 * strength * pool * face * bounceGain);
                gl_FragColor = vec4(ledColor, alpha);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide
    });
    const spill = new THREE.Mesh(surface.geometry, material);
    spill.name = `${surface.name} LED wing ${inside ? 'inner bounce' : 'outer reflection'}`;
    spill.renderOrder = 1;
    spill.raycast = () => {};
    surface.add(spill);
    ledSpillMaterials.push({ material, receiver, minReach, maxReach, sourceIds: inside ? [4] : receiver === 'leftWing' ? [5] : [6] });
    if (!inside) addLedWingSpill(surface, receiver, true);
}

function addLedUprightSpill(surface, strip, receiver, direction, minY, maxY, options = {}) {
    // Shade only the actual inward-facing board/column geometry. The nearest
    // point on the LED segment produces soft bounce along the entire strip.
    const minReach = options.minReach ?? 5;
    const maxReach = options.maxReach ?? 12;
    surface.geometry.computeBoundingBox();
    const surfaceBox = surface.geometry.boundingBox;
    const stripBox = new THREE.Box3().setFromObject(strip);
    const stripCenter = stripBox.getCenter(new THREE.Vector3());
    const stripSize = stripBox.getSize(new THREE.Vector3());
    const alongX = stripSize.x > stripSize.z;
    const halfLength = (alongX ? stripSize.x : stripSize.z) / 2;
    const material = new THREE.ShaderMaterial({
        uniforms: {
            ledColor: { value: new THREE.Color(ledColor) },
            strength: { value: 0 },
            fadeReach: { value: minReach },
            reflectionFrame: { value: new THREE.Matrix4() },
            reflectionNormal: { value: new THREE.Matrix3() },
            stripCenter: { value: stripCenter },
            halfLength: { value: halfLength },
            stripAxis: { value: alongX ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1) },
            sourceActive: { value: 1 },
            gain: { value: options.gain ?? 1 },
            uprightOnly: { value: options.uprightOnly === false ? 0 : 1 },
            cage: { value: options.cage ? 1 : 0 },
            surfaceMinY: { value: surfaceBox.min.y },
            surfaceMaxY: { value: surfaceBox.max.y },
            direction: { value: direction },
            minY: { value: minY },
            maxY: { value: maxY }
        },
        vertexShader: `
            uniform mat4 reflectionFrame;
            uniform mat3 reflectionNormal;
            varying vec3 ledPosition;
            varying vec3 ledNormal;
            varying float surfaceY;
            void main() {
                surfaceY = position.y;
                ledPosition = (reflectionFrame * vec4(position, 1.0)).xyz;
                ledNormal = reflectionNormal * normal;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 ledColor;
            uniform float strength;
            uniform float fadeReach;
            uniform vec3 stripCenter;
            uniform float halfLength;
            uniform vec3 stripAxis;
            uniform float sourceActive;
            uniform float gain;
            uniform float uprightOnly;
            uniform float cage;
            uniform float surfaceMinY;
            uniform float surfaceMaxY;
            uniform float direction;
            uniform float minY;
            uniform float maxY;
            varying vec3 ledPosition;
            varying vec3 ledNormal;
            varying float surfaceY;
            void main() {
                vec3 nearest = stripCenter;
                nearest += stripAxis * clamp(dot(ledPosition - stripCenter, stripAxis), -halfLength, halfLength);
                vec3 towardLight = nearest - ledPosition;
                float distanceToStrip = length(towardLight);
                vec3 normal = normalize(ledNormal);
                float facing = max(dot(normal, towardLight / max(distanceToStrip, 0.001)), 0.0);
                float upright = 1.0 - smoothstep(0.35, 0.7, abs(normal.y));
                float emitted = smoothstep(-0.12, 0.12,
                    direction * (ledPosition.y - stripCenter.y));
                // Shelves block spill into the next compartment. Feather the
                // boundary on the receiving geometry to keep it continuous.
                float compartment = smoothstep(minY - 0.2, minY + 0.2, ledPosition.y)
                    * (1.0 - smoothstep(maxY - 0.2, maxY + 0.2, ledPosition.y));
                float pool = exp(-0.5 * pow(distanceToStrip / fadeReach, 2.0));
                // Include light arriving from farther along the strip. A
                // nearest-point-only field misses the inside column faces
                // because their normals point along the strip itself.
                float lineBounce = 0.0;
                for (int sampleIndex = 0; sampleIndex < 5; sampleIndex++) {
                    vec3 samplePoint = stripCenter;
                    samplePoint += stripAxis * halfLength * (float(sampleIndex) * 0.5 - 1.0);
                    vec3 ray = samplePoint - ledPosition;
                    float rayLength = max(length(ray), 0.001);
                    lineBounce += max(dot(normal, ray / rayLength), 0.0)
                        * exp(-0.5 * pow(rayLength / fadeReach, 2.0)) / 5.0;
                }
                float reflected = 0.5 * (pool * facing + lineBounce);
                float lowerEdge = 1.0 - smoothstep(surfaceMinY + 0.15,
                    max(surfaceMinY + 0.3, surfaceMaxY + 0.1), surfaceY);
                float occlusion = mix(1.0, lowerEdge, cage);
                // The cage receives weak indirect bounce along its lower
                // edge, including faces pointing away from the direct strip.
                reflected += cage * 0.08 * pool;
                float alpha = min(0.55, 0.28 * strength * gain * sourceActive * reflected
                    * mix(1.0, upright, uprightOnly) * emitted * compartment * occlusion);
                gl_FragColor = vec4(ledColor, alpha);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.FrontSide
    });
    const spill = new THREE.Mesh(surface.geometry, material);
    spill.name = `${surface.name} ${receiver}${options.actuator ? ' LED actuator reflection' : options.underside ? ' LED underside reflection' : ' LED upright reflection'}`;
    spill.renderOrder = 1;
    spill.raycast = () => {};
    // Strip geometry is baked in the shelf rig frame. Columns may move by a
    // different amount during lift, so project them into that moving frame.
    const frame = new THREE.Matrix4();
    spill.onBeforeRender = () => {
        let active = true;
        for (let node = strip; node; node = node.parent) active &&= node.visible;
        material.uniforms.sourceActive.value = active ? 1 : 0;
        frame.copy(strip.parent.matrixWorld).invert().multiply(surface.matrixWorld);
        material.uniforms.reflectionFrame.value.copy(frame);
        material.uniforms.reflectionNormal.value.getNormalMatrix(frame);
    };
    surface.add(spill);
    ledSpillMaterials.push({ material, receiver, minReach, maxReach, strip });
}

function addFootLedFloorGlow(parent) {
    // ShadowMaterial catches shadows but cannot display the LED color. Place a
    // separate transparent pool just above the floor and parent it to the
    // desk base so it follows glide and rotation without following lift.
    const minReach = 0.06;
    const maxReach = 0.35;
    const material = new THREE.ShaderMaterial({
        uniforms: {
            ledColor: { value: new THREE.Color(ledColor) },
            strength: { value: 0 },
            fadeReach: { value: (minReach + maxReach) / 2 },
            stripHalfSpan: { value: 0.23 },
            falloffPower: { value: 2 }
        },
        vertexShader: `
            varying vec2 ledUv;
            void main() {
                ledUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 ledColor;
            uniform float strength;
            uniform float fadeReach;
            uniform float stripHalfSpan;
            uniform float falloffPower;
            varying vec2 ledUv;
            void main() {
                // The foot LED is a long strip across the desk. Measure the
                // falloff from that segment, including its softly rounded ends.
                float across = abs(ledUv.x - 0.5) / fadeReach;
                float pastEnd = max(abs(ledUv.y - 0.5) - stripHalfSpan, 0.0) / 0.08;
                float pool = exp(-0.5 * pow(length(vec2(across, pastEnd)), falloffPower));
                float edge = 1.0 - smoothstep(0.43, 0.5, abs(ledUv.x - 0.5));
                float alpha = min(0.6, 0.34 * strength * pool * edge);
                gl_FragColor = vec4(ledColor, alpha);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), material);
    glow.name = 'Foot LED floor glow';
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(-159.2, loadedModel.worldToLocal(new THREE.Vector3(0, 0.012, 0)).y, -327.1);
    glow.renderOrder = 1;
    glow.raycast = () => {};
    parent.add(glow);
    ledSpillMaterials.push({ material, receiver: 'floor', minReach, maxReach });
}

function revealCenterLed(part, desktopGeometry) {
    const underside = new THREE.Mesh(desktopGeometry,
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const center = new THREE.Box3().setFromObject(part);
    const ray = new THREE.Raycaster(
        new THREE.Vector3((center.min.x + center.max.x) / 2, -100,
            (center.min.z + center.max.z) / 2),
        new THREE.Vector3(0, 1, 0), 0, 200);
    const hit = ray.intersectObject(underside, false)[0];
    if (hit) part.position.y += Math.min(0, hit.point.y - center.min.y - 0.06);
    underside.material.dispose();
}

async function loadLedOverlay() {
    try {
        const [gltf, wideGltf] = await Promise.all([
            gltfLoader.loadAsync(LED_MODEL_URL),
            gltfLoader.loadAsync(WIDE_DESKTOP_LED_URL)
        ]);
        if (gltf.scene.children.length !== 43)
            throw new Error('LED export has changed; recheck panel assignments.');
        if (wideGltf.scene.children.length !== 2)
            throw new Error('Wide desktop LED export must contain its two side strips.');
        const roots = { base: new THREE.Group(), lift: new THREE.Group(), tilt: new THREE.Group() };
        roots.base.name = 'Base LEDs';
        roots.lift.name = 'Shelf LEDs';
        roots.tilt.name = 'Desktop LEDs';
        ledDesktopFit = new THREE.Group();
        ledDesktopFit.name = 'Desktop LED size fit';
        roots.tilt.add(ledDesktopFit);
        ledParts = [];
        ledSpillMaterials = [];
        gltf.scene.children.forEach((_, index) => {
            const color = index >= 3 && index <= 37 ? 0xff2828 : ledColor;
            const material = new THREE.MeshStandardMaterial({ color, emissive: color,
                roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide,
                polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
            const role = index === 38 ? 'base' : index >= 39 ? 'lift' : 'tilt';
            const part = makeOverlayNode(gltf, index, -100, material, `${roots[role].name} ${index + 1}`);
            (role === 'tilt' ? ledDesktopFit : roots[role]).add(part);
            ledParts.push({ part, material, color });
        });
        ledStandardStrips = new THREE.Group();
        ledStandardStrips.name = 'Standard desktop underside LEDs';
        for (let index = 0; index < 3; index++) ledStandardStrips.add(ledParts[index].part);
        ledExtendedStrips = new THREE.Group();
        ledExtendedStrips.name = 'Extended desktop underside LEDs';
        for (let index = 0; index < 2; index++) {
            ledExtendedStrips.add(makeOverlayNode(wideGltf, index, -100,
                ledParts[index].material, `Extended desktop side LED ${index + 1}`));
        }
        const wideCenter = ledParts[2].part.clone(true);
        wideCenter.name = 'Extended desktop center LED';
        ledExtendedStrips.add(wideCenter);
        const standardTop = sizeVariantParts.smallTop;
        standardTop.updateMatrixWorld(true);
        loadedModel.updateMatrixWorld(true);
        const standardGeometry = standardTop.geometry.clone();
        standardGeometry.applyMatrix4(loadedModel.matrixWorld.clone().invert().multiply(standardTop.matrixWorld));
        standardGeometry.translate(0, -LIFT_MIN, 0);
        revealCenterLed(ledParts[2].part, standardGeometry);
        standardGeometry.dispose();
        revealCenterLed(wideCenter, sizeVariantParts.largeTop.geometry);
        const lowerShelf = [...partRegistry.values()].find(({ obj }) => obj.name === 'Top_Shelf_3')?.obj;
        const topShelf = [...partRegistry.values()].find(({ obj }) => obj.name === 'Top_Shelf_4')?.obj;
        const baseShelf = [...partRegistry.values()].find(({ obj }) => obj.name === 'Base_Panels_3')?.obj;
        const leftWing = [...partRegistry.values()].find(({ obj }) => obj.name === 'Desktop_1')?.obj;
        const rightWing = [...partRegistry.values()].find(({ obj }) => obj.name === 'Desktop_2')?.obj;
        if (!lowerShelf || !topShelf || !baseShelf || !leftWing || !rightWing)
            throw new Error('LED receiver is missing.');
        // The three underside shelf strips cast separate, softly overlapping
        // bands across the desktop. Their physical span stays narrower than
        // either desktop; the side plates limit the pool before its forward fan.
        const desktopStripBox = new THREE.Box3().setFromObject(ledParts[39].part);
        const desktopStripBounds = {
            minZ: desktopStripBox.min.z,
            maxZ: desktopStripBox.max.z,
            sourceX: desktopStripBox.max.x,
            baseSpread: 1,
            fanSlope: 0.08,
            fanLimit: 6,
            feather: 1.4
        };
        const desktopStripCenterZ = (desktopStripBounds.minZ + desktopStripBounds.maxZ) / 2;
        const desktopStripHalfWidth = (desktopStripBounds.maxZ - desktopStripBounds.minZ) / 2;
        // Move the complete reflection field five authored inches toward the
        // rear (-X), so the nearest band's soft edge reaches the desktop back.
        const desktopReflectionRearShift = 5;
        const desktopReflectionBands = [
            { sourceId: 3, centerX: -166 - desktopReflectionRearShift, width: 0.85, gain: 1.0 },
            { sourceId: 2, centerX: -159 - desktopReflectionRearShift, width: 1.0, gain: 0.8 },
            { sourceId: 1, centerX: -152 - desktopReflectionRearShift, width: 1.15, gain: 0.65 }
        ];
        addLedSurfaceSpill(sizeVariantParts.smallTop, 'desktop', -171,
            desktopStripCenterZ, desktopStripHalfWidth, 1, 14, 0.52, desktopStripBounds,
            null, desktopReflectionBands);
        addLedSurfaceSpill(sizeVariantParts.largeTop, 'desktop', -171,
            desktopStripCenterZ, desktopStripHalfWidth, 1, 14, 0.52, desktopStripBounds,
            null, desktopReflectionBands);
        for (const { obj } of partRegistry.values()) {
            if (!/^Power(?:_\d+)?$/.test(obj.name) || !obj.isMesh) continue;
            addLedSurfaceSpill(obj, 'desktop', -171, desktopStripCenterZ,
                desktopStripHalfWidth, 1, 14, 0.18, desktopStripBounds,
                sizeVariantParts.smallTop, desktopReflectionBands);
        }
        addLedSurfaceSpill(lowerShelf, 'shelf', -177, -327,
            22, 3, 11, 0.42);
        addLedSurfaceSpill(baseShelf, 'base', -166, -327,
            21, 3, 11, 0.28);
        addLedSurfaceSpill(topShelf, 'top', -179, -327,
            21, 2, 10, 0.38);
        const uprightNames = new Set(['Top_Shelf', 'Top_Shelf_1', 'Top_Shelf_2',
            'Lift_Column_Top_16', 'Lift_Column_Top_17']);
        for (const { obj } of partRegistry.values()) {
            if (!uprightNames.has(obj.name) || !obj.isMesh) continue;
            addLedUprightSpill(obj, ledParts[39].part, 'desktop', -1, 47.6, 51.92);
            addLedUprightSpill(obj, ledParts[41].part, 'shelf', -1, 52.69, 57.0);
            addLedUprightSpill(obj, ledParts[40].part, 'top', 1, 57.78, 1000);
        }
        const legNames = new Set(['Lift_Column_Top_16', 'Lift_Column_Top_17',
            'Lift_Column_Center', 'Lift_Column_Center_1',
            'Lift_Column_Bottom_2', 'Lift_Column_Bottom_3']);
        for (const { obj } of partRegistry.values()) {
            if (!obj.isMesh) continue;
            const underDeskPart = obj.name === 'Desktop' || obj.name === 'mesh_692';
            if (!underDeskPart && !legNames.has(obj.name)) continue;
            const crossbar = obj.name === 'Desktop';
            for (const group of [ledStandardStrips, ledExtendedStrips]) {
                const centerStrip = group.children[2];
                addLedUprightSpill(obj, centerStrip, 'base', -1, -1000, 49,
                    { underside: true, uprightOnly: false, cage: underDeskPart && !crossbar,
                      gain: crossbar ? 2 : underDeskPart ? 0.5 : 1, minReach: 12, maxReach: 28 });
                if (legNames.has(obj.name)) {
                    obj.geometry.computeBoundingBox();
                    const left = obj.geometry.boundingBox.getCenter(new THREE.Vector3()).z < -327;
                    addLedUprightSpill(obj, group.children[left ? 1 : 0],
                        left ? 'leftWing' : 'rightWing', -1, -1000, 49,
                        { underside: true, gain: 0.65, minReach: 8, maxReach: 18 });
                }
            }
        }
        addLedWingSpill(leftWing, 'leftWing');
        addLedWingSpill(rightWing, 'rightWing');
        // Silver tilt cylinders and telescoping rods receive the centre
        // desktop underside strip. Each mesh carries its own receiver through
        // the actuator solver; the light frame follows the tilting desktop.
        for (const { obj } of partRegistry.values()) {
            if (!obj.isMesh || !/^Linear_Actuators(?:_\d+)?$/.test(obj.name)) continue;
            for (const group of [ledStandardStrips, ledExtendedStrips]) {
                addLedUprightSpill(obj, group.children[2], 'base', -1, -1000, 1000,
                    { actuator: true, uprightOnly: false, gain: 1.5, minReach: 12, maxReach: 28 });
            }
        }
        addFootLedFloorGlow(roots.base);
        // All LED receivers use the mesh-aligned light fields above. Three.js
        // selects lights by the camera's layers, not each receiving mesh's
        // layers. Extra area lights therefore leaked onto the desktop and
        // produced a sharp, view-dependent diagonal across its top triangles.
        roots.tilt.add(ledStandardStrips, ledExtendedStrips);
        roots.lift.position.y = LIFT_MIN;
        roots.tilt.position.y = LIFT_MIN;
        for (const root of Object.values(roots)) loadedModel.add(root);
        liftObjects.set(roots.lift, { obj: roots.lift, baseY: roots.lift.position.y });
        syncLedSizeGeometry();
        [...partRegistry.values()].forEach(({ obj }) => {
            if (/^Leds(?:_|$)/.test(obj.name)) obj.visible = false;
        });
        bindLedPixels();
        setLedsEnabled(ledsEnabled);
        return roots.tilt;
    } catch (error) {
        console.warn('[ErgoFlex] LED overlay did not load:', error);
        return null;
    }
}

function loadModel() {
    const onLoaded = async (gltf) => {
        // The temporary video screen owns its GPU resources across model loads.
        ledGame.restoreMonitor();
        ledMotion.cancel();
        ledSounds.stop();
        workspaceAccessories?.dispose();
        workspaceAccessories = null;
        if (loadedModel) scene.remove(loadedModel);

        sharedBirchMaterial = null;
        woodMaterials.clear();
        loadBirchPhoto();
        sharedBasePaintMaterial = null;
        sharedPolishedAluminumMaterial = null;
        sharedBlackPlasticMaterial = null;
        sharedBlackMetalMaterial = null;

        movingObjects = [];
        liftObjects.clear();
        telescopingObjects = [];
        interactableObjects = [];
        sizeVariantParts = null;
        screenAssembly = null;
        ledPixels?.dispose(); ledPixels = null;
        ledParts = [];
        ledDesktopFit = null;
        ledStandardStrips = null;
        ledExtendedStrips = null;
        boxHelpers.forEach(h => scene.remove(h));
        boxHelpers.clear();
        editorIdCounter = 0;
        partRegistry.clear();
        proxyOriginalParents.clear();
        animOriginalParents.clear();
        if(transformControl) transformControl.detach();
        if(transformProxy) {
            [...transformProxy.children].forEach(c => scene.attach(c));
        }

        loadedModel = gltf.scene;

        loadedModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat, index) => {
                    if (!mat) return;
                    const colorHex = mat.color ? mat.color.getHexString().toLowerCase() : 'ffffff';
                    let newMaterial = mat;

                    if (BIRCH_COLORS.includes(colorHex)) newMaterial = getOrCreateWoodMaterial(woodRoleFor(child));
                    else if (BASE_PAINT_COLORS.includes(colorHex)) newMaterial = getOrCreateBasePaintMaterial();
                    else if (POLISHED_ALUMINUM_COLORS.includes(colorHex)) newMaterial = getOrCreatePolishedAluminumMaterial();
                    else if (BLACK_PLASTIC_COLORS.includes(colorHex)) newMaterial = getOrCreateBlackPlasticMaterial();
                    else if (BLACK_METAL_COLORS.includes(colorHex)) newMaterial = getOrCreateBlackMetalMaterial();

                    if (Array.isArray(child.material)) child.material[index] = newMaterial;
                    else child.material = newMaterial;
                });
            }
        });

        const box = new THREE.Box3().setFromObject(loadedModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxSize = Math.max(size.x, size.y, size.z);
        const scale = 2.5 / maxSize;
        loadedModel.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(loadedModel);
        loadedModel.position.x = -center.x * scale;
        loadedModel.position.y = -scaledBox.min.y + 0.005;
        loadedModel.position.z = -center.z * scale;

        scene.add(loadedModel);
        loadedModel.updateMatrixWorld(true);

        // Apply PART_BAKE_DATA: set world positions for telescoping parts before capturing baseY
        for (const [partName, bakeData] of Object.entries(PART_BAKE_DATA)) {
            loadedModel.traverse((child) => {
                if (child.isMesh && child.name === partName) {
                    const worldPos = new THREE.Vector3(bakeData.position.x, bakeData.position.y, bakeData.position.z);
                    // Convert world position to local space of the parent
                    if (child.parent) {
                        child.parent.updateMatrixWorld(true);
                        child.parent.worldToLocal(worldPos);
                    }
                    child.position.copy(worldPos);
                    child.updateMatrixWorld(true);
                }
            });
        }

        controls.update();

        // Build interactable list, assign editorIds, and populate initial selection
        loadedModel.traverse((child) => {
            if (child.isMesh) {
                // Phase 2.0: Assign stable editorId
                const editorId = child.name + '_' + (editorIdCounter++);
                child.userData.editorId = editorId;
                partRegistry.set(editorId, { obj: child, name: child.name, editorId: editorId, isClone: false });

                interactableObjects.push(child);

                if (TELESCOPING_PARTS.includes(child.name)) {
                    // baseY captured AFTER bake data applied = position at LIFT_MIN
                    telescopingObjects.push({
                        obj: child,
                        baseY: child.position.y
                    });
                } else if (INITIAL_ANIMATED_PARTS.includes(child.name)) {
                    // Raw GLB position = position at lift=0, NOT LIFT_MIN.
                    // baseY must be position at LIFT_MIN, so: baseY = rawY + LIFT_MIN
                    movingObjects.push({
                        obj: child,
                        baseY: child.position.y + LIFT_MIN
                    });
                    liftObjects.set(child, movingObjects[movingObjects.length - 1]);
                    const helper = new THREE.BoxHelper(child, 0x30d158);
                    scene.add(helper);
                    boxHelpers.set(child.uuid, helper);
                    helper.visible = isSelectionMode;
                }
            }
        });

        updateTransformProxy();

        // Apply initial position at LIFT_MIN (28") so model doesn't start at raw ~45"
        updateMovingObjectsPosition();

        // Pristine baseline, captured after PART_BAKE_DATA and before any rig
        // reparents anything. Sizing and project restore both recompute from
        // this rather than from the live scene.
        assetBaseline.clear();
        editTransforms.clear();
        partRegistry.forEach(entry => captureAssetBaseline(entry.obj));

        // Keep the desk's existing editor IDs stable. The separate trim GLB
        // shares full.glb's coordinates and inherits its scale and glide.
        const trimTiltParts = await loadTrimOverlay();
        const screenTiltPart = await loadTouchscreenAssembly();
        const ledTiltPart = await loadLedOverlay();

        restorePartLabels();

        // Rebuild tilt rigs: baked production configs + any saved this session
        restoreTiltConfigs();
        const deskTilt = primaryTiltConfig();
        if (deskTilt) {
            const overlays = [...trimTiltParts, screenTiltPart, ledTiltPart]
                .filter(obj => obj && !isInTiltWrapper(obj));
            if (overlays.length) attachPartsToTilt(deskTilt, overlays);
        }

        // Actuator rigs restore AFTER tilts so rest state is captured correctly
        restoreActuatorRigs();

        // Auto-rig the omni wheels from part naming, remember the home position
        buildWheelRigs();
        glideBase.copy(loadedModel.position);
        const millimetreScale = loadedModel.scale.x * (LIFT_MAX - LIFT_MIN) / (HEIGHT_MAX - HEIGHT_MIN) / 25.4;
        withNeutralPose(() => { workspaceAccessories = new WorkspaceAccessories(scene, partRegistry, millimetreScale, loadedModel); });
        applyAccessoryVisibility();
        if (!workspaceRoom) workspaceRoom = new WorkspaceRoom(scene, millimetreScale);
        setRoomScene(selectedRoomScene, false);
        const roomProfile = measuredRoomProfile();
        if (roomProfile) setMeasuredRoomMode(roomProfile.id, roomProfile.mode);
        applySurfaceFinish();   // now that surfaceInches can measure the real model
        syncBuildSummary();
        // Set the demo's first pose before revealing and fitting the model.
        if (EVENT_DEMO) {
            currentLift = targetLift = heightToLift(43.5);
            manualLiftOverride = true;
            updateMovingObjectsPosition();
            const initialTilt = primaryTiltConfig();
            if (initialTilt) {initialTilt.currentDeg = -5;applyTiltConfig(initialTilt);syncTiltUI();}
            showHeight(43.5);
        }
        document.getElementById('scene-status').textContent = 'LIVE 3D · READY';
        syncViewerSize();
        focusObjects([loadedModel]);

        // A shared preview can request the architectural view explicitly.
        if (!EVENT_DEMO && new URLSearchParams(location.search).get('view') === 'room') {
            workspaceRoom?.ready.then(() => {
                const select = document.getElementById('camera-view');
                if (select) { select.value = 'room'; select.dispatchEvent(new Event('change')); }
            });
        }

        // Phase 1.4: Material smoke check
        if (!woodMaterials.size) {
            console.warn('[ErgoFlex] No wood materials after model load — wood finish swatches will not work.');
        }
        if (!sharedBasePaintMaterial) {
            console.warn('[ErgoFlex] sharedBasePaintMaterial is null after model load — base finish swatches will not work.');
        }

        // Phase 1.3: Temporary instrumentation — log column positions at min height
        console.log('[ErgoFlex] Model loaded at LIFT_MIN (' + HEIGHT_MIN + '"). Telescoping column positions:');
        telescopingObjects.forEach(item => {
            const wp = new THREE.Vector3();
            item.obj.getWorldPosition(wp);
            console.log('  ' + item.obj.name + ' localY=' + item.obj.position.y.toFixed(6) + ' worldY=' + wp.y.toFixed(6));
        });

        // Hide selection boxes initially and detach tools
        boxHelpers.forEach(helper => helper.visible = false);
        if(transformControl) transformControl.detach();

        // Restore saved groups: baked defaults + anything saved on this machine.
        // localStorage (not sessionStorage) so closing the tab loses nothing.
        try {
            const stored = localStorage.getItem('ergoflexGroups');
            savedGroups = Object.assign({}, BAKED_GROUPS, stored ? JSON.parse(stored) : {});
        } catch(e) { savedGroups = Object.assign({}, BAKED_GROUPS); }
        rebuildGroupDropdown();

        // Debug panel collapse state (read from localStorage by makeCollapsible)
        initDebugPanelCollapse();

        // Selecting parts never changes the production lift assembly.
        if (clearPartsBtn) clearPartsBtn.click();
        // Build scene tree
        buildSceneTree();

        controls.autoRotate = false;

        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 400);

    };

    const onError = (error) => {
        console.error('Error loading model:', error);
        if (loader) {
            loader.innerHTML = `
                <div class="flex flex-col items-center p-4 text-center">
                    <svg class="w-8 h-8 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="text-sm text-gray-800 font-medium">Model Load Error</p>
                </div>
            `;
        }
    };

    // Fetch the bytes ourselves so they can be hashed, then hand the same buffer
    // to the parser — one download, not two.
    const url = PRODUCT_CONFIG.modelUrl;
    fetchModelWithFingerprint(url).then(({ buffer, fingerprint }) => {
        modelFingerprint = fingerprint;
        const basePath = url.slice(0, url.lastIndexOf('/') + 1);
        gltfLoader.parse(buffer, basePath, onLoaded, onError);
    }).catch(error => {
        // A CORS-restricted host will not hand over the body. Fall back to the
        // loader's own request; the project fingerprint is simply absent.
        console.warn('[ErgoFlex] Falling back to unhashed model load:', error);
        modelFingerprint = null;
        gltfLoader.load(url, onLoaded, (xhr) => {
            const statusEl = document.getElementById('loader-status');
            if (statusEl && xhr.total) {
                statusEl.textContent = 'Loading 3D workspace... ' + Math.min(100, Math.round((xhr.loaded / xhr.total) * 100)) + '%';
            }
        }, onError);
    });
}

// --- Project save and restore ----------------------------------------------

const PROJECT_AUTOSAVE_KEY = 'ergoflexProjectAutosaveV1';
const PROJECT_AUTOSAVE_SLOTS = 5;
const PROJECT_AUTOSAVE_BUDGET = 4 * 1024 * 1024;

const v3 = v => ({ x: v.x, y: v.y, z: v.z });
const v4 = v => ({ x: v.x, y: v.y, z: v.z, w: v.w });

// The transform a part would have at the current size with no user edits.
// Sizing (Phase 2) will compose its own transformation here; until then a part's
// sized baseline is its asset baseline. Edits are stored as a delta against this
// value, never as an absolute, so that a part edited at one size keeps its edit
// relative to wherever a different size puts it rather than snapping back.
function sizedBaseline(editorId) {
    return assetBaseline.get(editorId) || null;
}

// Delta from `base` to `edited`, in the part's canonical parent space.
function transformDelta(base, edited) {
    return {
        p: { x: edited.p.x - base.p.x, y: edited.p.y - base.p.y, z: edited.p.z - base.p.z },
        q: v4(base.q.clone().invert().multiply(edited.q)),
        s: { x: edited.s.x / base.s.x, y: edited.s.y / base.s.y, z: edited.s.z / base.s.z }
    };
}

// Recompose in a fixed order — scale, then rotation, then translation. TRS
// composition does not commute, so both ends must agree on one order.
function applyTransformDelta(obj, base, delta) {
    obj.scale.set(base.s.x * delta.s.x, base.s.y * delta.s.y, base.s.z * delta.s.z);
    obj.quaternion.copy(base.q).multiply(new THREE.Quaternion(delta.q.x, delta.q.y, delta.q.z, delta.q.w));
    obj.position.set(base.p.x + delta.p.x, base.p.y + delta.p.y, base.p.z + delta.p.z);
    obj.updateMatrixWorld(true);
}

function serializeProject() {
    // Motion is read BEFORE neutralising, or it would record the rest pose the
    // capture itself just imposed rather than the pose the desk is actually in.
    const motion = {
        heightInches: liftToHeight(currentLift),
        tilt: Object.fromEntries(tiltConfigs.map(c => [c.name, c.currentDeg])),
        yaw: deskYaw,
        // The target, not the current offset: glide eases toward its target over
        // several frames, so saving the offset would capture wherever the desk
        // happened to be mid-transit rather than the position that was asked for.
        glide: { x: glideTarget.x, z: glideTarget.z }
    };

    return withNeutralPose(() => {
        const clones = [];
        partRegistry.forEach(entry => {
            if (!entry.isClone) return;
            const canon = canonicalTransform(entry.obj);
            const parent = canonicalParent(entry.obj);
            clones.push({
                editorId: entry.editorId,
                sourceEditorId: entry.obj.userData?.sourceEditorId || null,
                parentEditorId: parent?.userData?.editorId || 'model',
                transform: canon ? { p: v3(canon.p), q: v4(canon.q), s: v3(canon.s) } : undefined
            });
        });

        const transforms = [];
        editTransforms.forEach((edited, editorId) => {
            const base = sizedBaseline(editorId);
            if (!base || !partRegistry.has(editorId)) return;
            const delta = transformDelta(base, edited);
            // Only record edits that actually moved something.
            const moved = Math.abs(delta.p.x) + Math.abs(delta.p.y) + Math.abs(delta.p.z) > 1e-9
                || Math.abs(1 - delta.q.w) > 1e-9
                || Math.abs(delta.s.x - 1) + Math.abs(delta.s.y - 1) + Math.abs(delta.s.z - 1) > 1e-9;
            if (moved) transforms.push({ editorId, delta });
        });

        const liftMembers = [];
        liftObjects.forEach((_, obj) => { if (obj.userData?.editorId) liftMembers.push(obj.userData.editorId); });

        return {
            formatVersion: PROJECT_FORMAT_VERSION,
            savedAt: new Date().toISOString(),
            model: {
                url: PRODUCT_CONFIG.modelUrl,
                partCount: partRegistry.size,
                contentFingerprint: modelFingerprint
            },
            customerConfig: cleanConfig(currentConfig),
            // Only what affects the rendered product. Sidebar width and panel
            // collapse are this browser's preferences and stay in their own keys —
            // a project shared between machines should not rearrange the editor.
            presentation: {
                surfaceFinish,
                trimColor,
                ledColor,
                ledGlow,
                ledEffect: { ...ledEffect },
                ledSurfaces: { ...ledSurfaces },
                ledsEnabled,
                touchscreenOpen: screenTarget > 0.5,
                grainEnabled,
                grainVisibility,
                grainSheen,
                environment: document.getElementById('studio-environment')?.value || 'gallery',
                roomScene: selectedRoomScene,
                homeMode,
                homeLayout: selectedHomeLayout().id,
                gamingMode,
                gamingLayout: selectedGamingLayout().id,
                musicMode,
                musicLayout: selectedMusicLayout().id,
                artistMode,
                artistLayout: selectedArtistLayout().id,
                bedroomMode,
                bedroomLayout: selectedBedroomLayout().id,
                galleryMode,
                galleryLayout: selectedGalleryLayout().id,
                libraryMode,
                libraryLayout: selectedLibraryLayout().id,
                coworkingMode,
                coworkingLayout: selectedCoworkingLayout().id,
                scifiMode,
                scifiLayout: selectedScifiLayout().id,
                workshopMode,
                workshopLayout: selectedWorkshopLayout().id,
                loungeMode,
                loungeLayout: selectedLoungeLayout().id,
                kitchenMode,
                kitchenLayout: selectedKitchenLayout().id,
                gymMode,
                gymLayout: selectedGymLayout().id,
                officeMode,
                officeLayout: selectedOfficeLayout().id,
                studyMode,
                studyLayout: selectedStudyLayout().id,
                sceneAssets: serializeSceneAssetStates(),
                sceneAssetLabels: [...partLabels].filter(([editorId]) => editorId.startsWith('scene:')),
                sceneAssetLocked: [...lockedParts].filter(editorId => editorId.startsWith('scene:')),
                exposure: renderer ? renderer.toneMappingExposure : 1.02,
                camera: camera && controls
                    ? { position: v3(camera.position), target: v3(controls.target) }
                    : null
            },
            motion,
            parts: {
                labels: [...partLabels].filter(([editorId]) => partRegistry.has(editorId)),
                clones,
                transforms,
                liftMembers,
                locked: [...lockedParts].filter(editorId => partRegistry.has(editorId)),
                groups: JSON.parse(JSON.stringify(savedGroups))
            },
            rigs: {
                tilt: serializeTiltConfigs(),
                actuator: serializeActuatorRigs(),
                // Wheel rigs are derived from part naming and bounding boxes, so they
                // are rebuilt rather than restored. Recorded for diagnosis only.
                wheels: wheelRigs.map(r => ({ prefix: r.prefix, latSign: r.latSign, radius: r.radius }))
            },
            deletedBaked: {
                tilt: [...deletedBakedRigs.tilt],
                actuator: [...deletedBakedRigs.actuator]
            }
        };
    });
}

// Which baked rigs the user has deliberately deleted. Without this a baked
// default resurrects itself on the next load and the deletion looks like a bug.
const deletedBakedRigs = { tilt: new Set(), actuator: new Set() };
const lockedParts = new Set();

// A snapshot of everything applyProject is about to overwrite, so a failed
// import can be undone. Held in memory rather than only in the autosave ring,
// because recovery has to work when the storage write is what failed.
function captureRollback() {
    try { return serializeProject(); } catch (error) {
        console.warn('[ErgoFlex] Could not capture a rollback snapshot:', error);
        return null;
    }
}

function assetEditorIds() {
    const ids = new Set();
    partRegistry.forEach(entry => { if (!entry.isClone) ids.add(entry.editorId); });
    return ids;
}

/**
 * Apply a validated project. Returns { ok, problems }.
 *
 * Nothing is mutated until validation has passed, and on any failure the
 * pre-import snapshot is restored. An import REPLACES project state: rigs,
 * groups, labels, clones, lift membership and edits. Legacy per-key localStorage
 * merging is a separate path, not folded in here, so a rig the user deleted
 * stays deleted.
 */
function applyProject(project, { confirmSoft = null, isRollback = false } = {}) {
    const result = validateProjectFile(project, {
        assetIds: assetEditorIds(),
        modelUrl: PRODUCT_CONFIG.modelUrl,
        modelFingerprint
    });
    const hard = hardProblems(result.problems);
    if (!result.ok || hard.length) {
        return { ok: false, problems: result.problems };
    }
    const soft = softProblems(result.problems);
    if (soft.length && confirmSoft && !confirmSoft(soft)) {
        return { ok: false, cancelled: true, problems: result.problems };
    }

    const rollback = isRollback ? null : captureRollback();
    try {
        withNeutralPose(() => {
            clearProjectState();
            const parts = project.parts || {};

            // 1. labels
            partLabels.clear();
            for (const [editorId, label] of parts.labels || []) partLabels.set(editorId, label);

            // 2. clones, in dependency order, before anything resolves ids
            for (const clone of result.cloneOrder) {
                const source = partRegistry.get(clone.sourceEditorId);
                if (!source) continue;
                const parent = clone.parentEditorId && clone.parentEditorId !== 'model'
                    ? partRegistry.get(clone.parentEditorId)?.obj : null;
                const made = makeClone(source.obj, clone.editorId, { parent, offsetX: 0, joinLift: false });
                if (clone.transform) {
                    made.position.set(clone.transform.p.x, clone.transform.p.y, clone.transform.p.z);
                    made.quaternion.set(clone.transform.q.x, clone.transform.q.y, clone.transform.q.z, clone.transform.q.w);
                    made.scale.set(clone.transform.s.x, clone.transform.s.y, clone.transform.s.z);
                    made.updateMatrixWorld(true);
                }
                if (/_clone_(\d+)$/.test(clone.editorId)) {
                    editorIdCounter = Math.max(editorIdCounter, Number(RegExp.$1) + 1);
                }
            }

            // 3. edits, composed onto the sized baseline
            for (const { editorId, delta } of parts.transforms || []) {
                const entry = partRegistry.get(editorId);
                const base = sizedBaseline(editorId);
                if (!entry || !base) continue;
                applyTransformDelta(entry.obj, base, delta);
                editTransforms.set(editorId, canonicalTransform(entry.obj));
            }

            // 4. groups and locks
            savedGroups = Object.assign({}, parts.groups || {});
            for (const editorId of parts.locked || []) lockedParts.add(editorId);

            // 5. lift membership, after edits so baseY derives from the edited pose
            liftObjects.clear();
            for (const editorId of parts.liftMembers || []) {
                const entry = partRegistry.get(editorId);
                if (!entry) continue;
                const canon = canonicalTransform(entry.obj);
                liftObjects.set(entry.obj, { obj: entry.obj, baseY: canon ? canon.p.y : entry.obj.position.y });
            }

            // 6. rigs. Wrappers use attach(), which preserves world transform, so
            //    they pick up the edited positions applied in step 3.
            const rigs = project.rigs || {};
            for (const config of rigs.tilt || []) {
                const rigParts = (config.groupEditorIds || []).map(id => partRegistry.get(id)?.obj).filter(Boolean);
                if (rigParts.length) createTiltConfig({ ...config, parts: rigParts });
            }
            for (const rig of rigs.actuator || []) buildActuatorRig(rig);
            buildWheelRigs();
            // Rebuilding rigs does not change the model's rest origin. Its
            // current position also includes compensation for yaw about the
            // wheel center; copying that into the base would accumulate drift
            // each time a rotated project is restored.

            deletedBakedRigs.tilt = new Set(project.deletedBaked?.tilt || []);
            deletedBakedRigs.actuator = new Set(project.deletedBaked?.actuator || []);
        });

        // 7. motion, applied AFTER the neutral-pose scope — inside it, the restore
        //    in the finally block would immediately overwrite whatever we set.
        applyProjectPresentation(project);
        // Establish the selected floor before restoring its travel position.
        applyProjectMotion(project.motion);

        rebuildTiltUI();
        rebuildRigUI();
        rebuildGroupDropdown();
        buildSceneTree();
        markEdited();
        return { ok: true, problems: result.problems };
    } catch (error) {
        console.error('[ErgoFlex] Import failed, rolling back:', error);
        if (rollback) {
            try { applyProject(rollback, { isRollback: true }); }
            catch (rollbackError) { console.error('[ErgoFlex] Rollback also failed:', rollbackError); }
        }
        return { ok: false, problems: [...result.problems, { severity: 'hard', code: 'apply-failed', message: error.message }] };
    }
}

// Tear down everything an import replaces, so nothing from the previous project
// survives into the new one.
function clearProjectState() {
    for (let i = tiltConfigs.length - 1; i >= 0; i--) removeTiltConfig(i, { recordUndo: false });
    for (let i = actuatorRigs.length - 1; i >= 0; i--) removeActuatorRig(i, { recordUndo: false });

    // Clones are the previous project's, and the incoming file brings its own.
    [...partRegistry.values()].filter(entry => entry.isClone).forEach(entry => {
        liftObjects.delete(entry.obj);
        toggleMovingObject(entry.obj, false, true);
        const idx = interactableObjects.indexOf(entry.obj);
        if (idx > -1) interactableObjects.splice(idx, 1);
        if (entry.obj.parent) entry.obj.parent.remove(entry.obj);
        partRegistry.delete(entry.editorId);
        assetBaseline.delete(entry.editorId);
    });

    // Reset every asset part to its pristine baseline before the incoming edits
    // are composed on top.
    editTransforms.forEach((_, editorId) => {
        const entry = partRegistry.get(editorId);
        const base = assetBaseline.get(editorId);
        if (!entry || !base) return;
        entry.obj.position.copy(base.p);
        entry.obj.quaternion.copy(base.q);
        entry.obj.scale.copy(base.s);
        entry.obj.updateMatrixWorld(true);
    });
    editTransforms.clear();
    lockedParts.clear();
    savedGroups = {};
}

function applyProjectMotion(motion) {
    if (!motion) return;
    glideFootprintCache = null;
    if (Number.isFinite(motion.yaw)) { deskYaw = motion.yaw % (Math.PI * 2); applyDeskTransform(); }
    if (Number.isFinite(motion.heightInches)) {
        manualLiftOverride = true;
        currentLift = targetLift = heightToLift(THREE.MathUtils.clamp(motion.heightInches, HEIGHT_MIN, HEIGHT_MAX));
        updateMovingObjectsPosition();
        showHeight(liftToHeight(currentLift));
    }
    for (const [name, deg] of Object.entries(motion.tilt || {})) {
        const config = tiltConfigs.find(c => c.name === name);
        if (config) { config.currentDeg = THREE.MathUtils.clamp(deg, config.minDeg, config.maxDeg); applyTiltConfig(config); }
    }
    if (motion.glide && Number.isFinite(motion.glide.x) && Number.isFinite(motion.glide.z)) {
        clampGlidePosition(glideTarget.set(motion.glide.x, 0, motion.glide.z));
        applyGlideOffset(glideTarget);
    }
}

// Pushes currentConfig into the DOM and the shared materials. The swatch grids
// are rebuilt by populateFinishOptions, which reads currentConfig, so a project
// import can reuse exactly the path a page load takes.
// The markup's <option> labels and data-price attributes were hardcoded and
// unread, so they could disagree with PRODUCT_CONFIG. Generate them instead.
function populateSizeOptions() {
    if (!sizeSelect) return;
    sizeSelect.replaceChildren();
    const toggle = document.getElementById('size-choice-toggle');
    toggle?.replaceChildren();
    for (const [key, size] of Object.entries(PRODUCT_CONFIG.sizes)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = size.name + (size.price ? ` · +${money(size.price)}` : '');
        sizeSelect.append(option);
        if (toggle) {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.sizeChoice = key;
            button.className = 'rounded-lg border px-3 py-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700';
            const label = document.createElement('strong');
            label.className = 'block';
            label.textContent = size.label;
            const detail = document.createElement('span');
            detail.className = 'block text-xs mt-1';
            detail.textContent = size.name + (size.price ? ` · +${money(size.price)}` : ' · Included');
            button.append(label, detail);
            button.addEventListener('click', () => {
                sizeSelect.value = key;
                sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            });
            toggle.append(button);
        }
    }
    sizeSelect.value = currentConfig.size;
    syncSizeChoiceUI();
}

function syncSizeChoiceUI() {
    document.querySelectorAll('[data-size-choice]').forEach(button => {
        const selected = button.dataset.sizeChoice === currentConfig.size;
        button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('border-green-700', selected);
        button.classList.toggle('bg-green-50', selected);
        button.classList.toggle('text-green-900', selected);
        button.classList.toggle('border-gray-300', !selected);
        button.classList.toggle('bg-white', !selected);
    });
}

function applyConfigToUI() {
    if (sizeSelect) sizeSelect.value = currentConfig.size;
    syncSizeChoiceUI();
    syncSizeGeometry();
    const woodName = document.getElementById('selected-wood-name');
    const baseName = document.getElementById('selected-base-name');
    if (woodName) woodName.textContent = currentConfig.woodFinish;
    if (baseName) baseName.textContent = currentConfig.baseFinish;
    const wood = PRODUCT_CONFIG.woodFinishes.find(f => f.name === currentConfig.woodFinish);
    const base = PRODUCT_CONFIG.baseFinishes.find(f => f.name === currentConfig.baseFinish);
    if (wood) applyWoodSpecies(wood);
    if (base && sharedBasePaintMaterial) {
        sharedBasePaintMaterial.color.set(base.color);
        sharedBasePaintMaterial.metalness = frameMetalness(base);
    }
    document.querySelectorAll('#wood-finishes [data-finish], #base-finishes [data-material]').forEach(el => {
        const selected = el.dataset.finish === currentConfig.woodFinish || el.dataset.material === currentConfig.baseFinish;
        el.classList.toggle('selected', selected);
    });
    updatePrice();
}

function applyProjectPresentation(project) {
    const presentation = project.presentation || {};
    if (presentation.trimColor) setTrimColor(presentation.trimColor);
    if (presentation.ledColor) setLedColor(presentation.ledColor);
    if (presentation.ledGlow !== undefined) setLedGlow(presentation.ledGlow);
    setLedEffect(presentation.ledEffect || {}, false);
    for (const [key, value] of Object.entries(presentation.ledSurfaces || {}))
        setLedSurface(key, value);
    if (typeof presentation.ledsEnabled === 'boolean') setLedsEnabled(presentation.ledsEnabled);
    if (typeof presentation.touchscreenOpen === 'boolean') {
        setTouchscreenOpen(presentation.touchscreenOpen);
        setScreenProgress(screenTarget);
    }
    if (validConfig(project.customerConfig)) {
        currentConfig = cleanConfig(project.customerConfig);
        applyConfigToUI();
        applyAccessoryVisibility();
        renderAccessories();
    }
    if (presentation.surfaceFinish) {
        surfaceFinish = presentation.surfaceFinish;
        const el = document.getElementById('surface-finish');
        if (el) el.value = surfaceFinish;
    }
    if (typeof presentation.grainEnabled === 'boolean') {
        grainEnabled = presentation.grainEnabled;
        const el = document.getElementById('wood-grain');
        if (el) el.checked = grainEnabled;
    }
    if (Number.isFinite(presentation.grainVisibility)) {
        grainVisibility = Math.max(0, Math.min(100, presentation.grainVisibility));
        clearPhotoGrainTextures();
    }
    if (Number.isFinite(presentation.grainSheen)) {
        grainSheen = Math.max(0, Math.min(100, presentation.grainSheen));
    }
    syncGrainControls();
    applySurfaceFinish();
    clearSceneAssetRegistration();
    restoreSceneAssetStates(presentation.sceneAssets || {});
    for (const [editorId, label] of presentation.sceneAssetLabels || []) partLabels.set(editorId, label);
    for (const editorId of presentation.sceneAssetLocked || []) lockedParts.add(editorId);
    persistSceneAssetStates();
    if (HOME_MODES[presentation.homeMode]) homeMode = presentation.homeMode;
    homeLayoutId = HOME_LAYOUTS[presentation.homeLayout] ? presentation.homeLayout : homeLayoutForSize(currentConfig.size).id;
    if (GAMING_MODES[presentation.gamingMode]) gamingMode = presentation.gamingMode;
    if (GAMING_LAYOUTS[presentation.gamingLayout]) gamingLayoutId = presentation.gamingLayout;
    if (MUSIC_MODES[presentation.musicMode]) musicMode = presentation.musicMode;
    if (MUSIC_LAYOUTS[presentation.musicLayout]) musicLayoutId = presentation.musicLayout;
    if (ARTIST_MODES[presentation.artistMode]) artistMode = presentation.artistMode;
    if (ARTIST_LAYOUTS[presentation.artistLayout]) artistLayoutId = presentation.artistLayout;
    if (BEDROOM_MODES[presentation.bedroomMode]) bedroomMode = presentation.bedroomMode;
    if (BEDROOM_LAYOUTS[presentation.bedroomLayout]) bedroomLayoutId = presentation.bedroomLayout;
    if (GALLERY_MODES[presentation.galleryMode]) galleryMode = presentation.galleryMode;
    if (GALLERY_LAYOUTS[presentation.galleryLayout]) galleryLayoutId = presentation.galleryLayout;
    if (LIBRARY_MODES[presentation.libraryMode]) libraryMode = presentation.libraryMode;
    if (LIBRARY_LAYOUTS[presentation.libraryLayout]) libraryLayoutId = presentation.libraryLayout;
    if (COWORKING_MODES[presentation.coworkingMode]) coworkingMode = presentation.coworkingMode;
    if (COWORKING_LAYOUTS[presentation.coworkingLayout]) coworkingLayoutId = presentation.coworkingLayout;
    if (SCIFI_MODES[presentation.scifiMode]) scifiMode = presentation.scifiMode;
    if (SCIFI_LAYOUTS[presentation.scifiLayout]) scifiLayoutId = presentation.scifiLayout;
    if (WORKSHOP_MODES[presentation.workshopMode]) workshopMode = presentation.workshopMode;
    if (WORKSHOP_LAYOUTS[presentation.workshopLayout]) workshopLayoutId = presentation.workshopLayout;
    if (LOUNGE_MODES[presentation.loungeMode]) loungeMode = presentation.loungeMode;
    if (LOUNGE_LAYOUTS[presentation.loungeLayout]) loungeLayoutId = presentation.loungeLayout;
    if (KITCHEN_MODES[presentation.kitchenMode]) kitchenMode = presentation.kitchenMode;
    if (KITCHEN_LAYOUTS[presentation.kitchenLayout]) kitchenLayoutId = presentation.kitchenLayout;
    if (GYM_MODES[presentation.gymMode]) gymMode = presentation.gymMode;
    if (GYM_LAYOUTS[presentation.gymLayout]) gymLayoutId = presentation.gymLayout;
    if (OFFICE_MODES[presentation.officeMode]) officeMode = presentation.officeMode;
    if (OFFICE_LAYOUTS[presentation.officeLayout]) officeLayoutId = presentation.officeLayout;
    if (STUDY_MODES[presentation.studyMode]) studyMode = presentation.studyMode;
    if (STUDY_LAYOUTS[presentation.studyLayout]) studyLayoutId = presentation.studyLayout;
    setRoomScene(presentation.roomScene || 'product', false, { preserveDesk: true });
    const environment = document.getElementById('studio-environment');
    if (environment && presentation.environment) {
        environment.value = presentation.environment;
        environment.dispatchEvent(new Event('change'));
    }
    if (renderer && Number.isFinite(presentation.exposure)) {
        (roomLightSettings[selectedRoomScene] ||= {}).exposure = presentation.exposure;
        applyRoomLighting();
    }
    if (presentation.camera && camera && controls) {
        camera.position.set(presentation.camera.position.x, presentation.camera.position.y, presentation.camera.position.z);
        controls.target.set(presentation.camera.target.x, presentation.camera.target.y, presentation.camera.target.z);
        controls.update();
    }
}

// Collapsing the options panel hands the whole grid row to the viewer. Uses the
// same makeCollapsible mechanism as the store accordion and the movement dock.
function initConfigColumnCollapse() {
    const button = document.getElementById('config-collapse');
    const grid = document.getElementById('store-grid');
    const column = document.getElementById('viewer-column');
    if (!button || !grid || !column) return;
    const toggle = makeCollapsible('config-column', {
        storageKey: 'ergoflex.configColumnCollapsed',
        mode: 'display',
        onToggle: collapsed => {
            button.textContent = collapsed ? 'Show options' : 'Hide options';
            button.setAttribute('aria-expanded', String(!collapsed));
            document.getElementById('config-column')?.classList.toggle('collapsed', collapsed);
            // The shared shell gives its whole sidebar track back to the viewer.
            // The legacy grid path remains for the non-shell mobile fallback.
            if (document.body.classList.contains('shell-layout'))
                document.body.classList.toggle('sidebar-collapsed', collapsed);
            else
                grid.classList.toggle('options-hidden', collapsed);
            syncViewerSize();
            requestAnimationFrame(syncViewerSize);
            setTimeout(syncViewerSize, 60);
        }
    });
    button.onclick = toggle;
}

// --- Build validation -------------------------------------------------------
//
// Advisory. Findings are shown, never enforced, until a rule's limit comes from
// a real product specification. blockingFindings returns nothing today, and the
// order button is only disabled if that changes.

// Problems the app detects while building rigs. These used to go to the console
// only, where nobody saw them.
const sceneWarnings = [];
function reportSceneWarning(code, message, parts) {
    if (sceneWarnings.some(w => w.code === code && w.message === message)) return;
    sceneWarnings.push({ code, message, parts });
    scheduleValidation();
}

let validationCache = { key: null, findings: [] };
let validationTimer = null;

function rigSignature() {
    return tiltConfigs.map(c => c.name).join(',') + '|' + actuatorRigs.map(r => r.name).join(',');
}

// Measures the scene for the rules. Sampling the lift alone would measure almost
// nothing, because the solver moves the actuator base with the lift and the
// target is itself a lift member — so both endpoints travel together. Tilt is
// what changes the geometry, so this walks the lift x tilt grid.
function sampleSceneForValidation() {
    if (!loadedModel || !actuatorRigs.length) return { actuators: [], overlaps: [], warnings: sceneWarnings };

    const heights = [HEIGHT_MIN, (HEIGHT_MIN + HEIGHT_MAX) / 2, HEIGHT_MAX];
    const primary = primaryTiltConfig();
    const tiltSteps = primary
        ? [primary.minDeg, (primary.minDeg + primary.maxDeg) / 2, primary.maxDeg]
        : [0];
    const lengths = new Map(actuatorRigs.map(rig => [rig.name, []]));

    const savedLift = currentLift, savedTarget = targetLift, savedOverride = manualLiftOverride;
    const savedTilts = tiltConfigs.map(c => c.currentDeg);
    const wasSuppressed = suppressTransactions;
    const wasPaused = motionPaused;
    suppressTransactions = true;
    motionPaused = true;
    try {
        for (const height of heights) {
            manualLiftOverride = true;
            currentLift = targetLift = heightToLift(height);
            for (const deg of tiltSteps) {
                tiltConfigs.forEach(config => {
                    const upper = config.name === 'tilting'
                        ? maximumTiltForHeight(height, currentConfig.size) : config.maxDeg;
                    config.currentDeg = THREE.MathUtils.clamp(deg, config.minDeg, Math.min(config.maxDeg, upper));
                });
                updateMovingObjectsPosition();
                tiltConfigs.forEach(applyTiltConfig);
                updateActuatorRigs();
                for (const rig of actuatorRigs) {
                    const base = new THREE.Vector3(rig.baseLocal.x, rig.baseLocal.y + (currentLift - LIFT_MIN), rig.baseLocal.z);
                    const tip = rig.targetLocalCenter.clone();
                    rig.targetObj.updateWorldMatrix(true, false);
                    rig.targetObj.localToWorld(tip);
                    loadedModel.worldToLocal(tip);
                    lengths.get(rig.name).push(tip.sub(base).length());
                }
            }
        }
    } finally {
        currentLift = savedLift; targetLift = savedTarget; manualLiftOverride = savedOverride;
        tiltConfigs.forEach((config, i) => { config.currentDeg = savedTilts[i] ?? 0; });
        updateMovingObjectsPosition();
        tiltConfigs.forEach(applyTiltConfig);
        updateActuatorRigs();
        suppressTransactions = wasSuppressed;
        motionPaused = wasPaused;
    }

    return {
        actuators: actuatorRigs.map(rig => ({ name: rig.name, lengths: lengths.get(rig.name) })),
        overlaps: sampleCoarseOverlaps(),
        warnings: sceneWarnings
    };
}

// Per-assembly boxes, not per-mesh: 830 meshes cannot be pair-tested
// interactively, and the result is a candidate list either way.
function assemblyRole(name) {
    if (/^Desktop/.test(name)) return 'desktop';
    if (/^Top_Shelf/.test(name)) return 'shelf';
    if (/^Lift_Column/.test(name)) return 'column';
    if (/^(Linear_Actuators|L_A_Hardware)/.test(name)) return 'actuator';
    if (/^Wheel_/.test(name)) return 'wheel';
    if (/^(Plates_Hardware|Screws|Joinery|Power|Leds|Touch_Screen|Foot_Rest)/.test(name)) return 'hardware';
    return 'other';
}

function sampleCoarseOverlaps() {
    const boxes = new Map();
    partRegistry.forEach(entry => {
        const role = assemblyRole(entry.name);
        if (role === 'other' || !entry.obj.visible) return;
        entry.obj.updateWorldMatrix(true, false);
        const box = new THREE.Box3().setFromObject(entry.obj);
        if (boxes.has(role)) boxes.get(role).union(box);
        else boxes.set(role, box);
    });
    const roles = [...boxes.keys()];
    const overlaps = [];
    for (let i = 0; i < roles.length; i++) {
        for (let j = i + 1; j < roles.length; j++) {
            const a = boxes.get(roles[i]), b = boxes.get(roles[j]);
            if (!a.intersectsBox(b)) continue;
            const overlap = a.clone().intersect(b).getSize(new THREE.Vector3());
            overlaps.push({ a: roles[i], b: roles[j], aRole: roles[i], bRole: roles[j],
                            amount: Math.min(overlap.x, overlap.y, overlap.z) });
        }
    }
    return overlaps;
}

function runValidation() {
    const key = validationCacheKey({
        fingerprint: modelFingerprint, size: currentConfig.size,
        editRevision, rigSignature: rigSignature(), accessories: currentConfig.accessories,
        warningRevision: sceneWarnings.length
    });
    if (validationCache.key === key) return validationCache.findings;
    const findings = validateBuild(currentConfig, sampleSceneForValidation());
    validationCache = { key, findings };
    renderValidation(findings);
    return findings;
}

function scheduleValidation() {
    clearTimeout(validationTimer);
    const run = () => runValidation();
    validationTimer = setTimeout(() =>
        (window.requestIdleCallback || window.setTimeout)(run, { timeout: 1500 }), 300);
}

function renderValidation(findings) {
    const panel = document.getElementById('validation-panel');
    if (!panel) return;
    panel.replaceChildren();

    const blocking = blockingFindings(findings);
    const errors = findings.filter(f => f.severity === 'error');
    const warnings = findings.filter(f => f.severity === 'warning');

    const summary = document.createElement('p');
    summary.className = 'validation-summary';
    summary.textContent = findings.length
        ? `${errors.length} to resolve · ${warnings.length} to check`
        : 'No issues found in this configuration.';
    panel.append(summary);

    for (const item of findings) {
        const row = document.createElement('div');
        row.className = 'validation-row severity-' + item.severity;
        const label = document.createElement('span');
        label.textContent = item.message;
        row.append(label);
        panel.append(row);
    }

    if (findings.length) {
        const note = document.createElement('p');
        note.className = 'studio-note';
        note.textContent = blocking.length
            ? 'Ordering is blocked until the items above are resolved.'
            : 'These are geometric checks against unconfirmed limits, so they are advisory and do not block ordering.';
        panel.append(note);
    }

    // Only a promoted rule can disable the order button, and none are promoted
    // while the product specification is missing.
    const addToCart = document.getElementById('add-to-cart');
    if (addToCart) {
        addToCart.disabled = blocking.length > 0;
        addToCart.title = blocking.length ? blocking[0].message : '';
    }
}

function buildValidationPanel() {
    if (document.getElementById('validation-panel')) return;
    const anchorEl = document.getElementById('price-breakdown');
    if (!anchorEl) return;
    const wrapper = document.createElement('details');
    wrapper.className = 'validation-block';
    wrapper.innerHTML = '<summary>Build checks <span>Design preview</span></summary><div id="validation-panel"></div>';
    anchorEl.after(wrapper);
    scheduleValidation();
}

// --- Guided configurations --------------------------------------------------

function toggleAccessory(id) {
    if (!accessoryFits(id, currentConfig.size)) {
        const item = accessory(id);
        return notifyUser(item?.note || `${item?.name || 'That accessory'} is not available for this size.`);
    }
    const index = currentConfig.accessories.indexOf(id);
    if (index > -1) currentConfig.accessories.splice(index, 1);
    else {
        const group = accessory(id).exclusiveGroup;
        const previous = group && currentConfig.accessories.find(other => accessory(other)?.exclusiveGroup === group);
        currentConfig = cleanConfig({ ...currentConfig, accessories: [...currentConfig.accessories, id] });
        if (previous) notifyUser(`${accessory(id).name} replaces ${accessory(previous).name.toLowerCase()}.`);
    }
    applyAccessoryVisibility();
    renderAccessories();
    updatePrice();
}

// Native options and generated reference models share the same selected IDs.
function applyAccessoryVisibility() {
    for (const item of ACCESSORIES) {
        if (!item.node) continue;
        const on = currentConfig.accessories.includes(item.id);
        partRegistry.forEach(entry => {
            if (entry.name === item.node || entry.name.startsWith(item.node + '_')) entry.obj.visible = on;
        });
    }
    workspaceAccessories?.sync(currentConfig);
}

function renderAccessories() {
    const list = document.getElementById('accessory-list');
    if (!list) return;
    const focusedId = list.contains(document.activeElement) ? document.activeElement.id : null;
    list.replaceChildren();
    document.querySelectorAll('[data-accessory-category]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.accessoryCategory === accessoryCategory));
        if (button.dataset.accessoryCategory === 'Selected') button.textContent = `Selected (${currentConfig.accessories.length})`;
    });
    for (const item of ACCESSORIES) {
        const fits = accessoryFits(item.id, currentConfig.size);
        const on = currentConfig.accessories.includes(item.id);
        const row = document.createElement('article');
        row.className = 'accessory-row' + (fits ? '' : ' unavailable') + (on ? ' is-selected' : '');
        row.hidden = accessoryCategory === 'Selected' ? !on : item.category !== accessoryCategory;
        row.dataset.accessory = item.id;
        const illustration = document.createElement('div'); illustration.className = 'accessory-art';
        illustration.innerHTML = accessoryIllustration(item.visual || (item.id === 'led-strip' ? 'led' : 'foot'));
        const info = document.createElement('div'); info.className = 'accessory-info';
        const brand = document.createElement('span'); brand.className = 'accessory-brand'; brand.textContent = item.brand || 'ERGOFLEX · ACCESSORIES';
        const name = document.createElement('label'); name.className = 'accessory-name'; name.htmlFor = `accessory-${item.id}`; name.textContent = item.name;
        const detail = document.createElement('p'); detail.className = 'accessory-description'; detail.textContent = !fits ? item.note : item.description;
        info.append(brand, name, detail);
        const action = document.createElement('label'); action.className = 'accessory-add';
        const box = document.createElement('input'); box.type = 'checkbox'; box.id = name.htmlFor;
        box.checked = on && fits; box.disabled = !fits;
        box.setAttribute('aria-label', `${item.name}, ${money(item.price)} estimated`);
        box.onchange = () => toggleAccessory(item.id);
        const label = document.createElement('span'); label.textContent = on ? 'Added' : 'Add to build';
        const price = document.createElement('span'); price.className = 'accessory-price'; price.textContent = money(item.price) + '*';
        action.append(box, label, price);
        row.append(illustration, info, action);
        if (item.source) {
            const source = document.createElement('a'); source.href = item.source; source.target = '_blank'; source.rel = 'noopener noreferrer';
            source.className = 'accessory-source'; source.textContent = 'Product specifications ↗'; source.setAttribute('aria-label', `${item.name} manufacturer specifications (opens a new tab)`); row.append(source);
        }
        list.append(row);
    }
    if (accessoryCategory === 'Selected' && !currentConfig.accessories.length) {
        const empty = document.createElement('p'); empty.className = 'accessory-empty'; empty.textContent = 'Your workspace starts here. Explore Desktop or Support to add accessories.'; list.append(empty);
    }
    if (focusedId) {
        const input = document.getElementById(focusedId);
        const target = input?.closest('.accessory-row')?.hidden
            ? document.querySelector('[data-accessory-category="Selected"]') : input;
        target?.focus({ preventScroll: true });
    }
}

function renderPriceBreakdown() {
    const container = document.getElementById('price-breakdown');
    if (!container) return;
    container.replaceChildren();
    const lines = priceBreakdown(currentConfig);
    let provisional = false;
    for (const line of lines) {
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        const label = document.createElement('span');
        label.textContent = line.label + (line.provisional ? '*' : '');
        if (line.provisional) provisional = true;
        const value = document.createElement('span');
        value.textContent = money(line.price);
        row.append(label, value);
        container.append(row);
    }
    const total = document.createElement('div');
    total.className = 'breakdown-row breakdown-total';
    const label = document.createElement('span');
    label.textContent = 'Estimate';
    const value = document.createElement('span');
    value.textContent = money(lines.reduce((n, l) => n + l.price, 0));
    total.append(label, value);
    container.append(total);
    if (provisional) {
        const note = document.createElement('p');
        note.className = 'studio-note';
        note.textContent = '* Accessory pricing is indicative and needs confirmation.';
        container.append(note);
    }
}

function applyPreset(preset) {
    currentConfig = cleanConfig(preset);
    applyConfigToUI();
    applyAccessoryVisibility();
    renderAccessories();
    if (preset.cameraPreset) {
        const select = document.getElementById('camera-view');
        if (select) { select.value = preset.cameraPreset; select.dispatchEvent(new Event('change')); }
    }
    notifyUser(`${preset.name} applied.`);
}

function buildGuidedConfiguration() {
    const column = document.getElementById('config-column-content');
    if (!column || document.getElementById('preset-list')) return;
    // Top level, not inside an accordion: these are how you START a
    // configuration, and they must not disappear when Desk Size is collapsed.
    const anchorEl = column;

    const presets = document.createElement('div');
    presets.id = 'preset-list';
    presets.className = 'preset-list';
    presets.innerHTML = '<div class="eyebrow">START FROM</div>';
    for (const preset of PRESETS) {
        const card = document.createElement('button');
        card.className = 'preset-card';
        card.dataset.preset = preset.id;
        card.innerHTML = `<strong>${preset.name}</strong><small>${preset.blurb}</small><em>${money(configurationPrice(cleanConfig(preset)))}</em>`;
        card.onclick = () => applyPreset(preset);
        presets.append(card);
    }
    // Above the accordions, below the product header.
    const header = column.querySelector('.mb-8');
    if (header) header.after(presets); else column.prepend(presets);

    const accessories = document.createElement('div');
    accessories.className = 'accessory-block';
    accessories.innerHTML = `<div class="eyebrow">MAKE IT YOURS</div><h2>Complete your workspace.</h2><p class="accessory-intro">Add a little comfort. See it on your desk.</p><div class="accessory-filters" role="group" aria-label="Accessory categories"><button data-accessory-category="Desktop" aria-pressed="true">Desktop</button><button data-accessory-category="Support" aria-pressed="false">Support</button><button data-accessory-category="Selected" aria-pressed="false">Selected (0)</button></div><div id="accessory-list"></div><p class="studio-note">Original 3D approximations; branded products use manufacturer dimensions. Mounting fit needs confirmation. * Estimated accessory prices; availability unconfirmed.</p>`;
    (document.getElementById('build-actions') || anchorEl.lastElementChild).before(accessories);
    accessories.querySelectorAll('[data-accessory-category]').forEach(button => button.onclick = () => { accessoryCategory = button.dataset.accessoryCategory; renderAccessories(); });

    const breakdown = document.createElement('div');
    breakdown.id = 'price-breakdown';
    breakdown.className = 'price-breakdown';
    document.getElementById('build-actions').prepend(breakdown);

    renderAccessories();
    renderPriceBreakdown();
    buildValidationPanel();
}

// --- Precision editing ------------------------------------------------------
//
// Numeric fields, alignment and locking all commit through commitTransform, so
// a typed value and a gizmo drag produce the same undo entry and the same
// canonical-transform bookkeeping. Anything editing geometry without going
// through it would not be saved.

// Snapshots world matrices, runs a mutation, then commits it as one edit.
function editSelection(mutate) {
    const objects = movingObjects.map(item => item.obj).filter(obj => !isLocked(obj));
    if (!objects.length) { notifyUser('Select at least one unlocked part first.'); return false; }
    const snapshot = objects.map(obj => {
        obj.updateWorldMatrix(true, false);
        return { obj, before: obj.matrixWorld.clone() };
    });
    mutate(objects);
    objects.forEach(obj => obj.updateMatrixWorld(true));
    const committed = commitTransform(snapshot);
    boxHelpers.forEach(h => h.update());
    updateTransformProxy();
    refreshTransformInspector();
    return committed;
}

function isLocked(obj) {
    const editorId = obj?.userData?.editorId;
    return Boolean(editorId && lockedParts.has(editorId));
}

function setLocked(obj, locked) {
    const editorId = obj?.userData?.editorId;
    if (!editorId) return;
    if (locked) {
        lockedParts.add(editorId);
        toggleMovingObject(obj, false, true);   // a locked part leaves the gizmo's grip
    } else {
        lockedParts.delete(editorId);
    }
    markEdited();
}

// The part the numeric fields describe: the last one selected, if it is still
// in the selection.
function inspectorTarget() {
    const entry = lastSelectedEditorId ? editorEntry(lastSelectedEditorId) : null;
    if (entry && movingObjects.some(item => item.obj === entry.obj)) return entry.obj;
    return movingObjects.length ? movingObjects[movingObjects.length - 1].obj : null;
}

let inspectorSuspended = false;

function refreshTransformInspector() {
    const panel = document.getElementById('transform-inspector');
    if (!panel || inspectorSuspended) return;
    const obj = inspectorTarget();
    const fields = panel.querySelectorAll('input[data-axis]');
    const lockButton = document.getElementById('lock-selected');
    if (!obj) {
        panel.dataset.empty = 'true';
        fields.forEach(input => { input.value = ''; input.disabled = true; });
        if (lockButton) lockButton.disabled = true;
        return;
    }
    panel.dataset.empty = 'false';
    const canon = canonicalTransform(obj);
    if (!canon) return;
    const euler = new THREE.Euler().setFromQuaternion(canon.q, 'XYZ');
    const values = {
        position: { x: canon.p.x, y: canon.p.y, z: canon.p.z },
        rotation: { x: THREE.MathUtils.radToDeg(euler.x), y: THREE.MathUtils.radToDeg(euler.y), z: THREE.MathUtils.radToDeg(euler.z) },
        scale: { x: canon.s.x, y: canon.s.y, z: canon.s.z }
    };
    const locked = isLocked(obj);
    fields.forEach(input => {
        if (document.activeElement === input) return;   // do not fight a typist
        const value = values[input.dataset.field][input.dataset.axis];
        input.value = input.dataset.field === 'rotation' ? value.toFixed(2) : value.toFixed(4);
        input.disabled = locked;
    });
    if (lockButton) {
        lockButton.disabled = false;
        lockButton.setAttribute('aria-pressed', String(locked));
        lockButton.textContent = locked ? 'Unlock' : 'Lock';
    }
}

function commitInspectorField(input) {
    const obj = inspectorTarget();
    if (!obj || isLocked(obj)) return;
    const value = Number(input.value);
    if (!Number.isFinite(value)) { refreshTransformInspector(); return; }
    const parent = canonicalParent(obj);
    if (!parent) return;

    editSelection(() => {
        const canon = canonicalTransform(obj);
        const euler = new THREE.Euler().setFromQuaternion(canon.q, 'XYZ');
        if (input.dataset.field === 'position') canon.p[input.dataset.axis] = value;
        else if (input.dataset.field === 'scale') canon.s[input.dataset.axis] = value || 1e-6;
        else euler[input.dataset.axis] = THREE.MathUtils.degToRad(value);

        // The fields are in canonical parent space, but the object may be
        // parented to the proxy or a rig wrapper, so go via a world matrix.
        parent.updateWorldMatrix(true, false);
        const local = new THREE.Matrix4().compose(canon.p,
            input.dataset.field === 'rotation' ? new THREE.Quaternion().setFromEuler(euler) : canon.q,
            canon.s);
        setWorldMatrix(obj, new THREE.Matrix4().multiplyMatrices(parent.matrixWorld, local));
    });
}

// Bounding boxes are world space, but obj.position is parent space, and the
// model carries a fit-to-view scale — so adding a world delta straight onto
// position moves the part by the wrong amount. Go via the world matrix.
function nudgeWorld(obj, axis, delta) {
    if (!delta) return;
    obj.updateWorldMatrix(true, false);
    const translation = new THREE.Vector3();
    translation[axis] = delta;
    const target = obj.matrixWorld.clone().premultiply(
        new THREE.Matrix4().makeTranslation(translation.x, translation.y, translation.z));
    setWorldMatrix(obj, target);
}

// Align and distribute over the selection's world bounding boxes. One
// transaction per action, so a whole alignment undoes in a single step.
function alignSelection(axis, mode) {
    return editSelection(objects => {
        const boxes = objects.map(obj => new THREE.Box3().setFromObject(obj));
        const bounds = new THREE.Box3();
        boxes.forEach(box => bounds.union(box));
        const anchor = mode === 'min' ? bounds.min[axis]
            : mode === 'max' ? bounds.max[axis]
            : (bounds.min[axis] + bounds.max[axis]) / 2;
        objects.forEach((obj, i) => {
            const box = boxes[i];
            const current = mode === 'min' ? box.min[axis]
                : mode === 'max' ? box.max[axis]
                : (box.min[axis] + box.max[axis]) / 2;
            nudgeWorld(obj, axis, anchor - current);
        });
    });
}

function distributeSelection(axis) {
    if (movingObjects.length < 3) { notifyUser('Select three or more parts to distribute them.'); return false; }
    return editSelection(objects => {
        const entries = objects
            .map(obj => ({ obj, centre: new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3())[axis] }))
            .sort((a, b) => a.centre - b.centre);
        const first = entries[0].centre, last = entries[entries.length - 1].centre;
        const step = (last - first) / (entries.length - 1);
        entries.forEach((entry, i) => nudgeWorld(entry.obj, axis, (first + step * i) - entry.centre));
    });
}

function sceneAssetRecord(entry) {
    return {
        sceneId: selectedRoomScene,
        obj: entry.obj,
        parent: canonicalParent(entry.obj),
        entry: { ...entry },
        addition: sceneAssetState().added.get(entry.editorId) || null,
        transform: canonicalTransformPlain(entry.obj)
    };
}

function setSceneAssetPresence(record, present) {
    if (record.sceneId !== selectedRoomScene) return;
    const state = sceneAssetState(record.sceneId);
    const { entry, obj } = record;
    if (present) {
        (record.parent || workspaceRoom?.ensureAssetRoot()).add(obj);
        applyPlainLocalTransform(obj, record.transform);
        if (record.addition) state.added.set(entry.editorId, record.addition);
        else state.removed.delete(entry.editorId);
        state.transforms.set(entry.editorId, record.transform);
        registerSceneAsset(obj);
    } else {
        unregisterSceneAsset(obj);
        obj.removeFromParent();
        if (record.addition) state.added.delete(entry.editorId);
        else state.removed.add(entry.editorId);
    }
}

function deleteSelectedSceneAssets() {
    const entries = movingObjects
        .map(item => sceneAssetRegistry.get(item.obj.userData?.editorId))
        .filter(Boolean);
    if (!entries.length) return notifyUser('Select one or more scene assets to delete.');
    const records = entries.map(sceneAssetRecord);
    records.forEach(record => setSceneAssetPresence(record, false));
    updateTransformProxy();
    persistSceneAssetStates();
    transaction({ type: 'scene-assets', records, present: true });
    buildSceneTree();
    renderSceneAssetList();
    updateSceneLibraryStatus();
    notifyUser(`${records.length} scene asset${records.length === 1 ? '' : 's'} deleted.`);
}

async function addSceneAsset(propId) {
    if (!workspaceRoom) return;
    const entry = PROP_LIBRARY.entry(propId);
    if (!entry) return notifyUser('That library asset is unavailable.');
    const key = `${selectedRoomScene}:custom:${Date.now()}-${sceneAssetCounter++}:${propId}`;
    const editorId = `scene:${key}`;
    const addition = { editorId, propId, position: [0, 0, 800] };
    const state = sceneAssetState();
    state.added.set(editorId, addition);
    updateSceneLibraryStatus('Loading…');
    try {
        const obj = await workspaceRoom.addAsset(propId, key, addition.position);
        if (!obj || !state.added.has(editorId)) return;
        registerSceneAsset(obj);
        state.transforms.set(editorId, plainLocalTransform(obj));
        roomInteractions?.bind(workspaceRoom);roomLedSpill.bind(workspaceRoom);
        const record = sceneAssetRecord(sceneAssetRegistry.get(editorId));
        transaction({ type: 'scene-assets', records: [record], present: false });
        persistSceneAssetStates();
        toggleMovingObject(obj, true);
        buildSceneTree();
        renderSceneAssetList();
        updateSceneLibraryStatus();
        notifyUser(`${entry.name} added to ${ROOM_SCENES.find(scene => scene.id === selectedRoomScene)?.name || 'scene'}.`);
    } catch (error) {
        state.added.delete(editorId);
        updateSceneLibraryStatus('Could not load asset');
        console.error('[ErgoFlex] Scene asset could not be added:', error);
    }
}

let sceneAssetLibraryEntries = [];

function updateSceneLibraryStatus(message = '') {
    const status = document.getElementById('scene-library-status');
    if (!status) return;
    status.textContent = message || `${sceneAssetRegistry.size} asset${sceneAssetRegistry.size === 1 ? '' : 's'} in ${ROOM_SCENES.find(scene => scene.id === selectedRoomScene)?.name || 'scene'}`;
}

function renderSceneAssetList() {
    const list = document.getElementById('scene-assets-current');
    if (!list) return;
    list.replaceChildren();
    if (!sceneAssetRegistry.size) {
        const empty = document.createElement('p');
        empty.className = 'studio-note';
        empty.textContent = 'This scene has no placed assets yet.';
        list.append(empty);
        return;
    }
    sceneAssetRegistry.forEach(entry => {
        const button = document.createElement('button');
        button.className = 'scene-current-item';
        button.setAttribute('aria-pressed', String(movingObjects.some(item => item.obj === entry.obj)));
        button.textContent = partLabel(entry.editorId);
        button.title = `Select ${entry.name}`;
        button.onclick = () => { toggleMovingObject(entry.obj); renderSceneAssetList(); buildSceneTree(); };
        list.append(button);
    });
}

function renderSceneAssetLibrary() {
    const grid = document.getElementById('scene-library-grid');
    if (!grid) return;
    const query = (document.getElementById('scene-library-search')?.value || '').trim().toLowerCase();
    const category = document.getElementById('scene-library-category')?.value || 'all';
    const collection = document.getElementById('scene-library-collection')?.value || 'all';
    const entries = sceneAssetLibraryEntries.filter(entry =>
        (category === 'all' || entry.category === category) &&
        (collection === 'all' || (entry.collection || 'Original library') === collection) &&
        (!query || `${entry.name} ${entry.id} ${entry.collection || ''}`.toLowerCase().includes(query)));
    const count = document.getElementById('scene-library-count');
    if (count) count.textContent = `${entries.length} models`;
    grid.replaceChildren();
    entries.forEach(entry => {
        const card = document.createElement('button');
        card.className = 'scene-library-card';
        card.type = 'button';
        card.title = `${entry.name} · ${entry.collection || 'Original library'}`;
        const image = document.createElement('img');
        image.src = `./assets/props/thumbs/${entry.id}.png`;
        image.alt = '';
        image.loading = 'lazy';
        const name = document.createElement('span');
        name.textContent = entry.name;
        const meta = document.createElement('small');
        meta.textContent = `${entry.category} · ${entry.collection || 'Original library'}`;
        card.append(image, name, meta);
        card.onclick = () => addSceneAsset(entry.id);
        grid.append(card);
    });
    if (!entries.length) {
        const empty = document.createElement('p');
        empty.className = 'studio-note';
        empty.textContent = 'No assets match that search.';
        grid.append(empty);
    }
}

async function buildSceneAssetTools(anchorElement) {
    if (!anchorElement || document.getElementById('scene-asset-tools')) return;
    const panel = document.createElement('section');
    panel.id = 'scene-asset-tools';
    panel.className = 'precision-tools scene-asset-tools';
    panel.innerHTML = `<div class="scene-library-heading"><div><div class="eyebrow">SCENE ASSETS</div><strong>Prop library</strong></div><span id="scene-library-status">Loading library…</span></div>
        <div class="scene-library-filters"><input id="scene-library-search" type="search" placeholder="Search 3D assets…" aria-label="Search scene assets"><select id="scene-library-collection" aria-label="Model collection"><option value="all">All collections</option></select><select id="scene-library-category" aria-label="Scene asset category"><option value="all">All categories</option></select></div>
        <small id="scene-library-count" aria-live="polite"></small>
        <div id="scene-library-grid" class="scene-library-grid" aria-label="Available scene assets"></div>
        <div class="scene-current-heading"><strong>In this scene</strong><button id="delete-scene-assets" type="button">Delete selected</button></div>
        <div id="scene-assets-current" class="scene-assets-current"></div>
        <p class="studio-note">Click any prop in the viewer or list, then use Move, Rotate, Scale, rename, precision fields, alignment, focus, isolate, lock, undo, and redo.</p>`;
    anchorElement.after(panel);
    panel.querySelector('#scene-library-search').oninput = renderSceneAssetLibrary;
    panel.querySelector('#scene-library-category').onchange = renderSceneAssetLibrary;
    panel.querySelector('#scene-library-collection').onchange = renderSceneAssetLibrary;
    panel.querySelector('#delete-scene-assets').onclick = deleteSelectedSceneAssets;
    try {
        const index = await PROP_LIBRARY.loadIndex();
        sceneAssetLibraryEntries = [...index.props].sort((a, b) => a.name.localeCompare(b.name));
        const categories = [...new Set(sceneAssetLibraryEntries.map(entry => entry.category))].sort();
        const collectionSelect = panel.querySelector('#scene-library-collection');
        [...new Set(sceneAssetLibraryEntries.map(entry => entry.collection || 'Original library'))].sort().forEach(collection => {
            const option = document.createElement('option');
            option.value = collection;
            option.textContent = collection;
            collectionSelect.append(option);
        });
        const select = panel.querySelector('#scene-library-category');
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category[0].toUpperCase() + category.slice(1);
            select.append(option);
        });
        renderSceneAssetLibrary();
        renderSceneAssetList();
        updateSceneLibraryStatus();
    } catch (error) {
        updateSceneLibraryStatus('Library unavailable');
        console.error('[ErgoFlex] Prop library could not be loaded:', error);
    }
}

function buildPrecisionTools(anchorElement) {
    if (!anchorElement || document.getElementById('transform-inspector')) return;
    const panel = document.createElement('div');
    panel.id = 'transform-inspector';
    panel.className = 'precision-tools transform-inspector';
    panel.dataset.empty = 'true';
    const row = (field, label, step) => `<div class="inspector-row"><span>${label}</span>` +
        ['x', 'y', 'z'].map(axis =>
            `<label><em>${axis.toUpperCase()}</em><input type="number" step="${step}" data-field="${field}" data-axis="${axis}" disabled></label>`).join('') +
        `</div>`;
    panel.innerHTML = `<div class="eyebrow">TRANSFORM</div>
        ${row('position', 'Pos', '0.001')}
        ${row('rotation', 'Rot', '0.5')}
        ${row('scale', 'Scale', '0.01')}
        <div class="inspector-actions">
            <button id="lock-selected" aria-pressed="false" disabled title="Lock the selected parts so they cannot be selected or moved">Lock</button>
            <button id="align-menu-toggle" aria-expanded="false" aria-controls="align-tools">Align…</button>
        </div>
        <div id="align-tools" hidden>
            ${['x', 'y', 'z'].map(axis => `<div class="inspector-row"><span>${axis.toUpperCase()}</span>` +
                ['min', 'center', 'max'].map(mode =>
                    `<button data-align-axis="${axis}" data-align-mode="${mode}">${mode === 'center' ? 'Mid' : mode}</button>`).join('') +
                `<button data-distribute-axis="${axis}" title="Space three or more parts evenly">Even</button></div>`).join('')}
        </div>
        <p class="studio-note">Values are in the part's own parent space, with animation removed. Rotation is in degrees. Typed edits, alignment, and gizmo drags share one undo history.</p>`;
    anchorElement.after(panel);
    if (!EVENT_DEMO) buildSceneAssetTools(panel);

    panel.querySelectorAll('input[data-axis]').forEach(input => {
        input.addEventListener('focus', () => { inspectorSuspended = true; });
        input.addEventListener('blur', () => { inspectorSuspended = false; refreshTransformInspector(); });
        input.addEventListener('change', () => commitInspectorField(input));
        input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
    });
    document.getElementById('lock-selected').onclick = () => {
        const obj = inspectorTarget();
        if (!obj) return;
        const locking = !isLocked(obj);
        movingObjects.map(item => item.obj).forEach(target => setLocked(target, locking));
        if (locking) updateTransformProxy();
        refreshTransformInspector();
        notifyUser(locking ? 'Selection locked.' : 'Selection unlocked.');
    };
    const alignToggle = document.getElementById('align-menu-toggle');
    alignToggle.onclick = () => {
        const tools = document.getElementById('align-tools');
        tools.hidden = !tools.hidden;
        alignToggle.setAttribute('aria-expanded', String(!tools.hidden));
    };
    panel.querySelectorAll('[data-align-axis]').forEach(button => {
        button.onclick = () => alignSelection(button.dataset.alignAxis, button.dataset.alignMode);
    });
    panel.querySelectorAll('[data-distribute-axis]').forEach(button => {
        button.onclick = () => distributeSelection(button.dataset.distributeAxis);
    });
}

// --- Project panel ----------------------------------------------------------

// Sits beside the rigs-only "Export Animations" button, which keeps working —
// that exports a definition for baking back into source, this saves the whole
// edited project.
function buildProjectTools(anchorButton) {
    if (!anchorButton || document.getElementById('project-tools')) return;
    const panel = document.createElement('div');
    panel.id = 'project-tools';
    panel.className = 'project-tools';
    panel.innerHTML = `<div class="eyebrow">PROJECT</div>
        <div>
            <button id="project-save">Save project</button>
            <button id="project-load">Load project…</button>
            <button id="project-recover">Recover…</button>
        </div>
        <input id="project-file" type="file" accept="application/json,.json" hidden>
        <p class="studio-note">Saves the whole edited scene: part positions, clones, groups, lift assignments, rigs, finishes, and camera. Autosaves keep the last ${PROJECT_AUTOSAVE_SLOTS} states.</p>
        <div id="project-recovery-list" hidden></div>`;
    anchorButton.parentElement.after(panel);

    document.getElementById('project-save').onclick = () => {
        try {
            const project = serializeProject();
            const stamp = project.savedAt.slice(0, 19).replace(/[:T]/g, '-');
            downloadFile(`ErgoFlex-project-${stamp}.json`, JSON.stringify(project, null, 2), 'application/json');
            notifyUser('Project saved.');
        } catch (error) {
            console.error('[ErgoFlex] Save failed:', error);
            notifyUser('Project could not be saved. See the console for details.');
        }
    };

    const fileInput = document.getElementById('project-file');
    document.getElementById('project-load').onclick = () => fileInput.click();
    fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        let parsed;
        try { parsed = JSON.parse(await file.text()); }
        catch { return notifyUser('That file is not readable JSON.'); }
        importProject(parsed);
    };

    document.getElementById('project-recover').onclick = () => {
        const list = document.getElementById('project-recovery-list');
        const ring = readAutosaveRing();
        list.hidden = false;
        list.replaceChildren();
        if (!ring.length) {
            const empty = document.createElement('p');
            empty.className = 'studio-note';
            empty.textContent = 'No autosaves yet. They are written as you edit, and before anything destructive.';
            list.append(empty);
            return;
        }
        ring.forEach((snapshot, index) => {
            const row = document.createElement('div');
            row.className = 'project-recovery-row';
            const when = document.createElement('span');
            when.textContent = new Date(snapshot.savedAt).toLocaleString() + ' · ' + snapshot.label;
            const restore = document.createElement('button');
            restore.textContent = 'Restore';
            restore.dataset.recoverIndex = String(index);
            restore.onclick = () => importProject(snapshot.project);
            row.append(when, restore);
            list.append(row);
        });
    };
}

// Applies a parsed project and reports what happened. Soft problems are put to
// the user before anything is touched; the default is to cancel.
function importProject(parsed) {
    const outcome = applyProject(parsed, {
        confirmSoft: soft => confirm(
            'This project does not match the current model exactly:\n\n' +
            soft.map(p => '• ' + p.message).join('\n') +
            '\n\nImport anyway?')
    });
    if (outcome.ok) {
        const soft = softProblems(outcome.problems);
        notifyUser(soft.length ? `Project loaded with ${soft.length} warning${soft.length === 1 ? '' : 's'}.` : 'Project loaded.');
    } else if (outcome.cancelled) {
        notifyUser('Import cancelled. Nothing was changed.');
    } else {
        const first = hardProblems(outcome.problems)[0];
        notifyUser(first ? first.message : 'That project could not be loaded.');
    }
    return outcome;
}

// --- Versioned recovery -----------------------------------------------------

let autosaveTimer = null;

function readAutosaveRing() {
    try {
        const raw = localStorage.getItem(PROJECT_AUTOSAVE_KEY);
        const ring = raw ? JSON.parse(raw) : [];
        return Array.isArray(ring) ? ring : [];
    } catch { return []; }
}

// Returns whether the write actually happened. Callers must not report a save
// that did not occur.
function writeAutosave(label) {
    let project;
    try { project = serializeProject(); }
    catch (error) { console.warn('[ErgoFlex] Autosave skipped:', error); return false; }

    const ring = [{ savedAt: new Date().toISOString(), label, project }, ...readAutosaveRing()]
        .slice(0, PROJECT_AUTOSAVE_SLOTS);
    while (ring.length) {
        try {
            const payload = JSON.stringify(ring);
            if (payload.length > PROJECT_AUTOSAVE_BUDGET) { ring.pop(); continue; }
            localStorage.setItem(PROJECT_AUTOSAVE_KEY, payload);
            return true;
        } catch {
            ring.pop();   // quota or private mode: shed the oldest and retry
        }
    }
    return false;
}

function scheduleAutosave(label = 'edit') {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => writeAutosave(label), 2000);
}

// --- UI Events ---

document.addEventListener('DOMContentLoaded', () => {

    toggleHeightBtn = document.getElementById('toggle-height-btn');
    selectionModeToggle = document.getElementById('selection-mode-toggle');
    selectedPartsCount = document.getElementById('selected-parts-count');
    copyPartsBtn = document.getElementById('copy-parts-btn');
    clearPartsBtn = document.getElementById('clear-parts-btn');

    // Production mode: the setup/debug panel is hidden unless ?setup is in the URL.
    // Press ` (backtick) at any time to enter/leave the setup workspace.
    const animDebugger = document.getElementById('anim-debugger');
    const SETUP_MODE = new URLSearchParams(window.location.search).has('setup');
    if (animDebugger) animDebugger.style.display = 'none';
    setShellMode(SETUP_MODE ? 'studio' : 'store');

    // Wire up Transform Tool Mode Switches
    document.querySelectorAll('input[name="transform_mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            setPivotGizmo(false); // the gizmo can only serve one owner
            if (transformControl) {
                if (e.target.value === 'none') {
                    transformControl.detach();
                    updateTransformProxy(); // This will put children back
                } else {
                    transformControl.setMode(e.target.value);
                    updateTransformProxy(); // This will center and attach
                }
            }
        });
    });

    if (clearPartsBtn) {
        clearPartsBtn.addEventListener('click', () => {
            // Detach first to preserve current world positions if they moved them
            [...transformProxy.children].forEach(child => {
                const p = proxyOriginalParents.get(child);
                if (p) {
                    p.attach(child);
                    proxyOriginalParents.delete(child);
                }
            });

            movingObjects = [];
            boxHelpers.forEach(h => scene.remove(h));
            boxHelpers.clear();
            updateTransformProxy();
            if (selectedPartsCount) selectedPartsCount.innerText = "0";
            lastSelectedEditorId = null;
            refreshSelectedPartUI();
            renderSceneAssetList();
            buildSceneTree();
        });
    }

    if (selectionModeToggle) {
        selectionModeToggle.addEventListener('change', (e) => {
            isSelectionMode = e.target.checked;
            boxHelpers.forEach(helper => helper.visible = isSelectionMode);
            updateBoxSelectHint();
            if (!isSelectionMode && transformControl) {
                transformControl.detach();
            }
        });
    }

    wireHeightSlider();

    if(copyPartsBtn) {
        copyPartsBtn.addEventListener('click', () => {
            // 1. We must temporarily detach the parts so getWorldPosition reads relative to their true parent
            [...transformProxy.children].forEach(child => {
                const p = proxyOriginalParents.get(child);
                if (p) {
                    p.attach(child);
                    proxyOriginalParents.delete(child);
                }
            });

            // Gather the exact world coordinates for all moved meshes
            const payload = movingObjects.map(item => {
                const obj = item.obj;
                const pos = new THREE.Vector3();
                const rot = new THREE.Quaternion();
                const scl = new THREE.Vector3();

                obj.getWorldPosition(pos);
                obj.getWorldQuaternion(rot);
                obj.getWorldScale(scl);

                const euler = new THREE.Euler().setFromQuaternion(rot);

                return {
                    name: obj.name,
                    label: partLabels.get(obj.userData.editorId) || null,
                    editorId: obj.userData.editorId || obj.name,
                    position: { x: pos.x, y: pos.y, z: pos.z },
                    rotation: { x: euler.x, y: euler.y, z: euler.z },
                    scale: { x: scl.x, y: scl.y, z: scl.z }
                };
            });

            // 2. Put them back into the Transform proxy so the user can keep working
            movingObjects.forEach(item => {
                if (!proxyOriginalParents.has(item.obj)) proxyOriginalParents.set(item.obj, item.obj.parent);
                transformProxy.attach(item.obj);
            });

            // Enhanced export with metadata wrapper
            const exportData = {
                groupName: document.getElementById('group-name-input')?.value || 'Untitled',
                partCount: payload.length,
                timestamp: new Date().toISOString(),
                deskHeight: liftToHeight(currentLift).toFixed(1) + '"',
                parts: payload
            };
            const jsonText = JSON.stringify(exportData, null, 2);

            const el = document.createElement('textarea');
            el.value = jsonText;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);

            const originalText = copyPartsBtn.innerText;
            copyPartsBtn.innerText = "COPIED TO CLIPBOARD!";
            setTimeout(() => copyPartsBtn.innerText = originalText, 2000);
        });
    }

    if(toggleHeightBtn) {
        toggleHeightBtn.addEventListener('click', () => {
            manualLiftOverride = false;
            isStanding = !isStanding;

            targetLift = isStanding ? LIFT_MAX
                : heightToLift(minimumHeightForTilt(primaryTiltConfig()?.currentDeg ?? 0, currentConfig.size));

            toggleHeightBtn.style.color = isStanding ? '#007aff' : '#374151';
            toggleHeightBtn.style.borderColor = isStanding ? '#007aff' : '#e5e7eb';
        });
    }

    // --- Phase 2.1: Named Groups ---
    const saveGroupBtn = document.getElementById('save-group-btn');
    const loadGroupBtn = document.getElementById('load-group-btn');
    const deleteGroupBtn = document.getElementById('delete-group-btn');
    const groupNameInput = document.getElementById('group-name-input');
    const groupSelect = document.getElementById('group-select');

    if (saveGroupBtn) {
        saveGroupBtn.addEventListener('click', () => {
            const name = groupNameInput?.value?.trim();
            if (name) {
                saveCurrentGroup(name);
                groupNameInput.value = '';
            }
        });
    }
    if (loadGroupBtn) {
        loadGroupBtn.addEventListener('click', () => {
            const name = groupSelect?.value;
            if (name) loadGroup(name);
        });
    }
    if (deleteGroupBtn) {
        deleteGroupBtn.addEventListener('click', () => {
            const name = groupSelect?.value;
            if (name) deleteGroup(name);
        });
    }
    const exportGroupBtn = document.getElementById('export-group-btn');
    if (exportGroupBtn) {
        exportGroupBtn.addEventListener('click', () => {
            const name = groupSelect?.value;
            if (name) exportGroup(name);
        });
    }

    // --- Phase 2.2: Part Search ---
    const partSearchInput = document.getElementById('part-search-input');
    if (partSearchInput) {
        partSearchInput.addEventListener('input', (e) => {
            onPartSearch(e.target.value.trim());
        });
        // Close results on blur (delayed for click to register)
        partSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                const resultsDiv = document.getElementById('part-search-results');
                if (resultsDiv) resultsDiv.classList.add('hidden');
            }, 200);
        });
        partSearchInput.addEventListener('focus', (e) => {
            if (e.target.value.trim().length >= 2) {
                onPartSearch(e.target.value.trim());
            }
        });
    }

    // --- Phase 2.3: Scene Tree toggle ---
    const sceneTreeHeader = document.getElementById('scene-tree-header');
    const sceneTreeContainer = document.getElementById('scene-tree-container');
    const sceneTreeCollapseIcon = document.getElementById('scene-tree-collapse-icon');
    if (sceneTreeHeader) {
        sceneTreeHeader.addEventListener('click', () => {
            const open = sceneTreeContainer.style.display !== 'none';
            sceneTreeContainer.style.display = open ? 'none' : 'block';
            if (sceneTreeCollapseIcon) sceneTreeCollapseIcon.innerHTML = open ? '&#9654;' : '&#9660;';
        });
    }

    // --- Phase 2.5: Collapsible Debug Panel ---
    const debugHeader = document.getElementById('debug-panel-header');
    if (debugHeader) {
        debugHeader.addEventListener('click', () => toggleDebugPanel());
    }

    // Keyboard shortcuts with input-focus guard:
    // ` shows/hides the setup panel, Ctrl/Cmd+Z undoes the last setup edit
    document.addEventListener('keydown', (e) => {
        // A drag can start while a checkbox still has focus; Escape must
        // cancel the gesture before the text-editing shortcut guard.
        if (e.key === 'Escape' && marquee.active) { e.preventDefault(); cancelMarquee(); return; }
        const tag = document.activeElement?.tagName?.toLowerCase();
        const isEditable = document.activeElement?.isContentEditable;
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) return;
        if (!document.getElementById('cart-modal').classList.contains('hidden')) return;
        if (e.key === '`') {
            e.preventDefault();
            setSetupLayout(!setupLayoutOn);
        } else if (e.key === 'Escape' && marquee.active) {
            e.preventDefault();
            cancelMarquee();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) performRedo(); else performUndo();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            performRedo();
        }
    });

    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
        undoBtn.addEventListener('click', performUndo);
        const redoBtn = document.createElement('button');
        redoBtn.id = 'redo-btn';
        redoBtn.className = undoBtn.className.replace('ml-auto', '');
        redoBtn.disabled = true;
        redoBtn.title = 'Redo (Ctrl+Shift+Z / Ctrl+Y)';
        redoBtn.textContent = 'Redo';
        redoBtn.addEventListener('click', performRedo);
        undoBtn.after(redoBtn);
    }

    const glideBtn = document.getElementById('glide-btn');
    if (glideBtn) glideBtn.addEventListener('click', () => {
        setMotionTab('glide');
    });

    const arBtn = document.getElementById('ar-btn');
    if (arBtn) arBtn.addEventListener('click', launchAR);

    // --- Phase 2.6: Clone Parts ---
    const clonePartsBtn = document.getElementById('clone-parts-btn');
    if (clonePartsBtn) {
        clonePartsBtn.addEventListener('click', cloneSelectedParts);
    }

    // --- Phase 3: Tilt ---
    const saveTiltBtn = document.getElementById('save-tilt-btn');
    if (saveTiltBtn) {
        saveTiltBtn.addEventListener('click', saveTiltConfig);
    }
    // --- Phase 4: Actuator Rig buttons ---
    const rigPickBaseBtn = document.getElementById('rig-pick-base-btn');
    const rigPickTargetBtn = document.getElementById('rig-pick-target-btn');
    if (rigPickBaseBtn) rigPickBaseBtn.addEventListener('click', () => {
        if (rigPickMode === 'base') clearHoverHighlight();
        rigPickMode = rigPickMode === 'base' ? null : 'base';
        isPickingPivot = false;
        canvas.style.cursor = rigPickMode ? 'crosshair' : '';
        updateRigPickButtons();
        updatePickPivotBtnState();
    });
    if (rigPickTargetBtn) rigPickTargetBtn.addEventListener('click', () => {
        if (rigPickMode === 'target') clearHoverHighlight();
        rigPickMode = rigPickMode === 'target' ? null : 'target';
        isPickingPivot = false;
        canvas.style.cursor = rigPickMode ? 'crosshair' : '';
        updateRigPickButtons();
        updatePickPivotBtnState();
    });
    const rigCaptureCylBtn = document.getElementById('rig-capture-cyl-btn');
    if (rigCaptureCylBtn) rigCaptureCylBtn.addEventListener('click', () => {
        rigDraft.cylinderEditorIds = selectedEditorIds();
        updateRigStatus();
    });
    const rigCaptureRodBtn = document.getElementById('rig-capture-rod-btn');
    if (rigCaptureRodBtn) rigCaptureRodBtn.addEventListener('click', () => {
        rigDraft.rodEditorIds = selectedEditorIds();
        updateRigStatus();
    });
    const saveRigBtn = document.getElementById('save-rig-btn');
    if (saveRigBtn) saveRigBtn.addEventListener('click', saveActuatorRigFromUI);

    const partLabelInput = document.getElementById('selected-part-label');
    const applyRename = () => {
        if (!lastSelectedEditorId || !partLabelInput) return;
        setPartLabel(lastSelectedEditorId, partLabelInput.value);
    };
    const renameBtn = document.getElementById('selected-part-rename-btn');
    if (renameBtn) renameBtn.addEventListener('click', applyRename);
    if (partLabelInput) partLabelInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applyRename(); }
    });

    const resetNameBtn = document.getElementById('selected-part-reset-btn');
    if (resetNameBtn) resetNameBtn.addEventListener('click', () => {
        if (!lastSelectedEditorId) return;
        if (partLabelInput) partLabelInput.value = '';
        setPartLabel(lastSelectedEditorId, '');
    });

    const copyIdBtn = document.getElementById('selected-part-copy-btn');
    if (copyIdBtn) copyIdBtn.addEventListener('click', () => {
        if (!lastSelectedEditorId) return;
        navigator.clipboard.writeText(lastSelectedEditorId)
            .then(() => { copyIdBtn.textContent = 'Copied!'; setTimeout(() => copyIdBtn.textContent = 'Copy editor ID', 1200); })
            .catch(() => console.log('[ErgoFlex] editorId: ' + lastSelectedEditorId));
    });

    // One payload with every rename in this browser — the thing to paste when
    // describing parts by the names you gave them.
    const copyNamedBtn = document.getElementById('selected-part-copy-named-btn');
    if (copyNamedBtn) copyNamedBtn.addEventListener('click', () => {
        const rows = [...partLabels].map(([eid, label]) => ({
            label, editorId: eid, modelName: editorEntry(eid)?.name || '(missing)'
        }));
        const json = JSON.stringify({ renamedParts: rows.length, parts: rows }, null, 2);
        console.log('[ErgoFlex] Renamed parts:\n' + json);
        navigator.clipboard.writeText(json)
            .then(() => { copyNamedBtn.textContent = 'Copied!'; setTimeout(() => copyNamedBtn.textContent = 'Copy all renamed parts', 1200); })
            .catch(() => {});
    });

    const resetAnimBtn = document.getElementById('reset-anim-btn');
    if (resetAnimBtn) resetAnimBtn.addEventListener('click', () => {
        // Baked definitions live in the source; anything saved here is a local override
        // that takes priority on load. Dropping them is always recoverable.
        try {
            localStorage.removeItem('ergoflexActuatorRigs');
            localStorage.removeItem('ergoflexTiltConfigs');
        } catch (e) {
            console.warn('[ErgoFlex] Could not clear saved animation data:', e);
            return;
        }
        console.log('[ErgoFlex] Cleared saved rigs and tilt configs — reloading from baked definitions.');
        location.reload();
    });

    const pivotGizmoBtn = document.getElementById('rig-pivot-gizmo-btn');
    if (pivotGizmoBtn) pivotGizmoBtn.addEventListener('click', () => setPivotGizmo(!pivotGizmoOn));

    const pivotSelBtn = document.getElementById('rig-pivot-selection-btn');
    if (pivotSelBtn) pivotSelBtn.addEventListener('click', () => {
        const c = selectionCenterLocal();
        if (!c) return console.warn('[ErgoFlex] Select at least one part to snap the pivot to.');
        syncPivotInputs(c);
        showPivotMarker(c);
    });

    const pivotApplyBtn = document.getElementById('rig-pivot-apply-btn');
    if (pivotApplyBtn) pivotApplyBtn.addEventListener('click', applyPivotEdit);

    const pivotCloseBtn = document.getElementById('rig-pivot-close-btn');
    if (pivotCloseBtn) pivotCloseBtn.addEventListener('click', closePivotEditor);

    // Typing a coordinate moves the marker live so the number has a visible meaning
    ['rig-pivot-x', 'rig-pivot-y', 'rig-pivot-z'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            const p = readPivotInputs();
            if (p) showPivotMarker(p);
        });
    });

    const exportTiltBtn = document.getElementById('export-tilt-btn');
    if (exportTiltBtn) {
        exportTiltBtn.addEventListener('click', () => {
            const json = JSON.stringify({
                BAKED_TILT_CONFIGS: serializeTiltConfigs(),
                BAKED_ACTUATOR_RIGS: serializeActuatorRigs()
            }, null, 2);
            const el = document.createElement('textarea');
            el.value = json;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            downloadFile('ErgoFlex-animation-rigs.json', json, 'application/json');
            notifyUser('Animation rigs downloaded.');
            const orig = exportTiltBtn.innerText;
            exportTiltBtn.innerText = 'COPIED TO CLIPBOARD!';
            setTimeout(() => exportTiltBtn.innerText = orig, 2000);
        });
    }
    buildProjectTools(exportTiltBtn);
    buildPrecisionTools(document.getElementById('part-search-input')?.parentElement);
    initConfigColumnCollapse();

    const pickPivotBtn = document.getElementById('pick-pivot-btn');
    if (pickPivotBtn) {
        pickPivotBtn.addEventListener('click', () => {
            isPickingPivot = !isPickingPivot;
            canvas.style.cursor = isPickingPivot ? 'crosshair' : '';
            updatePickPivotBtnState();
        });
    }
    const clearPivotBtn = document.getElementById('clear-pivot-btn');
    if (clearPivotBtn) {
        clearPivotBtn.addEventListener('click', clearPivotSelection);
    }
});


function updateMovingObjectsPosition() {
    const liftOffset = currentLift - LIFT_MIN;

    liftObjects.forEach(item => {
        // Ignore height slider updates for parts currently locked in the 3D custom
        // transform tool, and for parts riding inside a tilt wrapper (the wrapper
        // itself is translated below, so its children must keep their local offsets).
        if (item.obj.parent !== transformProxy && !isInTiltWrapper(item.obj)) {
            item.obj.position.y = item.baseY + liftOffset;
        }
    });

    telescopingObjects.forEach(item => {
        item.obj.position.y = item.baseY + (liftOffset * TELESCOPING_RATIO);
    });

    // Tilt wrappers ride the lift as rigid units (pivot stays glued to the desk)
    tiltConfigs.forEach(config => {
        config.wrapperGroup.position.y = config.wrapperBaseY + liftOffset;
        config.wrapperGroup.updateMatrixWorld(true);
    });

    // Actuator rigs re-aim and re-telescope after everything else moved
    updateActuatorRigs();

    if (isSelectionMode) {
        boxHelpers.forEach(helper => helper.update());
    }
    if (pivotHighlightHelper) pivotHighlightHelper.update();
}

// --- Materials & UI Setup ---

// Wood is no longer one shared material. The desktop, the shelf and the plywood
// edge each need their own map — the desktop because its grain repeat is derived
// from its own size in inches, the edge because plywood laminations look nothing
// like a face veneer.
const woodMaterials = new Map();   // role -> MeshPhysicalMaterial
const speciesTextures = new Map(); // `${species}|${role}` -> THREE.Texture

// Procedural grain. Real tileable photography per species is still the right
// answer; this at least gives each species its own ring spacing, contrast and
// colour instead of tinting one birch photograph eight different ways.
function generateGrainTexture(name, role) {
    const key = name + '|' + role;
    if (speciesTextures.has(key)) return speciesTextures.get(key);
    const spec = woodSpecies(name);
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');

    context.fillStyle = spec.warm;
    context.fillRect(0, 0, size, size);

    if (role === 'edge') {
        // Plywood edge: stacked laminations across the thickness, not rings.
        // Even, so the light/dark alternation still alternates across the tile
        // seam - an odd count put two warm plies next to each other there.
        const plies = 12;
        for (let i = 0; i < plies; i++) {
            const t = i / plies;
            context.fillStyle = i % 2 ? spec.dark : spec.warm;
            context.globalAlpha = 0.55;
            context.fillRect(0, t * size, size, size / plies);
        }
        context.globalAlpha = 1;
    } else {
        // Face veneer: cathedral-ish rings running along the length, with the
        // ring spacing and figure amplitude coming from the species.
        const image = context.getImageData(0, 0, size, size);
        const data = image.data;
        const warm = hexToRgb(spec.warm), dark = hexToRgb(spec.dark);
        // Every term below is an integer number of cycles across the tile, in
        // normalized coordinates, so the pattern meets itself exactly at the edges.
        // The old version stepped in pixels with periods that did not divide 512 -
        // 512/36 rings across, 512/440 for the wobble - so RepeatWrapping put a
        // hard discontinuity at every tile boundary.
        const TAU = Math.PI * 2;
        const rings = Math.max(1, Math.round(spec.ringsPerTile));
        const waves = Math.max(1, Math.round(spec.figureWaves));
        for (let y = 0; y < size; y++) {
            const v = y / size;
            // Bow the rings so they are not straight lines. Amplitude is a fraction
            // of the tile rather than a pixel count, which previously exceeded a
            // whole ring period and scrambled the pattern instead of bending it.
            const wobble = (Math.sin(TAU * waves * v) * 0.65
                          + Math.sin(TAU * waves * 2 * v + 1.7) * 0.35) * spec.figure * 0.11;
            const fibreY = Math.sin(TAU * 37 * v);
            for (let x = 0; x < size; x++) {
                const u = x / size;
                const ring = Math.sin(TAU * rings * (u + wobble));
                const fibre = (Math.sin(TAU * 53 * v + TAU * 3 * u) + fibreY) * 0.02;
                // Slow tonal drift across the board. Rings alone, at a realistic
                // spacing, read as even corduroy; real boards vary in tone over
                // distances much larger than the ring spacing. Integer cycles, so
                // this stays tileable like everything else here.
                const blotch = (Math.sin(TAU * 2 * v + TAU * u) * 0.6
                              + Math.sin(TAU * 3 * v + 2.1) * 0.4) * 0.09;
                const mix = Math.min(1, Math.max(0,
                    0.5 + (ring * 0.5 + fibre + blotch) * (spec.contrast * 2.0)));
                const i = (y * size + x) * 4;
                data[i]     = warm.r + (dark.r - warm.r) * mix;
                data[i + 1] = warm.g + (dark.g - warm.g) * mix;
                data[i + 2] = warm.b + (dark.b - warm.b) * mix;
                data[i + 3] = 255;
            }
        }
        context.putImageData(image, 0, 0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    speciesTextures.set(key, texture);
    return texture;
}

function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function getOrCreateWoodMaterial(role) {
    if (!woodMaterials.has(role)) {
        // The species tint, the same value applyWoodSpecies sets. Using the
        // swatch colour here instead meant a role created before the first
        // finish change was tinted differently from every role after it.
        const tint = woodSpecies(currentConfig.woodFinish).tint || '#ffffff';
        woodMaterials.set(role, new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(tint),
            metalness: 0.0,
            ior: 1.5,
            clearcoatRoughness: 0.35,
            envMapIntensity: 1.0
        }));
        applySurfaceFinish();
    }
    return woodMaterials.get(role);
}

// Kept for the material smoke check and the swatch handler, which both want
// "the" wood material; the desktop is the representative one.
function getOrCreateBirchMaterial() {
    const material = getOrCreateWoodMaterial('desktop');
    sharedBirchMaterial = material;
    return material;
}

// Which wood role a mesh plays. Measured, not guessed: Desktop_3 is the top
// slab, Desktop/Desktop_1/Desktop_2 are the edge and side pieces
// (see docs/sizing-gate.md).
// An edge strip is thin in cross-section: its middle dimension is a small
// fraction of its longest. The shaped side panels are not - they are 35 x 18in
// faces only 0.7in thick, so two of their three dimensions are broad. Matching
// on the name prefix alone sent those panels to the plywood-lamination
// material, which banded 11 stripes across a 646 sq in visible face.
const EDGE_ASPECT_MAX = 0.2;
function isEdgeStrip(mesh) {
    const geom = mesh.geometry;
    if (!geom) return false;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (!bb) return false;
    const dims = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z]
        .sort((a, b) => b - a);
    return dims[0] > 0 && dims[1] / dims[0] <= EDGE_ASPECT_MAX;
}

function woodRoleFor(mesh) {
    const name = mesh.name || '';
    if (name === 'Desktop_3') return 'desktop';
    if (name.startsWith('Desktop')) return isEdgeStrip(mesh) ? 'edge' : 'wing';
    if (name.startsWith('Top_Shelf')) return 'shelf';
    return 'desktop';
}

// Silver is the one frame finish that reads as bare metal. Kept in one place:
// this used to be spelled out at the constructor and at the swatch handler, and
// the two could drift.
function frameMetalness(finish) { return finish?.name === 'Silver' ? 0.75 : 0.1; }

// Species photographs, loaded once each and kept by path so two finishes drawn
// from the same image - Black Birch is birch tinted to a satin black - share one
// upload. Returns undefined until the image arrives; callers fall back to the
// generated grain for that frame and applySurfaceFinish re-runs on load.
function loadSpeciesPhoto(path) {
    if (!path) return undefined;
    if (speciesPhotos.has(path)) return speciesPhotos.get(path);
    speciesPhotos.set(path, undefined);
    textureLoader.load(path, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
        speciesPhotos.set(path, texture);
        applySurfaceFinish();
    }, undefined, () => {
        // Leave it unset: woodTextureFor falls back to generated grain, so a
        // missing file degrades to the old look rather than an untextured slab.
        console.warn('[ErgoFlex] Wood texture failed to load, using generated grain:', path);
        speciesPhotos.delete(path);
    });
    return undefined;
}

function loadBirchPhoto() { loadSpeciesPhoto(woodSpecies('Natural Birch').photo); }

function getOrCreateBasePaintMaterial() {
    if (!sharedBasePaintMaterial) {
        const defaultFinish = PRODUCT_CONFIG.baseFinishes.find(f => f.name === currentConfig.baseFinish);
        sharedBasePaintMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(defaultFinish.color),
            metalness: frameMetalness(defaultFinish),
            roughness: 0.45,
            ior: 1.5,
            clearcoat: 0.1,
            envMapIntensity: 1.1
        });
    }
    return sharedBasePaintMaterial;
}

function getOrCreatePolishedAluminumMaterial() {
    if (!sharedPolishedAluminumMaterial) {
        sharedPolishedAluminumMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#ffffff"),
            metalness: 1.0,
            roughness: 0.14,
            ior: 2.5,
            envMapIntensity: 1.35
        });
    }
    return sharedPolishedAluminumMaterial;
}

function getOrCreateBlackPlasticMaterial() {
    if (!sharedBlackPlasticMaterial) {
        sharedBlackPlasticMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#1a1a1a"),
            metalness: 0.1,
            roughness: 0.55,
            ior: 1.45,
        });
    }
    return sharedBlackPlasticMaterial;
}

function getOrCreateBlackMetalMaterial() {
    if (!sharedBlackMetalMaterial) {
        sharedBlackMetalMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color("#2a2a2a"),
            metalness: 0.85,
            roughness: 0.3,
            ior: 1.8,
            envMapIntensity: 1.2
        });
    }
    return sharedBlackMetalMaterial;
}

function populateFinishOptions() {
    woodFinishesGrid.innerHTML = '';
    PRODUCT_CONFIG.woodFinishes.forEach(finish => {
        woodFinishesGrid.appendChild(createFinishSwatch(finish, 'wood'));
    });
    baseFinishesGrid.innerHTML = '';
    PRODUCT_CONFIG.baseFinishes.forEach(finish => {
        baseFinishesGrid.appendChild(createFinishSwatch(finish, 'base'));
    });
}

function createFinishSwatch(finish, type) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'finish-swatch';
    swatch.dataset.finish = finish.name;
    swatch.dataset.material = type;
    swatch.setAttribute('aria-label', `${finish.name}, ${finish.price ? '+$' + finish.price : 'included'}`);
    swatch.setAttribute('aria-pressed', String(finish.name === currentConfig[type === 'wood' ? 'woodFinish' : 'baseFinish']));
    swatch.style.backgroundColor = finish.color;
    swatch.title = `${finish.name}${finish.price > 0 ? ` (+${finish.price})` : ''}`;
    if (finish.name === currentConfig[type === 'wood' ? 'woodFinish' : 'baseFinish']) swatch.classList.add('selected');
    swatch.addEventListener('click', () => selectFinish(finish, type, swatch));
    return swatch;
}

function selectFinish(finish, type, element) {
    const container = type === 'wood' ? woodFinishesGrid : baseFinishesGrid;
    container.querySelectorAll('.finish-swatch').forEach(el => { el.classList.remove('selected'); el.setAttribute('aria-pressed', 'false'); });
    element.setAttribute('aria-pressed', 'true');
    element.classList.add('selected');
    if (type === 'wood') {
        currentConfig.woodFinish = finish.name;
        document.getElementById('selected-wood-name').textContent = finish.name + (finish.price ? ' · +$' + finish.price : ' · Included');
        applyWoodSpecies(finish);
    } else {
        currentConfig.baseFinish = finish.name;
        document.getElementById('selected-base-name').textContent = finish.name + (finish.price ? ' · +$' + finish.price : ' · Included');
        if (sharedBasePaintMaterial) { sharedBasePaintMaterial.color.set(finish.color); sharedBasePaintMaterial.metalness = frameMetalness(finish); }
    }
    updatePrice();
}

function updatePrice() {
    // One price formula for the whole app: configurationPrice in catalog.mjs.
    // This used to re-implement the sum with different guards and a different
    // locale, so the headline price could disagree with the cart rows.
    const total = money(configurationPrice(currentConfig));
    totalPrice.textContent = total;
    cartPrice.textContent = total;
    renderPriceBreakdown();
    scheduleValidation();
    syncBuildSummary();
}

function addToCart() {
    // Date.now() collided for two items added in the same millisecond, and
    // remove() filters by id — so removing one deleted both.
    cartItems.push({ id: nextCartId(), ...cleanConfig(currentConfig), price: configurationPrice(currentConfig), quantity: 1 });
    persistCart();
    showCartModal();
}

function updateCartUI() {
    cartCount.textContent = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.classList.toggle('hidden', cartItems.length === 0);
}

function showCartModal() {
    const content = document.getElementById('cart-content');
    content.replaceChildren();
    if (!cartItems.length) content.textContent = 'Your build list is empty. Customize a desk to get started.';
    cartItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-row';
        const description = document.createElement('div');
        description.textContent = `${PRODUCT_CONFIG.sizes[item.size].name} · ${item.woodFinish} · ${item.baseFinish}`;
        const additions = document.createElement('ul'); additions.className = 'cart-accessories';
        for (const id of item.accessories || []) {
            const product = accessory(id);
            if (!product) continue;
            const line = document.createElement('li');
            const name = document.createElement('span'); name.textContent = product.name;
            const amount = document.createElement('span'); amount.textContent = money(product.price) + '*';
            line.append(name, amount); additions.append(line);
        }
        description.append(additions);
        const preview = document.createElement('button'); preview.className = 'cart-preview'; preview.textContent = 'View this build in 3D ↗';
        preview.onclick = () => {
            currentConfig = cleanConfig(item); applyConfigToUI(); applyAccessoryVisibility(); renderAccessories();
            closeDialog(document.getElementById('cart-modal'));
            if (loadedModel) focusObjects([loadedModel], { animate: true });
            canvas.scrollIntoView({ block: 'center', behavior: 'smooth' });
            notifyUser('Build loaded with its selected accessories.');
        };
        description.append(preview);
        const price = document.createElement('strong');
        price.textContent = money(item.price * item.quantity);
        const quantity = document.createElement('input');
        quantity.type = 'number'; quantity.min = '1'; quantity.max = '20'; quantity.value = item.quantity;
        quantity.setAttribute('aria-label', 'Quantity for ' + description.textContent);
        quantity.addEventListener('change', () => {
            item.quantity = Math.max(1, Math.min(20, Math.round(Number(quantity.value) || 1)));
            persistCart(); showCartModal();
        });
        const remove = document.createElement('button');
        remove.textContent = 'Remove';
        remove.addEventListener('click', () => { cartItems = cartItems.filter(i => i.id !== item.id); persistCart(); showCartModal(); });
        row.append(description, price, quantity, remove); content.append(row);
    });
    const total = document.createElement('p'); total.className = 'cart-total';
    total.textContent = 'Estimated total ' + money(cartItems.reduce((n, i) => n + i.price * i.quantity, 0));
    content.append(total);
    if (cartItems.some(item => item.accessories?.length)) {
        const note = document.createElement('p'); note.className = 'studio-note'; note.textContent = '* Accessory estimates shown per desk. Final pricing and availability need confirmation.'; content.append(note);
    }
    openDialog(document.getElementById('cart-modal'));
}

sizeSelect.addEventListener('change', (e) => {
    currentConfig.size = e.target.value;
    syncSizeChoiceUI();
    syncSizeGeometry();
    // Some accessories need a wider top. Drop the ones that no longer fit and
    // say which, rather than quietly charging for something that cannot ship.
    const dropped = incompatibleAccessories(currentConfig);
    if (dropped.length) {
        currentConfig.accessories = currentConfig.accessories.filter(id => accessoryFits(id, currentConfig.size));
        notifyUser(`${dropped.map(a => a.name).join(', ')} removed: not available at this size.`);
    }
    renderAccessories();
    applyAccessoryVisibility();
    updatePrice();
    scheduleValidation();
});

addToCartBtn.addEventListener('click', addToCart);

document.getElementById('continue-shopping').addEventListener('click', () => {
    closeDialog(document.getElementById('cart-modal'));
});

document.getElementById('reset-view').addEventListener('click', () => {
    if (controls) {
        controls.autoRotate = false;
        // A close-up shortcut lowers the orbit floor; put it back.
        controls.minDistance = DEFAULT_MIN_DISTANCE;
        cameraTween.active = false;
        camera.position.set(STARTING_POS.x, STARTING_POS.y, STARTING_POS.z);
        controls.target.set(STARTING_TARGET.x, STARTING_TARGET.y, STARTING_TARGET.z);
        controls.update();
        if (loadedModel) focusObjects([loadedModel]);
        document.getElementById('camera-view').value = 'hero';
    }
});

document.getElementById('cart-modal').addEventListener('click', (e) => {
    if (e.target.id === 'cart-modal') {
        closeDialog(document.getElementById('cart-modal'));
    }
});

// --- Phase 2.1: Named Groups ---
function saveCurrentGroup(name) {
    if (!name || movingObjects.length === 0) return;
    const editorIds = movingObjects.map(item => item.obj.userData.editorId).filter(editorId => partRegistry.has(editorId));
    if (!editorIds.length) return notifyUser('Named groups are for desk parts. Scene assets stay organized in the scene list.');
    savedGroups[name] = editorIds;
    try { localStorage.setItem('ergoflexGroups', JSON.stringify(savedGroups)); } catch(e) {}
    rebuildGroupDropdown();
}

function loadGroup(name) {
    if (!name || !savedGroups[name]) return;
    // Clear current selection
    if (clearPartsBtn) clearPartsBtn.click();

    const editorIds = savedGroups[name];
    let missingCount = 0;
    editorIds.forEach(eid => {
        const entry = partRegistry.get(eid);
        if (entry) {
            toggleMovingObject(entry.obj, true, true);
        } else {
            missingCount++;
            console.warn('[ErgoFlex] Part [' + eid + '] not found — was it a clone from a previous session?');
        }
    });
    updateTransformProxy();
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    if (missingCount > 0) {
        console.warn('[ErgoFlex] ' + missingCount + ' part(s) could not be restored from group "' + name + '"');
    }
}

function deleteGroup(name) {
    if (!name || !savedGroups[name]) return;
    delete savedGroups[name];
    try { localStorage.setItem('ergoflexGroups', JSON.stringify(savedGroups)); } catch(e) {}
    rebuildGroupDropdown();
}

function exportGroup(name) {
    if (!name || !savedGroups[name]) return;
    const editorIds = savedGroups[name];
    const parts = editorIds.map(eid => {
        const entry = partRegistry.get(eid);
        if (!entry) return { editorId: eid, name: '(missing)', path: '' };
        const obj = entry.obj;
        obj.updateMatrixWorld(true);
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        // Build scene path
        const pathParts = [];
        let cur = obj;
        while (cur && cur !== scene) {
            if (cur.name) pathParts.unshift(cur.name);
            cur = cur.parent;
        }
        return {
            editorId: eid,
            name: entry.name || obj.name,
            scenePath: pathParts.join(' > '),
            worldPos: { x: +wp.x.toFixed(4), y: +wp.y.toFixed(4), z: +wp.z.toFixed(4) }
        };
    });
    const data = { groupName: name, partCount: parts.length, parts: parts };
    const json = JSON.stringify(data, null, 2);
    // Copy to clipboard and also offer download
    navigator.clipboard.writeText(json).then(() => {
        console.log('[ErgoFlex] Group "' + name + '" exported to clipboard');
    }).catch(() => {});
    // Trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'group_' + name.replace(/\s+/g, '_') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function rebuildGroupDropdown() {
    const sel = document.getElementById('group-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Group --</option>';
    Object.keys(savedGroups).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name + ' (' + savedGroups[name].length + ' parts)';
        sel.appendChild(opt);
    });
}

// --- Phase 2.2: Part Search/Filter ---
function onPartSearch(query) {
    const resultsDiv = document.getElementById('part-search-results');
    if (!resultsDiv) return;
    if (!query || query.length < 2) {
        resultsDiv.classList.add('hidden');
        resultsDiv.innerHTML = '';
        return;
    }
    const lowerQuery = query.toLowerCase();
    const matches = [];
    const searchableEntries = [...partRegistry.values(), ...sceneAssetRegistry.values()];
    searchableEntries.forEach((entry) => {
        const custom = partLabels.get(entry.editorId) || '';
        if (entry.name.toLowerCase().includes(lowerQuery) ||
            custom.toLowerCase().includes(lowerQuery) ||
            entry.editorId.toLowerCase().includes(lowerQuery)) {
            matches.push(entry);
        }
    });
    if (matches.length === 0) {
        resultsDiv.classList.add('hidden');
        resultsDiv.innerHTML = '';
        return;
    }
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = '';
    matches.slice(0, 100).forEach(entry => {
        const div = document.createElement('div');
        div.className = 'px-3 py-1.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center';
        const isSelected = movingObjects.some(item => item.obj === entry.obj);
        const custom = partLabels.get(entry.editorId);
        div.innerHTML = '<span>' + (custom ? '<b>' + custom + '</b> <span class="text-gray-400 text-xs">' + entry.name + '</span>' : entry.name) + '</span>' +
            (isSelected ? '<span class="text-green-500 text-xs font-bold">SEL</span>' : '') +
            (entry.isClone ? '<span class="text-purple-500 text-xs font-bold ml-1">CLONE</span>' : '') +
            (entry.kind === 'sceneAsset' ? '<span class="text-blue-500 text-xs font-bold ml-1">SCENE</span>' : '');
        div.addEventListener('click', () => {
            toggleMovingObject(entry.obj, null);
            lastSelectedEditorId = entry.editorId;
            refreshSelectedPartUI();
            onPartSearch(query); // refresh results
        });
        resultsDiv.appendChild(div);
    });
    if (matches.length > 100) {
        const more = document.createElement('div');
        more.className = 'px-3 py-1.5 text-gray-400 text-xs';
        more.textContent = '...and ' + (matches.length - 100) + ' more';
        resultsDiv.appendChild(more);
    }
}

// --- Phase 2.3: Scene Hierarchy Tree ---
function buildSceneTree() {
    const container = document.getElementById('scene-tree-content');
    if (!container || !loadedModel) return;
    container.innerHTML = '';
    buildTreeNode(container, loadedModel, 0);
    if (sceneAssetRegistry.size) {
        const heading = document.createElement('div');
        heading.className = 'font-semibold text-blue-700 border-t border-gray-200 mt-2 pt-2 px-1';
        heading.textContent = `Scene assets (${sceneAssetRegistry.size})`;
        container.appendChild(heading);
        sceneAssetRegistry.forEach(entry => {
            const row = document.createElement('label');
            row.className = 'scene-tree-asset-row';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = movingObjects.some(item => item.obj === entry.obj);
            input.onchange = () => { toggleMovingObject(entry.obj, input.checked); renderSceneAssetList(); };
            const name = document.createElement('span');
            name.textContent = partLabel(entry.editorId);
            name.title = entry.editorId;
            row.append(input, name);
            container.appendChild(row);
        });
    }
}

function buildTreeNode(parentEl, obj, depth) {
    const div = document.createElement('div');
    div.style.paddingLeft = (depth * 12) + 'px';

    const hasChildren = obj.children && obj.children.length > 0;
    const isMesh = obj.isMesh;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-1 py-0.5 hover:bg-gray-50 rounded';

    if (hasChildren && !isMesh) {
        const toggle = document.createElement('span');
        toggle.className = 'cursor-pointer text-gray-400 select-none w-3 text-center';
        toggle.textContent = '+';
        toggle.style.fontSize = '10px';
        const childContainer = document.createElement('div');
        childContainer.style.display = 'none';

        toggle.addEventListener('click', () => {
            const open = childContainer.style.display !== 'none';
            childContainer.style.display = open ? 'none' : 'block';
            toggle.textContent = open ? '+' : '-';
            // Lazy render children
            if (!childContainer.dataset.built) {
                childContainer.dataset.built = 'true';
                obj.children.forEach(child => buildTreeNode(childContainer, child, depth + 1));
            }
        });
        row.appendChild(toggle);

        const label = document.createElement('span');
        label.className = 'text-gray-600';
        label.textContent = (obj.name || obj.type) + ' (' + obj.children.length + ')';

        // Parent select/deselect all children
        label.className += ' cursor-pointer hover:text-blue-600';
        label.addEventListener('click', () => {
            const meshChildren = [];
            obj.traverse(c => { if (c.isMesh) meshChildren.push(c); });
            const allSelected = meshChildren.every(c => movingObjects.some(m => m.obj === c));
            meshChildren.forEach(c => toggleMovingObject(c, !allSelected, true));
            updateTransformProxy();
            if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
        });
        row.appendChild(label);
        div.appendChild(row);
        div.appendChild(childContainer);
    } else if (isMesh) {
        const spacer = document.createElement('span');
        spacer.className = 'w-3';
        spacer.innerHTML = '&nbsp;';
        row.appendChild(spacer);

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'accent-green-500';
        cb.checked = movingObjects.some(item => item.obj === obj);
        cb.addEventListener('change', () => {
            toggleMovingObject(obj, cb.checked);
        });
        row.appendChild(cb);

        const label = document.createElement('span');
        label.className = 'cursor-pointer hover:text-blue-600';
        const isSelected = movingObjects.some(item => item.obj === obj);
        if (isSelected) label.className += ' text-green-700 font-bold';
        const custom = partLabels.get(obj.userData.editorId);
        label.textContent = custom || obj.name || 'unnamed';
        if (custom) label.title = obj.name;
        if (obj.userData.editorId) {
            label.title = obj.userData.editorId;
        }
        label.addEventListener('click', () => {
            toggleMovingObject(obj, null);
            buildSceneTree(); // refresh
        });
        row.appendChild(label);
        div.appendChild(row);
    } else if (hasChildren) {
        // Non-mesh group nodes
        const toggle = document.createElement('span');
        toggle.className = 'cursor-pointer text-gray-400 select-none w-3 text-center';
        toggle.textContent = '+';
        toggle.style.fontSize = '10px';
        const childContainer = document.createElement('div');
        childContainer.style.display = 'none';

        toggle.addEventListener('click', () => {
            const open = childContainer.style.display !== 'none';
            childContainer.style.display = open ? 'none' : 'block';
            toggle.textContent = open ? '+' : '-';
            if (!childContainer.dataset.built) {
                childContainer.dataset.built = 'true';
                obj.children.forEach(child => buildTreeNode(childContainer, child, depth + 1));
            }
        });
        row.appendChild(toggle);
        const label = document.createElement('span');
        label.className = 'text-gray-400';
        label.textContent = (obj.name || obj.type);
        row.appendChild(label);
        div.appendChild(row);
        div.appendChild(childContainer);
    }

    parentEl.appendChild(div);
}

// --- Collapsible debug panel ---
// Migrated onto makeCollapsible. The localStorage key is unchanged, so an
// existing preference carries over. It uses display rather than a max-height
// transition, because this panel is tall enough that a ceiling would clip it.
let toggleDebugPanel = () => {};

function initDebugPanelCollapse() {
    toggleDebugPanel = makeCollapsible('debug-panel', {
        storageKey: 'ergoflexDebugCollapsed',
        mode: 'display',
        onToggle: collapsed => {
            const icon = document.getElementById('debug-collapse-icon');
            if (icon) icon.innerHTML = collapsed ? '&#9654;' : '&#9660;';
        }
    });
}

// --- Phase 2.6: Clone/Duplicate Parts ---
// One clone, one place. cloneSelectedParts uses it with a fresh id; project
// import uses it with the id recorded in the file, so a restored clone keeps the
// identity that the saved groups and rigs refer to.
function makeClone(original, editorId, { parent = null, offsetX = 0.05, joinLift = null } = {}) {
    const clone = original.clone(true);
    clone.userData.editorId = editorId;
    clone.userData.sourceEditorId = original.userData?.editorId || null;
    partRegistry.set(editorId, { obj: clone, name: original.name, editorId, isClone: true });

    clone.position.x += offsetX;
    (parent || original.parent || scene).add(clone);

    const shouldJoinLift = joinLift === null ? liftObjects.has(original) : joinLift;
    if (shouldJoinLift) liftObjects.set(clone, { obj: clone, baseY: clone.position.y - (currentLift - LIFT_MIN) });
    interactableObjects.push(clone);

    // A clone participates in sizing like any other part, so it needs its own
    // pristine baseline captured at creation.
    captureAssetBaseline(clone);
    return clone;
}

function cloneSelectedParts() {
    if (movingObjects.length === 0) return;
    const deskParts = movingObjects.filter(item => !item.obj.userData?.sceneAsset);
    const newClones = deskParts.map(item =>
        makeClone(item.obj, item.obj.name + '_clone_' + (editorIdCounter++)));
    if (!newClones.length) return notifyUser('Use Add again in the scene library to duplicate a scene asset.');
    transaction({ type: 'clone', clones: newClones });
    buildSceneTree();
}

// --- Phase 3: Tilt Animation System ---
//
// How it works (mirrors the lift's bake workflow):
//  1. In setup mode (?setup), select the parts that should tilt, optionally Pick Pivot,
//     set axis/min/max and Save Tilt Config. A wrapper THREE.Group is created INSIDE the
//     model hierarchy at the pivot point; the parts are re-parented into it. The wrapper
//     rotates for tilt and is translated by the lift system, so tilt + lift compose.
//  2. Click "Export Tilt Configs (JSON)" and paste the payload into BAKED_TILT_CONFIGS
//     below. Baked configs are rebuilt automatically on every page load, and each one
//     gets a customer-facing slider in the viewer overlay.
//  pivotLocal is stored in model-local coordinates at the 28" reference height.
const BAKED_TILT_CONFIGS = [
    // "tilting" — desktop tilt rig built in the editor (Jul 6, 2026).
    // Authored rest pose is physical -5°, tilts through +65° around the Z axis, anchored at the picked
    // pivot part. pivotLocal is model-local at the 28" reference height.
    {
        name: "tilting",
        axis: "z",
        minDeg: TILT_MIN,
        maxDeg: TILT_MAX,
        pivotLocal: { x: -175.85000650000003, y: 24.739389450000004, z: -306.42251899999997 },
        groupEditorIds: [
            "Desktop_1_4", "Desktop_2_5", "Desktop_3", "Desktop_3_6",
            "L_A_Hardware_Top_1_33", "L_A_Hardware_Top_3_35", "L_A_Hardware_Top_4_255",
            "L_A_Hardware_Top_6_257", "L_A_Hardware_Top_7_258", "mesh_692_692",
            "Power_1_1", "Power_2_2", "Power_4_8", "Power_7_11",
            "L_A_Hardware_Top_32", "L_A_Hardware_Top_2_34", "L_A_Hardware_Top_5_256",
            "Touch_Screen_1_583", "Touch_Screen_2_584", "Touch_Screen_3_585",
            "mesh_624_624", "mesh_625_625", "mesh_626_626",
            "Touch_Screen_4_683", "Touch_Screen_5_684", "Touch_Screen_6_685",
            "Touch_Screen_7_686", "Power_3_7", "Power_5_9", "Touch_Screen_582",
            "Power_0", "Power_6_10"
        ]
    }
];

const tiltConfigs = [];
let tiltPivotEditorId = null; // currently designated pivot part
let isPickingPivot = false;
let pivotHighlightHelper = null;

function isInTiltWrapper(obj) {
    let cur = obj.parent;
    while (cur) {
        if (cur.userData && cur.userData.isTiltWrapper) return true;
        cur = cur.parent;
    }
    return false;
}

function removeFromLift(obj) {
    liftObjects.delete(obj);
    const i = movingObjects.findIndex(item => item.obj === obj);
    if (i > -1) movingObjects.splice(i, 1);
    if (boxHelpers.has(obj.uuid)) {
        scene.remove(boxHelpers.get(obj.uuid));
        boxHelpers.delete(obj.uuid);
    }
}

// Re-adds a part to the lift system with a FRESH baseY. Always drop any existing
// entry first — an entry created while the part sat inside a tilt wrapper holds a
// wrapper-local baseY, which would make the part jump on the next height change.
function rejoinLift(obj) {
    toggleMovingObject(obj, false, true);
    toggleMovingObject(obj, true, true);
    liftObjects.set(obj, { obj, baseY: obj.position.y - (currentLift - LIFT_MIN) });
}

// Attach/detach parts on an EXISTING tilt rig. Both zero the rotation first so
// parts join or leave in the rest pose, then restore the current angle.
function attachPartsToTilt(config, parts) {
    const savedDeg = config.currentDeg;
    // Attach at the GLB's authored pose. The production rig's displayed 0°
    // is physically level, but its authored rest pose is displayed as -5°.
    config.wrapperGroup.rotation.set(0, 0, 0);
    config.wrapperGroup.updateMatrixWorld(true);
    parts.forEach(obj => {
        removeFromLift(obj);
        animOriginalParents.set(obj, obj.parent);
        obj.updateMatrixWorld(true);
        config.wrapperGroup.attach(obj);
        const eid = obj.userData.editorId;
        if (eid && !config.groupEditorIds.includes(eid)) config.groupEditorIds.push(eid);
    });
    config.currentDeg = savedDeg;
    applyTiltConfig(config);
}

function detachPartsFromTilt(config, parts) {
    const savedDeg = config.currentDeg;
    config.wrapperGroup.rotation.set(0, 0, 0);
    config.wrapperGroup.updateMatrixWorld(true);
    parts.forEach(obj => {
        if (obj.parent !== config.wrapperGroup) return;
        const parent = animOriginalParents.get(obj) || loadedModel;
        parent.attach(obj);
        animOriginalParents.delete(obj);
        rejoinLift(obj);
        const i = config.groupEditorIds.indexOf(obj.userData.editorId);
        if (i > -1) config.groupEditorIds.splice(i, 1);
    });
    config.currentDeg = savedDeg;
    applyTiltConfig(config);
}

function addSelectedToTiltConfig(idx) {
    const config = tiltConfigs[idx];
    if (!config || movingObjects.length === 0) return;
    // Release any parts held by the transform gizmo first
    if (transformControl) transformControl.detach();
    [...transformProxy.children].forEach(child => {
        const p = proxyOriginalParents.get(child);
        if (p) { p.attach(child); proxyOriginalParents.delete(child); }
        else scene.attach(child);
    });
    const parts = movingObjects
        .map(item => item.obj)
        .filter(obj => {
            if (telescopingObjects.some(t => t.obj === obj)) {
                console.warn('[ErgoFlex] Skipping telescoping part "' + obj.name + '" — it cannot join a tilt group.');
                return false;
            }
            return !isInTiltWrapper(obj);
        });
    if (parts.length === 0) return;
    attachPartsToTilt(config, parts);
    transaction({ type: 'tilt-parts', name: config.name, editorIds: parts.map(o => o.userData.editorId).filter(Boolean), added: true });
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    updateTransformProxy();
    persistTiltConfigs();
    rebuildTiltUI();
}

function removeSelectedFromTiltConfig(idx) {
    const config = tiltConfigs[idx];
    if (!config) return;
    const parts = movingObjects.map(item => item.obj).filter(obj => obj.parent === config.wrapperGroup);
    if (parts.length === 0) {
        console.warn('[ErgoFlex] No selected parts belong to "' + config.name + '" — click-select the parts to remove first.');
        return;
    }
    detachPartsFromTilt(config, parts);
    transaction({ type: 'tilt-parts', name: config.name, editorIds: parts.map(o => o.userData.editorId).filter(Boolean), added: false });
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    updateTransformProxy();
    persistTiltConfigs();
    rebuildTiltUI();
}

// Builds the tilt rig: a wrapper group parented into the model (so it shares the
// model's units/scale), positioned at the pivot, with the parts attached to it.
function createTiltConfig({ name, axis, minDeg, maxDeg, parts, pivotLocal, groupEditorIds }) {
    const liftOffset = currentLift - LIFT_MIN;

    const wrapper = new THREE.Group();
    wrapper.name = 'tiltWrapper_' + name;
    wrapper.userData.isTiltWrapper = true;
    wrapper.position.set(pivotLocal.x, pivotLocal.y + liftOffset, pivotLocal.z);
    loadedModel.add(wrapper);
    wrapper.updateMatrixWorld(true);

    parts.forEach(obj => {
        removeFromLift(obj);
        animOriginalParents.set(obj, obj.parent);
        obj.updateMatrixWorld(true);
        wrapper.attach(obj);
    });

    const config = {
        name, axis,
        minDeg: name === 'tilting' ? TILT_MIN : minDeg,
        maxDeg: name === 'tilting' ? TILT_MAX : maxDeg,
        currentDeg: name === 'tilting' ? TILT_MIN : 0,
        groupEditorIds,
        wrapperGroup: wrapper,
        wrapperBaseY: pivotLocal.y,
        pivotLocal: { x: pivotLocal.x, y: pivotLocal.y, z: pivotLocal.z }
    };
    tiltConfigs.push(config);
    return config;
}

function serializeTiltConfigs() {
    return tiltConfigs.map(c => ({
        name: c.name,
        axis: c.axis,
        minDeg: c.minDeg,
        maxDeg: c.maxDeg,
        pivotLocal: c.pivotLocal,
        groupEditorIds: c.groupEditorIds
    }));
}

function persistTiltConfigs() {
    try { localStorage.setItem('ergoflexTiltConfigs', JSON.stringify(serializeTiltConfigs())); } catch (e) {}
}

function restoreTiltConfigs() {
    // A baked default that the user deleted stays deleted; without this the
    // deletion silently undoes itself on the next load.
    const isDeleted = name => deletedBakedRigs.tilt.has(name);
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('ergoflexTiltConfigs') || '[]'); } catch (e) {}
    // Locally-saved configs FIRST so your latest edits (added/removed parts)
    // override the baked version of the same name; baked fills in the rest.
    const bakedTiltNames = new Set(BAKED_TILT_CONFIGS.map(c => c.name));
    const shadowedTilts = saved.filter(c => c && bakedTiltNames.has(c.name)).map(c => c.name);
    if (shadowedTilts.length) {
        console.warn('[ErgoFlex] Using this browser\'s saved copy of tilt config(s): ' + shadowedTilts.join(', ') +
            '. Edits to the baked definition in index.html are ignored until you click ' +
            '"Reset saved animation data" in the Actuator Rigs panel.');
    }
    const all = [...saved, ...BAKED_TILT_CONFIGS];
    all.forEach(baked => {
        if (!baked || !baked.name || isDeleted(baked.name) || tiltConfigs.some(c => c.name === baked.name)) return;
        const parts = (baked.groupEditorIds || [])
            .map(eid => {
                const entry = partRegistry.get(eid);
                if (!entry) console.warn('[ErgoFlex] Tilt config "' + baked.name + '": part [' + eid + '] not found in model.');
                return entry ? entry.obj : null;
            })
            .filter(obj => obj && !isInTiltWrapper(obj));
        if (parts.length === 0) return;
        createTiltConfig({
            name: baked.name,
            axis: baked.axis || 'z',
            minDeg: typeof baked.minDeg === 'number' ? baked.minDeg : -15,
            maxDeg: typeof baked.maxDeg === 'number' ? baked.maxDeg : 15,
            parts: parts,
            pivotLocal: baked.pivotLocal || { x: 0, y: 0, z: 0 },
            groupEditorIds: baked.groupEditorIds || []
        });
    });
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    if (tiltConfigs.length > 0) rebuildTiltUI();
    // Report only on the rigs that were actually built. Warning inside the
    // restore loop cried wolf: a saved copy whose ids no longer resolve is
    // skipped and the baked definition takes over, leaving a sound rig.
    tiltConfigs.forEach(config => {
        const missing = (config.groupEditorIds || []).filter(eid => !partRegistry.get(eid));
        if (missing.length) {
            reportSceneWarning('tilt-parts-missing',
                `Tilt rig "${config.name}" is missing ${missing.length} of its ${config.groupEditorIds.length} parts.`,
                missing);
        }
    });
}

function setPivotPart(editorId) {
    clearPivotHighlight();
    tiltPivotEditorId = editorId;
    const entry = partRegistry.get(editorId);
    if (entry) {
        const helper = new THREE.BoxHelper(entry.obj, 0xff8800);
        scene.add(helper);
        pivotHighlightHelper = helper;
        const status = document.getElementById('pivot-status');
        if (status) status.textContent = 'Pivot: ' + entry.name;
        const clearBtn = document.getElementById('clear-pivot-btn');
        if (clearBtn) clearBtn.classList.remove('hidden');
        updateTransformProxy(); // re-anchor the gizmo onto the pivot
    }
}

function clearPivotHighlight() {
    if (pivotHighlightHelper) {
        scene.remove(pivotHighlightHelper);
        pivotHighlightHelper = null;
    }
}

function clearPivotSelection() {
    clearPivotHighlight();
    tiltPivotEditorId = null;
    const status = document.getElementById('pivot-status');
    if (status) status.textContent = 'Pivot: None (center)';
    const clearBtn = document.getElementById('clear-pivot-btn');
    if (clearBtn) clearBtn.classList.add('hidden');
    updateTransformProxy(); // back to selection-center anchoring
}

function updatePickPivotBtnState() {
    const btn = document.getElementById('pick-pivot-btn');
    if (!btn) return;
    if (isPickingPivot) {
        btn.textContent = 'Click a part...';
        btn.classList.add('bg-orange-100', 'ring-2', 'ring-orange-400');
    } else {
        btn.textContent = 'Pick Pivot';
        btn.classList.remove('bg-orange-100', 'ring-2', 'ring-orange-400');
    }
}

function saveTiltConfig() {
    const name = document.getElementById('tilt-name-input')?.value?.trim();
    if (!name || movingObjects.length === 0 || !loadedModel) { notifyUser('Name your tilt and select its parts first.'); return; }
    if (tiltConfigs.some(c => c.name === name)) {
        console.warn('[ErgoFlex] A tilt config named "' + name + '" already exists — remove it first or pick another name.');
        return;
    }

    const axisRadio = document.querySelector('input[name="tilt_axis"]:checked');
    const axis = axisRadio ? axisRadio.value : 'z';
    const minDeg = Number(document.getElementById('tilt-min-deg').value);
    const maxDeg = Number(document.getElementById('tilt-max-deg').value);
    if (!Number.isFinite(minDeg) || !Number.isFinite(maxDeg) || minDeg >= maxDeg || minDeg < -90 || maxDeg > 90) { notifyUser('Enter a tilt range between −90° and 90°, with minimum below maximum.'); return; }

    // Release any parts held by the transform gizmo so world transforms are clean
    if (transformControl) transformControl.detach();
    [...transformProxy.children].forEach(child => {
        const p = proxyOriginalParents.get(child);
        if (p) {
            p.attach(child);
            proxyOriginalParents.delete(child);
        } else {
            scene.attach(child);
        }
    });

    // Telescoping columns move at a different lift ratio — they can't ride a tilt rig.
    // Parts already inside another tilt wrapper are skipped too.
    const parts = movingObjects
        .map(item => item.obj)
        .filter(obj => {
            if (telescopingObjects.some(t => t.obj === obj)) {
                console.warn('[ErgoFlex] Skipping telescoping part "' + obj.name + '" — it cannot join a tilt group.');
                return false;
            }
            return !isInTiltWrapper(obj);
        });
    if (parts.length === 0) return;

    const groupEditorIds = parts.map(obj => obj.userData.editorId).filter(Boolean);

    // Resolve pivot: designated part's origin, or center of the selection
    let pivotWorld = new THREE.Vector3();
    let pivotResolved = false;
    if (tiltPivotEditorId) {
        const pivotEntry = partRegistry.get(tiltPivotEditorId);
        if (pivotEntry) {
            // Use the part's visible geometry center, NOT obj.getWorldPosition().
            // CAD-exported GLBs often give every mesh the same origin (the CAD
            // world origin), so the origin says nothing about where the part is.
            pivotEntry.obj.updateMatrixWorld(true);
            const pivotBox = new THREE.Box3().setFromObject(pivotEntry.obj);
            pivotBox.getCenter(pivotWorld);
            pivotResolved = true;
        }
    }
    if (!pivotResolved) {
        const box = new THREE.Box3();
        parts.forEach(obj => {
            obj.updateMatrixWorld(true);
            box.expandByObject(obj);
        });
        box.getCenter(pivotWorld);
    }

    // Store the pivot in model-local space, normalized to the 28" reference height
    loadedModel.updateMatrixWorld(true);
    const pivotLocal = loadedModel.worldToLocal(pivotWorld.clone());
    pivotLocal.y -= (currentLift - LIFT_MIN);

    createTiltConfig({ name, axis, minDeg, maxDeg, parts, pivotLocal, groupEditorIds });
    transaction({ type: 'tilt-save', name: name });

    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    updateTransformProxy();
    clearPivotSelection();
    const nameInput = document.getElementById('tilt-name-input');
    if (nameInput) nameInput.value = '';
    persistTiltConfigs();
    rebuildTiltUI();
}

// One per-rig slider, in the editor panel. There used to be a second copy of
// every one of these floating inside the motion remote, which is a replica of
// the phone app - and the phone app has no per-rig sliders. The remote's arc is
// the tilt control; these are an authoring tool and belong with the rig fields.
function rebuildTiltUI() {
    const list = document.getElementById('tilt-configs-list');
    if (list) list.innerHTML = '';
    tiltConfigs.forEach((config, idx) => {
        // Debug panel slider
        const div = document.createElement('div');
        div.className = 'bg-orange-50 border border-orange-200 p-2 rounded-lg';
        div.innerHTML =
            '<div class="flex justify-between items-center mb-1">' +
            '<span class="font-medium text-orange-800">' + config.name + ' (' + config.axis.toUpperCase() + ', ' + config.wrapperGroup.children.length + ' parts)</span>' +
            '<div class="flex items-center gap-2">' +
            '<span class="text-xs text-orange-600" id="tilt-val-' + idx + '">' + config.currentDeg.toFixed(1) + ' deg</span>' +
            '<button class="tilt-reset" data-reset-tilt="' + idx + '" title="Reset this rig to zero">↺</button>' +
            '<button class="text-red-400 hover:text-red-600 text-sm font-bold leading-none" data-remove-tilt="' + idx + '" title="Remove tilt config">✕</button>' +
            '</div></div>' +
            '<input type="range" min="' + config.minDeg + '" max="' + config.maxDeg + '" step="0.1" value="' + config.currentDeg + '" class="w-full" data-tilt-idx="' + idx + '">' +
            '<div class="flex gap-2 mt-1.5">' +
            '<button data-add-parts-tilt="' + idx + '" class="text-xs bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 px-2 py-1 rounded font-medium transition-colors" title="Attach the currently selected parts to this tilt group">+ Add selected</button>' +
            '<button data-del-parts-tilt="' + idx + '" class="text-xs bg-white border border-orange-300 text-orange-700 hover:bg-orange-100 px-2 py-1 rounded font-medium transition-colors" title="Detach the currently selected parts from this tilt group">− Remove selected</button>' +
            '</div>';
        if (list) list.appendChild(div);

        const panelSlider = div.querySelector('input[type="range"]');

        function onTiltInput(deg, source) {
            const heightLimit = config.name === 'tilting'
                ? maximumTiltForHeight(liftToHeight(currentLift), currentConfig.size) : config.maxDeg;
            config.currentDeg = THREE.MathUtils.clamp(Number(deg) || 0, config.minDeg, Math.min(config.maxDeg, heightLimit));
            const valSpan = document.getElementById('tilt-val-' + idx);
            if (valSpan) valSpan.textContent = config.currentDeg.toFixed(1) + ' deg';
            panelSlider.value = config.currentDeg;
            applyTiltConfig(config);
            // The remote's readout tracks the primary rig, so a rig edit here has
            // to reach it - it is the same angle seen from the other panel.
            syncTiltUI();
        }

        panelSlider.addEventListener('input', (e) => onTiltInput(parseFloat(e.target.value), panelSlider));

        // Delete buttons
        div.querySelector('[data-remove-tilt]')?.addEventListener('click', () => removeTiltConfig(idx));
        div.querySelector('[data-reset-tilt]')?.addEventListener('click', () => onTiltInput(THREE.MathUtils.clamp(0, config.minDeg, config.maxDeg), null));
        panelSlider.setAttribute('aria-label', config.name + ' angle in degrees');

        // Add/remove selected parts on the existing rig
        div.querySelector('[data-add-parts-tilt]')?.addEventListener('click', () => addSelectedToTiltConfig(idx));
        div.querySelector('[data-del-parts-tilt]')?.addEventListener('click', () => removeSelectedFromTiltConfig(idx));
    });
    // The remote's primary tilt control reads from these rigs, and at first build
    // there were none to read.
    syncTiltUI();
}

function removeTiltConfig(idx, { recordUndo = true } = {}) {
    const config = tiltConfigs[idx];
    if (!config) return;
    // Deleting a rig used to be unrecoverable. Capture the serialized definition
    // first so undo can rebuild it. recordUndo is false when performUndo itself is
    // the caller, so undoing a tilt-save does not push a new entry.
    if (recordUndo) {
        writeAutosave('before deleting tilt rig ' + config.name);
        transaction({ type: 'rig-restore', kind: 'tilt', definition: serializeTiltConfigs()[idx] });
        deletedBakedRigs.tilt.add(config.name);
    }
    // Reset rotation so world transforms are clean before re-parenting
    config.wrapperGroup.rotation.set(0, 0, 0);
    config.wrapperGroup.updateMatrixWorld(true);
    // Hand each part back to its original parent and to the lift system
    [...config.wrapperGroup.children].forEach(child => {
        const parent = animOriginalParents.get(child) || loadedModel;
        parent.attach(child);
        animOriginalParents.delete(child);
        rejoinLift(child); // fresh baseY at the current height
    });
    if (config.wrapperGroup.parent) config.wrapperGroup.parent.remove(config.wrapperGroup);
    tiltConfigs.splice(idx, 1);
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    updateTransformProxy();
    persistTiltConfigs();
    rebuildTiltUI();
}

function applyTiltConfig(config) {
    if (!config.wrapperGroup) return;
    if (config.name === 'tilting' && !motionPaused) {
        config.currentDeg = THREE.MathUtils.clamp(config.currentDeg, TILT_MIN,
            maximumTiltForHeight(liftToHeight(currentLift), currentConfig.size));
    }
    // Rhino authored this desk at physical -5°. Its original Z rotation is
    // zero there; level is -5° in rig space, and +65° is -70° in rig space.
    const rigDeg = config.name === 'tilting' ? rigDegreesForTilt(config.currentDeg) : config.currentDeg;
    const rad = THREE.MathUtils.degToRad(rigDeg);
    config.wrapperGroup.rotation.set(0, 0, 0);
    if (config.axis === 'x') config.wrapperGroup.rotation.x = rad;
    else if (config.axis === 'y') config.wrapperGroup.rotation.y = rad;
    else config.wrapperGroup.rotation.z = rad;
    config.wrapperGroup.updateMatrixWorld(true);
    updateActuatorRigs();
    if (config === primaryTiltConfig()) updateDesktopReflectionTilt();
}

// --- Phase 4: Actuator Rigs ---
//
// A rig makes actuator geometry FOLLOW a tilt automatically, as an exact
// two-point linkage: the cylinder rotates around a fixed base point B so it
// always aims at a target point A riding on the tilting assembly; the rod
// gets the same rotation plus a slide along the axis by |BA| - restLength,
// so it telescopes in and out of the cylinder. No ratios to tune.
// baseLocal is model-local at the 28" reference height; both B and A ride
// the lift equally, so rigs are lift-invariant by construction.
const BAKED_ACTUATOR_RIGS = [
    // Paste exported actuator rig payloads here (from "Export Animations").
    //
    // The two lift actuators, measured off full.glb (Sep 9, 2026). Each aims at a
    // top clevis pin that belongs to the "tilting" group, so both actuators swing
    // and telescope automatically whenever the desktop tilt slider moves — no
    // separate keyframes.
    //
    //   cylinder = body + base clevis + pin (swings about the base pivot)
    //   rod      = the shaft that also slides in/out as the throw changes
    //   baseLocal = centre of the Plates_Hardware base pin, model-local at 28"
    //               (i.e. LIFT_MIN — the raw glTF Y minus 19.25, which is how the
    //               base picker reports it; do not paste raw model coordinates here)
    //
    // Rest throw is 28.23 units on both sides. If a pivot looks off in the
    // viewer, hit "Pivot" on the rig and nudge it — no need to rebuild by hand.
    {
        name: "actuator_rear",
        baseLocal: { x: -173.1007, y: 13.382, z: -346.3278 },
        // The long top clevis pin, mirror of L_A_Hardware_Top_3_35 on the front rig.
        // (L_A_Hardware_Top_7_258 is the block around it — same spot to within 0.2
        // units, but the pin is the actual hinge and keeps both sides symmetric.)
        targetEditorId: "L_A_Hardware_Top_4_255",
        cylinderEditorIds: [
            "Linear_Actuators_2_38", "Linear_Actuators_5_41",
            "Linear_Actuators_6_42", "Linear_Actuators_8_44"
        ],
        rodEditorIds: ["Linear_Actuators_36"]
    },
    {
        name: "actuator_front",
        baseLocal: { x: -173.1002, y: 13.3808, z: -307.9656 },
        targetEditorId: "L_A_Hardware_Top_3_35",
        cylinderEditorIds: [
            "Linear_Actuators_3_39", "Linear_Actuators_4_40",
            "Linear_Actuators_7_43", "Linear_Actuators_9_45"
        ],
        rodEditorIds: ["Linear_Actuators_1_37"]
    }
];

const actuatorRigs = [];
const _rigA = new THREE.Vector3();
const _rigBase = new THREE.Vector3();
const _rigDir = new THREE.Vector3();
const _rigQ = new THREE.Quaternion();

function updateActuatorRigs() {
    if (actuatorRigs.length === 0 || !loadedModel) return;
    const liftOffset = currentLift - LIFT_MIN;
    actuatorRigs.forEach(rig => {
        _rigBase.set(rig.baseLocal.x, rig.baseLocal.y + liftOffset, rig.baseLocal.z);
        rig.targetObj.updateWorldMatrix(true, false);
        _rigA.copy(rig.targetLocalCenter);
        rig.targetObj.localToWorld(_rigA);
        loadedModel.worldToLocal(_rigA);
        _rigDir.copy(_rigA).sub(_rigBase);
        const curLen = _rigDir.length();
        if (curLen < 1e-6) return;
        _rigDir.normalize();
        _rigQ.setFromUnitVectors(rig.restDir, _rigDir);
        rig.cylWrapper.position.copy(_rigBase);
        rig.cylWrapper.quaternion.copy(_rigQ);
        rig.rodWrapper.quaternion.copy(_rigQ);
        rig.rodWrapper.position.copy(_rigBase).addScaledVector(_rigDir, curLen - rig.restLen);
    });
}

// Builds a rig from serialized data. Rest state (direction + length) is captured
// with every tilt zeroed, then the current angles are restored.
function buildActuatorRig({ name, baseLocal, targetEditorId, cylinderEditorIds, rodEditorIds }) {
    if (!loadedModel || !name || actuatorRigs.some(r => r.name === name)) return null;
    const targetEntry = partRegistry.get(targetEditorId);
    if (!targetEntry) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '": target part [' + targetEditorId + '] not found.');
        reportSceneWarning('rig-target-missing', `Actuator rig \"${name}\" cannot find its target part.`, [targetEditorId]);
        return null;
    }
    // A part can only live in one animation wrapper, so whichever rig builds first
    // wins it. Saved rigs build before baked ones, which means a stale rig left in
    // localStorage can silently strip parts out of a baked definition — the failure
    // then looks like "half the actuator doesn't move". Report it instead of hiding it.
    const skipped = [];
    const reclaimedFromTilt = [];
    const wrapperOwning = obj => {
        let cur = obj.parent;
        while (cur) {
            if (cur.userData && cur.userData.isTiltWrapper) return cur.name || 'another rig';
            cur = cur.parent;
        }
        return 'another rig';
    };
    // A part explicitly named as this rig's cylinder or rod belongs to the rig. Tilt
    // configs are restored first, so a part added to a tilt group by hand during setup
    // would otherwise be swallowed and silently dropped from the rig — which reads as
    // "only one bit of the actuator moves". Take it back instead.
    const reclaimFromTilt = obj => {
        const owner = tiltConfigs.find(c => c.wrapperGroup === obj.parent);
        if (!owner) return false; // nested deeper, or held by another rig — leave it
        detachPartsFromTilt(owner, [obj]);
        reclaimedFromTilt.push(obj.userData.editorId + ' from tilt "' + owner.name + '"');
        return true;
    };
    const resolveParts = ids => (ids || []).map(eid => {
        const obj = partRegistry.get(eid)?.obj;
        if (!obj) { skipped.push(eid + ' — no such part'); return null; }
        if (isInTiltWrapper(obj) && !reclaimFromTilt(obj)) {
            skipped.push(eid + ' — already held by ' + wrapperOwning(obj));
            return null;
        }
        if (telescopingObjects.some(t => t.obj === obj)) { skipped.push(eid + ' — telescoping column'); return null; }
        return obj;
    }).filter(Boolean);
    const cylParts = resolveParts(cylinderEditorIds);
    const rodParts = resolveParts(rodEditorIds);
    if (reclaimedFromTilt.length) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '" reclaimed ' + reclaimedFromTilt.length +
            ' part(s) a tilt group was holding:\n  ' + reclaimedFromTilt.join('\n  ') +
            '\n  They now follow the actuator instead of tilting with the desktop. The tilt ' +
            'group has been saved without them; re-add them there if that was intentional.');
        // Save here so the same conflict is not re-fought on the next load, and so
        // this works identically whether the rig came from BAKED_ACTUATOR_RIGS or the UI.
        persistTiltConfigs();
        rebuildTiltUI();
    }
    if (skipped.length) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '" could not take ' + skipped.length +
            ' part(s):\n  ' + skipped.join('\n  ') +
            '\n  If these are held by another rig, it is probably stale data saved in this browser. ' +
            'Use "Reset saved animation data" in the Actuator Rigs panel to drop local overrides ' +
            'and rebuild from the baked definitions.');
    }
    if (cylParts.length === 0 && rodParts.length === 0) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '": no cylinder or rod parts resolve.');
        return null;
    }

    // Capture rest geometry with all tilts at zero
    const savedDegs = tiltConfigs.map(c => c.currentDeg);
    tiltConfigs.forEach(c => {
        c.currentDeg = 0;
        c.wrapperGroup.rotation.set(0, 0, 0);
        c.wrapperGroup.updateMatrixWorld(true);
    });

    const liftOffset = currentLift - LIFT_MIN;
    const basePos = new THREE.Vector3(baseLocal.x, baseLocal.y + liftOffset, baseLocal.z);

    targetEntry.obj.geometry.computeBoundingBox();
    const targetLocalCenter = targetEntry.obj.geometry.boundingBox.getCenter(new THREE.Vector3());
    targetEntry.obj.updateWorldMatrix(true, false);
    const A = targetEntry.obj.localToWorld(targetLocalCenter.clone());
    loadedModel.updateMatrixWorld(true);
    loadedModel.worldToLocal(A);

    const rest = A.sub(basePos);
    const restLen = rest.length();
    if (restLen < 1e-6) {
        console.warn('[ErgoFlex] Actuator rig "' + name + '": base and target coincide.');
        tiltConfigs.forEach((c, i) => { c.currentDeg = savedDegs[i]; applyTiltConfig(c); });
        return null;
    }
    const restDir = rest.clone().normalize();

    const makeWrapper = suffix => {
        const w = new THREE.Group();
        w.name = 'rigWrapper_' + name + '_' + suffix;
        w.userData.isTiltWrapper = true; // lift/selection guards treat rig wrappers like tilt wrappers
        w.position.copy(basePos);
        loadedModel.add(w);
        w.updateMatrixWorld(true);
        return w;
    };
    const cylWrapper = makeWrapper('cyl');
    const rodWrapper = makeWrapper('rod');

    const adopt = (parts, wrapper) => parts.forEach(obj => {
        removeFromLift(obj);
        animOriginalParents.set(obj, obj.parent);
        obj.updateMatrixWorld(true);
        wrapper.attach(obj);
    });
    adopt(cylParts, cylWrapper);
    adopt(rodParts, rodWrapper);

    const rig = {
        name,
        baseLocal: { x: baseLocal.x, y: baseLocal.y, z: baseLocal.z },
        targetEditorId,
        targetObj: targetEntry.obj,
        targetLocalCenter,
        cylinderEditorIds: cylParts.map(o => o.userData.editorId).filter(Boolean),
        rodEditorIds: rodParts.map(o => o.userData.editorId).filter(Boolean),
        cylWrapper, rodWrapper, restDir, restLen
    };
    actuatorRigs.push(rig);

    // Restore tilt angles (this also triggers a rig update)
    tiltConfigs.forEach((c, i) => { c.currentDeg = savedDegs[i]; applyTiltConfig(c); });
    if (tiltConfigs.length === 0) updateActuatorRigs();
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    return rig;
}

function removeActuatorRig(idx, { recordUndo = true } = {}) {
    const rig = actuatorRigs[idx];
    if (!rig) return;
    if (recordUndo) {
        writeAutosave('before deleting actuator rig ' + rig.name);
        transaction({ type: 'rig-restore', kind: 'actuator', definition: serializeActuatorRigs()[idx] });
        deletedBakedRigs.actuator.add(rig.name);
    }
    // Reset wrappers to rest pose so parts land cleanly
    const liftOffset = currentLift - LIFT_MIN;
    [rig.cylWrapper, rig.rodWrapper].forEach(w => {
        w.quaternion.identity();
        w.position.set(rig.baseLocal.x, rig.baseLocal.y + liftOffset, rig.baseLocal.z);
        w.updateMatrixWorld(true);
        [...w.children].forEach(child => {
            const parent = animOriginalParents.get(child) || loadedModel;
            parent.attach(child);
            animOriginalParents.delete(child);
            rejoinLift(child);
        });
        if (w.parent) w.parent.remove(w);
    });
    actuatorRigs.splice(idx, 1);
    if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
    persistActuatorRigs();
    rebuildRigUI();
}

function serializeActuatorRigs() {
    return actuatorRigs.map(r => ({
        name: r.name,
        baseLocal: r.baseLocal,
        targetEditorId: r.targetEditorId,
        cylinderEditorIds: r.cylinderEditorIds,
        rodEditorIds: r.rodEditorIds
    }));
}

function persistActuatorRigs() {
    try { localStorage.setItem('ergoflexActuatorRigs', JSON.stringify(serializeActuatorRigs())); } catch (e) {}
}

function restoreActuatorRigs() {
    const isDeleted = name => deletedBakedRigs.actuator.has(name);
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('ergoflexActuatorRigs') || '[]'); } catch (e) {}
    // Local edits first, baked fills in the rest (same policy as tilt configs)
    const bakedRigNames = new Set(BAKED_ACTUATOR_RIGS.map(r => r.name));
    const shadowedRigs = saved.filter(r => r && bakedRigNames.has(r.name)).map(r => r.name);
    if (shadowedRigs.length) {
        console.warn('[ErgoFlex] Using this browser\'s saved copy of rig(s): ' + shadowedRigs.join(', ') +
            '. Edits to the baked definition in index.html are ignored until you click ' +
            '"Reset saved animation data" in the Actuator Rigs panel.');
    }
    [...saved, ...BAKED_ACTUATOR_RIGS].forEach(data => {
        if (!data || !data.name || isDeleted(data.name) || actuatorRigs.some(r => r.name === data.name)) return;
        buildActuatorRig(data);
    });
    if (actuatorRigs.length > 0) rebuildRigUI();
}

// --- Phase 5: Wheels & Glide Demo ---
// Wheel assemblies auto-rig from part naming (Wheel_F_L / F_R / R_L / R_R).
// The desk glides along a closed figure-eight; each mecanum wheel spins per
// its diagonal pairing: omega = (vx + latSign * vz) / radius. The figure-eight
// covers forward, lateral, and diagonal travel, so all four spin patterns show.
const WHEEL_GROUPS = [
    { prefix: 'Wheel_F_L', latSign: +1 },
    { prefix: 'Wheel_F_R', latSign: -1 },
    { prefix: 'Wheel_R_L', latSign: -1 },
    { prefix: 'Wheel_R_R', latSign: +1 }
];
const wheelRigs = [];
const glideBase = new THREE.Vector3();
const GLIDE_DURATION = 9;      // seconds for one loop
const GLIDE_AX = 0.55, GLIDE_AZ = 0.4; // path amplitude (world units)
let glideActive = false;
let glideT = 0;
const _glidePos = new THREE.Vector3();
const clock = new THREE.Clock();

function buildWheelRigs() {
    wheelRigs.length = 0;
    WHEEL_GROUPS.forEach(spec => {
        const parts = [];
        partRegistry.forEach(e => {
            if (e.name === spec.prefix || e.name.startsWith(spec.prefix + '_')) parts.push(e.obj);
        });
        if (parts.length === 0) return;

        // Hub = center of the largest mesh (the wheel disc), radius from its height
        let hubMesh = parts[0], hubArea = 0;
        parts.forEach(obj => {
            obj.geometry.computeBoundingBox();
            const bb = obj.geometry.boundingBox;
            const area = (bb.max.x - bb.min.x) * (bb.max.y - bb.min.y);
            if (area > hubArea) { hubArea = area; hubMesh = obj; }
        });
        hubMesh.updateWorldMatrix(true, false);
        const hubBox = new THREE.Box3().setFromObject(hubMesh);
        const hubWorld = hubBox.getCenter(new THREE.Vector3());
        const radius = Math.max(0.02, (hubBox.max.y - hubBox.min.y) / 2);

        const wrapper = new THREE.Group();
        wrapper.name = 'wheelRig_' + spec.prefix;
        wrapper.userData.isTiltWrapper = true; // same lift/selection guards as tilt wrappers
        loadedModel.updateMatrixWorld(true);
        wrapper.position.copy(loadedModel.worldToLocal(hubWorld.clone()));
        loadedModel.add(wrapper);
        wrapper.updateMatrixWorld(true);
        parts.forEach(obj => {
            removeFromLift(obj);
            obj.updateMatrixWorld(true);
            wrapper.attach(obj);
        });
        wheelRigs.push({ prefix: spec.prefix, latSign: spec.latSign, wrapper: wrapper, radius: radius, spin: 0, yawArm: null });
        // Measured now rather than on the first turn: the speed of a turn is
        // derived from these, and a half-populated set gives the wrong answer.
        wheelYawArm(wheelRigs[wheelRigs.length - 1]);
    });
    if (wheelRigs.length > 0) {
        console.log('[ErgoFlex] Wheel rigs: ' + wheelRigs.map(r => r.prefix + ' (r=' + r.radius.toFixed(3) + ')').join(', '));
    }
}

// Figure-eight with a smooth amplitude envelope: starts and ends at rest,
// at the home position, with zero velocity.
function glidePath(u, out) {
    const edge = 0.12;
    const ss = t => t * t * (3 - 2 * t);
    const env = ss(Math.min(u / edge, 1)) * ss(Math.min((1 - u) / edge, 1));
    out.set(
        GLIDE_AX * Math.sin(2 * Math.PI * u) * env,
        0,
        GLIDE_AZ * Math.sin(4 * Math.PI * u) * env
    );
    return out;
}

const glideOffset = new THREE.Vector3();
const glideTarget = new THREE.Vector3();
const glideInput = new THREE.Vector2();
const glideDemoOrigin = new THREE.Vector3();
const glideKeys = new Set();
let glidePointer = null;
let glideSpeed = GLIDE_SPEEDS.slow;
let glideUIPrev = '';
let glideFootprintCache = null;
function glideBounds() {
    const floor = liveAR?.active ? null : workspaceRoom?.floorBounds;
    if (!floor || !loadedModel) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
    // Translation cancels out of the footprint. Re-measure only when geometry
    // or posture changes; do not walk every mesh on each driving frame.
    const key = [loadedModel.uuid, editRevision, currentConfig.size, deskYaw, screenProgress, currentLift,
        ...tiltConfigs.map(c => c.currentDeg)].join(':');
    if (glideFootprintCache?.key !== key) {
        loadedModel.updateMatrixWorld(true);
        const box = new THREE.Box3();
        loadedModel.traverseVisible(obj => {
            if (!obj.isMesh || obj.material?.isShaderMaterial) return;
            if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
            box.union(obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld));
        });
        box.min.sub(glideOffset); box.max.sub(glideOffset);
        glideFootprintCache = { key, box };
    }
    const box = glideFootprintCache.box;
    const margin = workspaceRoom.root.scale.x * 25; // 25 mm clearance
    const bounds = {
        minX: floor.min.x + margin - box.min.x, maxX: floor.max.x - margin - box.max.x,
        minZ: floor.min.z + margin - box.min.z, maxZ: floor.max.z - margin - box.max.z
    };
    // If an edited model is wider than a room, center it on that axis.
    if (bounds.minX > bounds.maxX) bounds.minX = bounds.maxX = (bounds.minX + bounds.maxX) / 2;
    if (bounds.minZ > bounds.maxZ) bounds.minZ = bounds.maxZ = (bounds.minZ + bounds.maxZ) / 2;
    return bounds;
}
function clampGlidePosition(position) {
    const b = glideBounds();
    position.x = THREE.MathUtils.clamp(position.x, b.minX, b.maxX);
    position.z = THREE.MathUtils.clamp(position.z, b.minZ, b.maxZ);
    return position;
}
function deskCollisionBox() {
    if(!loadedModel||!workspaceRoom?.root)return null;
    glideBounds();
    return glideFootprintCache?.box.clone().translate(glideOffset) || new THREE.Box3().setFromObject(loadedModel);
}
function releaseGlideInput() {
    glideKeys.clear(); glideInput.set(0, 0); glidePointer = null;
    const knob = document.getElementById('glide-knob'); if (knob) knob.style.transform = 'translate(-50%, -50%)';
}
function manualGlideReady() {
    if (roomSafety.alert) { syncSafetyUI(); return false; }
    if (!loadedModel) { notifyUser('Wait for the desk to finish loading.'); return false; }
    if (transformControl?.object || isDraggingTransform) {
        notifyUser('Set Transform Tool to Off before moving the entire desk.'); return false;
    }
    if (roomGroove?.run) haltAllMotion();
    glideActive = false; controls.autoRotate = false; return true;
}
function setGlidePosition(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !manualGlideReady()) return false;
    releaseGlideInput();
    clampGlidePosition(glideTarget.set(x, 0, z));
    syncGlideUI(); return true;
}
function setupGlideControls() {
    const pad = document.getElementById('glide-pad');
    const updatePointer = e => {
        const rect = pad.getBoundingClientRect();
        glideInput.set((e.clientX - rect.left - rect.width / 2) / (rect.width * 0.35), (e.clientY - rect.top - rect.height / 2) / (rect.height * 0.35));
        if (glideInput.length() > 1) glideInput.normalize();
        document.getElementById('glide-knob').style.transform = `translate(calc(-50% + ${glideInput.x * 30}px), calc(-50% + ${glideInput.y * 30}px))`;
    };
    // The compass is two controls in one. A press inside the dish steers the
    // glide; a press on the outer ring turns the desk in place. The band is the
    // Give the turn ring a generous hit area. The old 0.62 boundary put the
    // inner half of its visible band into joystick mode.
    let ringPointer = null, ringStartAngle = 0;
    const padAngle = e => {
        const box = pad.getBoundingClientRect();
        return {
            deg: Math.atan2(e.clientY - (box.top + box.height / 2),
                            e.clientX - (box.left + box.width / 2)) * 180 / Math.PI,
            radius: Math.hypot(e.clientX - (box.left + box.width / 2),
                               e.clientY - (box.top + box.height / 2)) / (Math.min(box.width, box.height) / 2)
        };
    };
    const endRing = () => {
        if (ringPointer === null) return;
        ringPointer = null;
        setYawCommand(0);
        applyRingAngle(0);   // springs back, as it does on the phone
        delete pad.dataset.turning;
    };

    pad.onpointerdown = e => {
        if (e.button !== 0 || !manualGlideReady()) return;
        e.preventDefault(); pad.focus();
        const { deg, radius } = padAngle(e);
        if (radius >= 0.5) {
            ringPointer = e.pointerId;
            ringStartAngle = deg;
            pad.dataset.turning = 'true';
            try { pad.setPointerCapture(e.pointerId); } catch {}
            return;
        }
        glideTarget.copy(glideOffset); glidePointer = e.pointerId;
        try { pad.setPointerCapture(e.pointerId); } catch {}
        updatePointer(e);
    };
    pad.onpointermove = e => {
        if (ringPointer === e.pointerId) {
            // Relative to where the twist started, wrapped so crossing the
            // -180/180 seam does not read as a full turn the other way.
            let delta = padAngle(e).deg - ringStartAngle;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            applyRingAngle(delta);
            setYawCommand(delta > 3 ? -1 : delta < -3 ? 1 : 0);
            return;
        }
        if (glidePointer === e.pointerId) updatePointer(e);
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
        pad.addEventListener(type, e => { endRing(); releaseGlideInput(e); }));
    pad.onkeydown = e => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault(); if (!manualGlideReady()) return;
        glideTarget.copy(glideOffset); glideKeys.add(e.key);
        glideInput.set(Number(glideKeys.has('ArrowRight')) - Number(glideKeys.has('ArrowLeft')), Number(glideKeys.has('ArrowDown')) - Number(glideKeys.has('ArrowUp')));
        if (glideInput.length() > 1) glideInput.normalize();
    };
    pad.onkeyup = e => {
        glideKeys.delete(e.key);
        glideInput.set(Number(glideKeys.has('ArrowRight')) - Number(glideKeys.has('ArrowLeft')), Number(glideKeys.has('ArrowDown')) - Number(glideKeys.has('ArrowUp')));
        if (glideInput.length() > 1) glideInput.normalize();
    };
    pad.onblur = releaseGlideInput;
    window.addEventListener('blur', () => { releaseGlideInput(); glideActive = false; glideTarget.copy(glideOffset); syncGlideUI(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseGlideInput(); glideActive = false; glideTarget.copy(glideOffset); } });
    document.getElementById('glide-speed').onchange = e => glideSpeed = Number(e.target.value) || GLIDE_SPEEDS.slow;
    document.getElementById('glide-home').onclick = () => setGlidePosition(0, 0);
    document.querySelectorAll('[data-turn-command]').forEach(button => {
        const direction = Number(button.dataset.turnCommand);
        const stop = () => setYawCommand(0);
        button.onpointerdown = e => {
            if (!manualGlideReady()) return;
            e.preventDefault();
            try { button.setPointerCapture(e.pointerId); } catch {}
            setYawCommand(direction);
        };
        button.onpointerup = stop;
        button.onpointercancel = stop;
        button.onlostpointercapture = stop;
        button.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (manualGlideReady()) setYawCommand(direction); } };
        button.onkeyup = stop;
    });
    document.getElementById('glide-demo').onclick = () => {
        if (glideActive) { glideActive = false; glideTarget.copy(glideOffset); syncGlideUI(); }
        else startGlide();
    };
}
// Lift and tilt speeds, in real units per second rather than per-frame
// fractions. 'auto' is the app's default: the speed the desk picks for itself.
let liftSpeed = 'auto';
let tiltSpeed = 'auto';
let tiltTarget = null;
// The app's Height and Tilt sliders are rate controls, not position sliders:
// centred at zero, a dead zone around it, and they spring back the moment you
// let go (centered_control_slider.dart). Holding the thumb off centre drives the
// desk; releasing stops it where it is. -1..1, zero being centred.
let liftJog = 0;
let tiltJog = 0;
const JOG_DEADZONE = 0.08;
const LIFT_SPEEDS = { auto: 2.6, slow: 1.3, medium: 2.6, fast: 5.2 };
function liftUnitsPerSecond() { return LIFT_SPEEDS[liftSpeed] ?? LIFT_SPEEDS.auto; }
function tiltDegreesPerSecond() { return TILT_SPEEDS[tiltSpeed] ?? TILT_SPEEDS.auto; }

// The desktop tilt, by name. Never tiltConfigs[0]: restoreTiltConfigs loads saved
// rigs before the baked one, so index 0 is whatever happened to load first and
// changes between sessions.
// Rotating the desk in place. The app's outer ring is a momentary jog, not a
// position dial: twist past a threshold and the desk turns for as long as you
// hold it, release and it stops and the ring springs back to zero
// (movement_and_rotation_joystick.dart:361-383, 588-598). Nothing wrote the
// model's yaw before this, so the movement itself is new.
// The desk turns about its wheel centre, which is the part named Base_Panels_3,
// not about the model's own origin. Setting rotation.y alone swings the whole
// desk around a point somewhere off in the assembly, so it orbits instead of
// turning on the spot.
const YAW_PIVOT_PART = 'Base_Panels_3';
let yawPivotLocal = null;   // the pivot in the model's local frame, measured once
function yawPivotOffset() {
    if (yawPivotLocal) return yawPivotLocal;
    if (!loadedModel) return null;
    let found = null;
    loadedModel.traverse(child => { if (!found && child.isMesh && child.name === YAW_PIVOT_PART) found = child; });
    if (!found) {
        reportSceneWarning('yaw-pivot',
            `Rotation pivot part "${YAW_PIVOT_PART}" is not in this model, so the desk turns about the model origin instead of its wheel centre.`);
        yawPivotLocal = new THREE.Vector3();
        return yawPivotLocal;
    }
    const centre = new THREE.Box3().setFromObject(found).getCenter(new THREE.Vector3());
    // Local to the model, so it survives the glide moving the model around.
    yawPivotLocal = loadedModel.worldToLocal(centre);
    yawPivotLocal.y = 0;    // turning is about the vertical axis through that point
    return yawPivotLocal;
}

// Turning on the spot still rolls the wheels, and mecanum wheels roll
// differently depending where they sit: each contact point travels tangentially
// about the pivot, so the near and far sides run opposite ways. The existing
// spin model already projects a displacement onto the roller axis
// (spin -= (dx + latSign * dz) / radius), so this only has to supply the right
// displacement - the rotational one - rather than invent a second model.
//
// The arm is measured in the desk's own frame, so it does not change as the desk
// turns, and is worked out once per wheel.
function wheelYawArm(rig) {
    if (rig.yawArm) return rig.yawArm;
    const pivot = yawPivotOffset();
    if (!pivot || !rig.wrapper) return null;
    const world = rig.wrapper.getWorldPosition(new THREE.Vector3());
    const local = loadedModel.worldToLocal(world.clone());
    const scale = loadedModel.scale.x;
    const rx = (local.x - pivot.x) * scale, rz = (local.z - pivot.z) * scale;
    // d/dtheta of rotating (rx, rz) about Y.
    rig.yawArm = { ax: rz, az: -rx };
    return rig.yawArm;
}

function spinWheelsForYaw(dTheta) {
    if (!dTheta) return;
    wheelRigs.forEach(rig => {
        const arm = wheelYawArm(rig);
        if (!arm || !rig.radius) return;
        rig.spin -= (arm.ax + rig.latSign * arm.az) * dTheta / rig.radius;
        rig.wrapper.rotation.z = rig.spin;
    });
}

// Position and yaw are one transform: rotating about a pivot that is not the
// origin means the position has to absorb the difference, or the pivot slides.
function applyDeskTransform() {
    if (!loadedModel) return;
    const pivot = yawPivotOffset();
    const scale = loadedModel.scale.x;
    const rest = pivot ? pivot.clone().multiplyScalar(scale) : new THREE.Vector3();
    const turned = rest.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), deskYaw);
    loadedModel.rotation.y = deskYaw;
    loadedModel.position.x = glideBase.x + glideOffset.x + rest.x - turned.x;
    loadedModel.position.z = glideBase.z + glideOffset.z + rest.z - turned.z;
}

let deskYaw = 0;          // radians actually applied to the model
let yawCommand = 0;       // -1 left, 0 stop, +1 right
let ringAngle = 0;        // degrees the ring is twisted, for the visual only
// Derived from the glide speed rather than tabled separately, so the wheels turn
// at the same rate whichever way the desk is moving. glideSpeed is world units
// per second of travel; a wheel sitting `arm` from the pivot covers arm * omega
// per second while turning, so matching the two means omega = glideSpeed / arm.
// A separate table of angular speeds could only coincide with that by accident.
// What actually drives a wheel's spin is the mecanum projection
// (dx + latSign * dz), not the wheel's distance from the pivot - the roller
// angle means those differ by a large factor. Matching on distance left the
// wheels turning about eight times faster than the same speed setting produces
// while gliding.
function meanYawProjection() {
    let sum = 0, count = 0;
    wheelRigs.forEach(rig => {
        const arm = wheelYawArm(rig);
        if (!arm) return;
        const projection = Math.abs(arm.ax + rig.latSign * arm.az);
        if (projection > 1e-6) { sum += projection; count++; }
    });
    return count ? sum / count : 0;
}
function meanWheelRadius() {
    const radii = wheelRigs.map(rig => rig.radius).filter(r => r > 1e-6);
    return radii.length ? radii.reduce((a, b) => a + b, 0) / radii.length : 0.074;
}

// Gliding spins a wheel at glideSpeed / radius. Turning spins it at
// projection * omega / radius. Setting those equal gives omega = glideSpeed /
// projection, so the same speed word means the same wheel speed either way.
//
// The projection has to be measured before it is used. Reading it lazily meant
// the first frames fell back to a guess while the spin already used the real
// arms, and the two disagreed by more than an order of magnitude.
function yawRadiansPerSecond() {
    const projection = meanYawProjection();
    if (!projection) return glideSpeed / Math.max(0.02, meanWheelRadius() * 4);
    return glideSpeed / projection;
}
function setYawCommand(direction) {
    yawCommand = roomSafety.alert ? 0 : direction;
    const status = document.getElementById('glide-status');
    if (status) status.textContent = direction ? (direction > 0 ? 'Turning right' : 'Turning left') : 'Ready to move';
}
function applyRingAngle(deg) {
    ringAngle = deg;
    const ring = document.querySelector('#glide-pad .compass-ring');
    if (ring) ring.style.transform = `rotate(${deg}deg)`;
}

function primaryTiltConfig() {
    return tiltConfigs.find(c => c.name === 'tilting') || tiltConfigs[0] || null;
}

// Re-resolves the slider and re-attaches its handler. The element is rebuilt
// with the panel, so caching it once at startup left both this listener and
// showHeight() writing to a detached input - the slider did nothing and the
// readout silently stopped tracking.
// Both tracks behave the same way, so the spring-back lives in one place.
function wireJogSlider(slider, onJog, onSettle) {
    if (!slider) return;
    const read = () => {
        // Normalise against the track's own half-span, not against `max` alone.
        // `max` alone was only ever right for a symmetric range, and read as a
        // string it defeats a `|| 1` fallback: "0" is truthy, so a max of zero
        // divided rather than fell back - NaN at rest, -Infinity on any pull.
        const span = Math.max(Math.abs(Number(slider.max) || 0), Math.abs(Number(slider.min) || 0)) || 1;
        const raw = THREE.MathUtils.clamp(Number(slider.value) / span, -1, 1);
        onJog(Math.abs(raw) < JOG_DEADZONE ? 0 : raw);
        onSettle?.();
    };
    const release = () => { slider.value = 0; onJog(0); onSettle?.(); };
    slider.addEventListener('input', read);
    // Every way of letting go: pointer, touch, keyboard, and losing focus while
    // still held - any of which would otherwise leave the desk driving itself.
    ['pointerup', 'pointercancel', 'lostpointercapture', 'mouseup', 'touchend', 'touchcancel', 'blur', 'keyup']
        .forEach(type => slider.addEventListener(type, release));
}

function wireHeightSlider() {
    deskHeightSlider = document.getElementById('desk-height-slider');
    wireJogSlider(deskHeightSlider, value => {
        if (value) {
            manualLiftOverride = false;
            isStanding = false;
            if (toggleHeightBtn) {
                toggleHeightBtn.style.color = '#374151';
                toggleHeightBtn.style.borderColor = '#e5e7eb';
            }
        }
        liftJog = value;
    });
}

function showHeight(inches) {
    // The slider is a jog that rests at zero, so it does not track the height.
    const readout = document.getElementById('desk-height-display');
    if (readout && document.activeElement !== readout) {
        if ('value' in readout) readout.value = inches.toFixed(2);
        else readout.innerText = inches.toFixed(2) + '"';
    }
}

function syncTiltUI() {
    // The arc is a jog that rests at zero, so it does not track the tilt - the
    // same rule showHeight() follows. Re-authoring its range from the rig is
    // what broke it: the old rig ran -70..0, so `max` became zero and the
    // normaliser divided by it. Only the readout follows the angle.
    const config = primaryTiltConfig();
    const readout = document.getElementById('tilt-value');
    if (!config) return;
    if (readout && document.activeElement !== readout) readout.value = config.currentDeg.toFixed(2);
    positionArcThumb();
}

// Emergency stop: hold everything exactly where it is. stopGlide() is not this -
// it sends the desk back to its home position, which is the opposite of what a
// stop button must do.
function haltAllMotion() {
    ledMotion.cancel(loadedModel ? ledPose() : null);ledAutoLift = ledAutoTilt = false;ledSounds.stop();
    roomGroove?.cancel();
    glideActive = false;
    releaseGlideInput();
    glideTarget.copy(glideOffset);
    targetLift = currentLift;
    manualLiftOverride = false;
    tiltTarget = null;
    setYawCommand(0);
    applyRingAngle(0);
    liftJog = tiltJog = 0;
    // Zeroing the jogs is not enough: the tracks are what the eye reads, and a
    // thumb left off centre says the desk is still being driven.
    for (const id of ['desk-height-slider', 'tilt-slider']) {
        const track = document.getElementById(id);
        if (track) track.value = 0;
    }
    positionArcThumb();
    const status = document.getElementById('glide-status');
    if (status) status.textContent = 'Stopped';
    updateLedEffectFrame();
}

// ── The motion remote ────────────────────────────────────────────────────────
//
// A port of the ErgoFlex Desk app's motion surface: Glide, Height, Tilt, their
// speeds and preset banks, Ergo Forms, and a stop. Geometry and colour come from
// the Flutter source rather than from a screenshot - see app-remote.css.
//
// The phone stacks these vertically because it is a phone. Transcribing that
// here would make the panel taller, which is the opposite of what it is for, so
// the same blocks are laid out wide and fall back to the phone's order only when
// the viewer is genuinely narrow.

const SPEED_WORDS = [['auto', 'Auto'], ['slow', 'Slow'], ['medium', 'Medium'], ['fast', 'Fast']];

// Versioned and validated. A key written by a future build, hand-edited, or
// truncated must not take the panel down with it.
function readStore(key, version, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || parsed.v !== version) return fallback;
        return parsed;
    } catch { return fallback; }
}
// Reported, not swallowed. A quota or private-mode failure here means a preset
// the user thought they saved is gone on reload, and the existing save paths in
// this app already say so rather than claiming a save that did not happen. Once
// per session, because a full quota fails on every write.
let storageWarned = false;
function writeStore(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        if (!storageWarned) {
            storageWarned = true;
            notifyUser('Browser storage is unavailable, so presets will not survive a reload.');
        }
        return false;
    }
}

const LIFT_PRESET_KEY = 'ergoflex.liftPresetsV1';
const TILT_PRESET_KEY = 'ergoflex.tiltPresetsV1';
const ERGO_FORMS_KEY  = 'ergoflex.ergoFormsV2';
const DOCK_POS_KEY    = 'ergoflex.dockPosV1';

const numberOrNull = (value, lo, hi) =>
    (typeof value === 'number' && isFinite(value) && value >= lo && value <= hi) ? value : null;

function loadLiftPresets() {
    const stored = readStore(LIFT_PRESET_KEY, 1, null);
    const slots = Array.isArray(stored?.slots) ? stored.slots : [];
    const defaults = [28, 42.5, 52];
    return defaults.map((value, i) => numberOrNull(slots[i], HEIGHT_MIN, HEIGHT_MAX) ?? value);
}
function loadTiltPresets() {
    const stored = readStore(TILT_PRESET_KEY, 1, null);
    const slots = Array.isArray(stored?.slots) ? stored.slots : [];
    const defaults = [-5, 39, 65];
    return defaults.map((value, i) => numberOrNull(slots[i], TILT_MIN, TILT_MAX) ?? value);
}
function loadErgoForms() {
    const fallback = [
        { name: 'Sitting', lift: 28, tilt: 0 },
        { name: 'Standing', lift: 43.5, tilt: -5 },
        { name: 'Easel', lift: 52, tilt: 65 }
    ];
    const stored = readStore(ERGO_FORMS_KEY, 2, null);
    if (!Array.isArray(stored?.forms) || stored.forms.length !== 3) return fallback;
    return stored.forms.map((form, i) => {
        // Upgrade untouched defaults; retain users' renamed or custom poses.
        const previousDefault = i === 0 && form?.name === 'Sitting' && form?.lift === 28 && [0, -4].includes(form?.tilt)
            || i === 1 && form?.name === 'Standing' && form?.lift === 48 && form?.tilt === 0;
        if (previousDefault) return { ...fallback[i] };
        return {
            name: typeof form?.name === 'string' && form.name.trim() ? form.name.slice(0, 24) : fallback[i].name,
            lift: numberOrNull(form?.lift, HEIGHT_MIN, HEIGHT_MAX),
            tilt: numberOrNull(form?.tilt, TILT_MIN, TILT_MAX)
        };
    });
}

let liftPresets = [null, null, null];
let tiltPresets = [null, null, null];
let ergoForms = [];

// The compass, drawn to the app's numbers: 8 capsule ticks at R*0.915 spanning
// 19 degrees with round caps, an inner dish, and an eight-point star.
function compassSvg() {
    const R = 66, C = 66;
    const at = (r, a) => [C + r * Math.cos(a), C - r * Math.sin(a)];
    const tickR = R * 0.915, half = 9.5 * Math.PI / 180;
    let ticks = '';
    for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        const [x1, y1] = at(tickR*.89, a), [x2, y2] = at(tickR*.99, a);
        ticks += `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}" fill="none" class="dial-tick" stroke-width="2.5" stroke-linecap="round"/>`;
    }
    const Rin = 40, base = Rin * 0.40, len = Rin * 0.26, wide = Rin * 0.12;
    let star = '';
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const dx = Math.cos(a), dy = -Math.sin(a);
        const tip = [C + dx * (base + len), C + dy * (base + len)];
        const p1 = [C + dx * base - dy * wide, C + dy * base + dx * wide];
        const p2 = [C + dx * base + dy * wide, C + dy * base - dx * wide];
        star += `<polygon points="${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}" class="dial-star"/>`;
    }
    return `<svg viewBox="0 0 132 132" aria-hidden="true" focusable="false">
      <defs><radialGradient id="glide-dish" cx="50%" cy="50%" r="50%">
        <stop class="dish-edge" offset="0"/><stop class="dish-mid" offset=".55"/><stop class="dish-edge" offset="1"/>
      </radialGradient></defs>
      <circle class="dial-plate" cx="66" cy="66" r="64"/>
      <circle class="dial-groove" cx="66" cy="66" r="${(R * 0.82).toFixed(1)}" fill="none" stroke-width="${(R * 0.055).toFixed(1)}"/>
      <circle class="dial-hair" cx="66" cy="66" r="${(R * 0.745).toFixed(1)}" fill="none" stroke-width="${(R * 0.008).toFixed(2)}"/>
      <g class="compass-ring" style="transform-origin:66px 66px">${ticks}</g>
      <circle cx="66" cy="66" r="${Rin}" fill="url(#glide-dish)"/>
      <circle class="dial-rim" cx="66" cy="66" r="${Rin - 1}" fill="none" stroke-width="1.6"/>
      <g class="compass-arrows" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M59 38l7-7 7 7M59 94l7 7 7-7M38 59l-7 7 7 7M94 59l7 7-7 7"/></g>
    </svg>`;
}

// The tilt track is a crescent opening to the LEFT: 120 degrees centred on the
// horizontal, so it bulges right the way it does on the phone. Drawing it as a
// top arc was a misreading of the portrait screenshot.
const ARC = { cx: 26, cy: 95, r: 68, from: 60, to: -60, vw: 120, vh: 190 };
function arcPoint(deg) {
    return [ARC.cx + ARC.r * Math.cos(deg * Math.PI / 180),
            ARC.cy - ARC.r * Math.sin(deg * Math.PI / 180)];
}
function arcSvg() {
    const [x1, y1] = arcPoint(ARC.from), [x2, y2] = arcPoint(ARC.to);
    // sweep 1: from the upper end, round the right, down to the lower one.
    const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} A${ARC.r} ${ARC.r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    const [mx, my] = arcPoint(0);
    const arrow = (deg, flip) => {
        const [x, y] = arcPoint(deg);
        return `<polygon points="${x - 5},${y - flip * 3} ${x + 5},${y - flip * 3} ${x},${y + flip * 5}"
                 fill="#2F55D4" fill-opacity=".75"/>`;
    };
    return `<svg viewBox="0 0 ${ARC.vw} ${ARC.vh}" aria-hidden="true" focusable="false">
      <path class="arc-rim" d="${d}" stroke-width="35.2"/>
      <path class="arc-face" d="${d}" stroke-width="32"/>
      ${arrow(44, 1)}${arrow(24, 1)}${arrow(-24, -1)}${arrow(-44, -1)}
      <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="3.5" fill="#2F55D4" fill-opacity=".55"/>
    </svg>`;
}

function positionArcThumb() {
    const box = document.querySelector('.remote-arc');
    const slider = document.getElementById('tilt-slider');
    const thumb = box?.querySelector('.remote-sphere');
    if (!box || !slider || !thumb) return;
    // Centre-relative, against the track's own half-span - the same span the
    // jog normaliser uses, so the sphere and the desk can never disagree. At
    // rest the value is 0 and t is 0.5, which is the middle of the crescent.
    const span = Math.max(Math.abs(Number(slider.max) || 0), Math.abs(Number(slider.min) || 0)) || 1;
    const t = THREE.MathUtils.clamp(0.5 + (Number(slider.value) / span) / 2, 0, 1);
    // t = 0 at the bottom of the crescent. The top moves the desktop's
    // user-facing edge upward; the motion rig uses the opposite angle sign.
    const deg = ARC.to + (ARC.from - ARC.to) * t;
    const [x, y] = arcPoint(deg);
    thumb.style.left = (x / ARC.vw * 100) + '%';
    thumb.style.top = (y / ARC.vh * 100) + '%';
}

// The arc is a real angular control, not a rotated linear track.
//
// Ported from arc_control_slider.dart: the finger is projected onto the arc by
// angle, the value runs +-155 with a +-10 dead zone, and letting go springs
// back to centre over 150ms. Everything it produces is written to the hidden
// range input and announced as an `input` event, so the dead zone, the jog
// integration and the thumb all stay on the single wireJogSlider path - and
// so keyboard, assistive technology and the tests keep working unchanged.
const ARC_RANGE = 155;                       // _minValue / _maxValue
const ARC_START = -Math.PI / 3;              // _startAngle, upper-right
const ARC_SWEEP = (2 * Math.PI) / 3;         // _sweepAngle, 120 degrees CW
const ARC_SPRING_MS = 150;                   // _springController

// Wrap into [ref-PI, ref+PI) so atan2's discontinuity at +-PI can never fall
// inside the arc's own range and jump the value as the finger crosses it.
function normaliseArcAngle(angle, ref) {
    let d = angle - ref;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return ref + d;
}

function wireArcControl(box, slider) {
    if (!box || !slider) return;
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
    let spring = null;

    // The arc is drawn in viewBox units and laid out in CSS pixels, so the
    // centre and radius have to come from the live box, not from ARC directly.
    const project = event => {
        const rect = box.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const cx = rect.left + (ARC.cx / ARC.vw) * rect.width;
        const cy = rect.top + (ARC.cy / ARC.vh) * rect.height;
        const mid = ARC_START + ARC_SWEEP / 2;
        const angle = normaliseArcAngle(Math.atan2(event.clientY - cy, event.clientX - cx), mid);
        const t = THREE.MathUtils.clamp((angle - ARC_START) / ARC_SWEEP, 0, 1);
        // t = 0 is the top of the sweep and yields +155 on the control track.
        return ARC_RANGE - t * 2 * ARC_RANGE;
    };

    const emit = value => {
        slider.value = String(Math.round(value));
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const springBack = () => {
        const from = Number(slider.value) || 0;
        if (spring) cancelAnimationFrame(spring);
        if (!from) { emit(0); return; }
        const t0 = performance.now();
        const step = now => {
            const k = Math.min(1, (now - t0) / ARC_SPRING_MS);
            emit(from * (1 - easeOutCubic(k)));
            spring = k < 1 ? requestAnimationFrame(step) : null;
        };
        spring = requestAnimationFrame(step);
    };

    let holding = false;
    box.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const value = project(event);
        if (value === null) return;
        if (spring) { cancelAnimationFrame(spring); spring = null; }
        holding = true;
        try { box.setPointerCapture(event.pointerId); } catch {}
        event.preventDefault();
        emit(value);
    });
    box.addEventListener('pointermove', event => {
        if (!holding) return;
        const value = project(event);
        if (value !== null) emit(value);
    });
    const letGo = event => {
        if (!holding) return;
        holding = false;
        try { box.releasePointerCapture(event.pointerId); } catch {}
        springBack();
    };
    box.addEventListener('pointerup', letGo);
    box.addEventListener('pointercancel', letGo);
    box.addEventListener('lostpointercapture', letGo);
}

// The wellness blocks are drawn because the app has them and this is a replica
// of the app. They are disabled because they are routines, not desk controls -
// there is nothing behind them here, and a control that looks live and does
// nothing is worse than one that says it is unavailable.
// The hub's own glyphs, drawn rather than pulled from assets/app-icons: none of
// those are these shapes, and the bar reads as the app's only if they are.
const DESK_GLYPH = `<svg viewBox="0 0 32 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
  <path d="M3 9h26M5 13h22"/><path d="M8 4v5M24 4v5"/><path d="M7 13v7M25 13v7M3 20h26"/></g></svg>`;
const SEAT_GLYPH = `<svg viewBox="0 0 24 24" class="hub-seat" aria-hidden="true"><g fill="currentColor">
  <circle cx="12" cy="4" r="2"/><path d="M12 7c-1.2 0-2 .8-2 2v3l-4 2 .8 1.7L12 13l5.2 2.7.8-1.7-4-2V9c0-1.2-.8-2-2-2Z"/>
  <path d="M6 19c2-1.4 4-2 6-2s4 .6 6 2l-.9 1.6C15.4 19.6 13.8 19 12 19s-3.4.6-5.1 1.6Z"/></g></svg>`;
const SAVE_GLYPH = `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7">
  <path d="M4 4h12l4 4v12H4z"/><path d="M8 4v5h7V4"/></g><path d="M10 13.5v5l4.5-2.5z" fill="currentColor"/></svg>`;
const BULB_GLYPH = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor"
  d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Zm-3 18h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z"/></svg>`;

function hubTile(file, label) {
    return `<button class="hub-tile" type="button" disabled aria-label="${label}"
             title="${label} — a routines feature, not connected in the preview"><img src="./assets/app-icons/${file}" alt=""></button>`;
}

function speedSelect(id, label, value) {
    const options = SPEED_WORDS.map(([v, text]) =>
        `<option value="${v}"${v === value ? ' selected' : ''}>${text}</option>`).join('');
    return `<div class="remote-speed"><select id="${id}" aria-label="${label}">${options}</select></div>`;
}

function chipRow(kind) {
    return `<div class="remote-chips" data-preset-bank="${kind}">` +
        [1, 2, 3].map(n => `<button class="remote-chip" data-slot="${n - 1}" type="button"><span class="preset-number">${n}</span><span class="preset-value" aria-hidden="true"></span><span class="caret" aria-hidden="true">&#94;</span></button>`).join('') +
        `</div>`;
}

let ledCommandCenter=null;
function prepareLedCommandCenter(controls){
    if(!ledCommandCenter)ledCommandCenter=new LedCommandCenter(window.ErgoFlex,controls);
    return ledCommandCenter;
}
function buildMotionRemote() {
    const dock = document.getElementById('motion-dock');
    if (!dock) return;
    liftPresets = loadLiftPresets();
    tiltPresets = loadTiltPresets();
    ergoForms = loadErgoForms();

    dock.className = 'app-remote remote-v2';
    dock.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'remote-header';
    // Preview controls operate the scene. Voice and account actions remain hardware-only.
    const inert = (file, label) =>
        `<button class="remote-chrome" type="button" disabled aria-label="${label}"
                 title="${label} — hardware control, not connected in the preview"><img src="./assets/app-icons/${file}" alt=""></button>`;
    header.innerHTML = `<span class="remote-grip" aria-hidden="true"></span>
        <button class="remote-chrome remote-menu" type="button" disabled aria-label="Menu"
                title="Menu — not part of the preview"><span></span><span></span><span></span></button>
        <img class="remote-logo" src="./assets/app-icons/ergoflex-app-logo.svg" alt="ErgoFlex Desk">
        <span class="remote-status" role="img" aria-label="Preview — not connected to a desk"
              title="Preview only: this panel drives the 3D model, not a desk"></span>
        <span class="remote-spacer"></span>
        <span class="glide-actions">
          <span id="glide-status">Ready to move</span>
          <button type="button" data-turn-command="-1" aria-label="Hold to turn left">↶ Left</button>
          <button type="button" data-turn-command="1" aria-label="Hold to turn right">Right ↷</button>
          <button id="glide-demo" type="button" aria-pressed="false">Play demo</button>
          <button id="glide-home" type="button">Recenter</button>
        </span>
        ${inert('help.svg', 'Info')}
        ${inert('MicOn.svg', 'Voice')}
        <button id="remote-shield" class="remote-chrome" type="button" aria-label="Collision shield" aria-pressed="false" title="Shield: stop before contact"><img src="./assets/app-icons/pre_collision_on.svg" alt=""></button>
        <button id="remote-alert-sound" class="remote-safety-sound" type="button" aria-pressed="false" title="Enable movement sounds and collision alerts">♪ Sound alerts</button>
        <button id="remote-stop" type="button" title="Stop all movement" aria-label="Stop all movement"><img src="./assets/app-icons/e-stop.svg" alt=""></button>
        ${inert('quick_logout.svg', 'Sign out')}
        <button class="remote-chrome remote-theme" type="button" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true">
          <path class="moon" fill="currentColor" d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z"/>
          <g class="sun" fill="currentColor"><circle cx="12" cy="12" r="4.2"/>
            <path d="M11 2h2v3.2h-2zm0 16.8h2V22h-2zM2 11h3.2v2H2zm16.8 0H22v2h-3.2zM4.4 5.8 5.8 4.4 8 6.6 6.6 8zM16 17.4l1.4-1.4 2.2 2.2-1.4 1.4zM17.4 8 16 6.6l2.2-2.2 1.4 1.4zM6.6 16 8 17.4l-2.2 2.2-1.4-1.4z"/></g>
        </svg></button>
        <button id="motion-dock-toggle" class="motion-dock-toggle" type="button" aria-controls="motion-dock-content" title="Collapse the movement panel">▼</button>`;
    dock.append(header);

    const body = document.createElement('div');
    body.id = 'motion-dock-content';
    body.className = 'motion-dock-body';
    body.innerHTML = `<div class="remote-body">
      <div class="remote-grid">

        <div class="remote-half remote-half-left">
          <div class="remote-glide-row" data-motion-panel="glide">
            <h3 class="remote-heading">Glide</h3>
            <div id="glide-pad" class="remote-compass" tabindex="0" role="group"
                 aria-label="Glide joystick. Drag the inner half to move, twist the outer half to turn in place, or use arrow keys."
                 aria-describedby="glide-help">${compassSvg()}<span id="glide-knob" class="remote-sphere"></span></div>
            <div class="remote-speed">
              <select id="glide-speed" aria-label="Glide speed">
                ${Object.entries(GLIDE_SPEEDS).map(([name,speed])=>`<option value="${speed}"${name==='slow'?' selected':''}>${name[0].toUpperCase()+name.slice(1)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="remote-forms">
            <h3 class="remote-heading">Ergo Forms <span class="remote-info" role="img" aria-label="About this control"></span></h3>
            <div class="remote-forms-row"></div>
          </div>
        </div>

        <div class="remote-half remote-half-right">
          <div class="remote-col" data-motion-panel="lift">
            <h3 class="remote-heading">Height <span class="remote-info" role="img" aria-label="About this control"></span></h3>
            <label class="remote-readout"><span class="sr-only">Desk height in inches</span>
              <input id="desk-height-display" type="number" inputmode="decimal"
                     min="${HEIGHT_MIN}" max="${HEIGHT_MAX}" step="0.01" value="${HEIGHT_MIN.toFixed(2)}">
              <span class="unit">in</span>
              <svg class="pencil" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
            </label>
            <div class="remote-vslider">
              <div class="vs-arrows"><span class="up u1"></span><span class="up u2"></span><span class="down d1"></span><span class="down d2"></span></div>
              <input type="range" id="desk-height-slider" min="-100" max="100" step="1" value="0" aria-label="Raise or lower the desk. Hold away from centre to move; it returns to centre when released.">
            </div>
            ${speedSelect('lift-speed', 'Lift speed', 'medium')}
            ${chipRow('lift')}
          </div>
          <div class="remote-col" data-motion-panel="tilt">
            <h3 class="remote-heading">Tilt <span class="remote-info" role="img" aria-label="About this control"></span></h3>
            <label class="remote-readout"><span class="sr-only">Desktop tilt in degrees</span>
              <input id="tilt-value" type="number" inputmode="decimal" step="0.01" value="0.00">
              <span class="unit">&deg;</span>
              <svg class="pencil" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
            </label>
            <div class="remote-arc">${arcSvg()}
              <input type="range" id="tilt-slider" min="-155" max="155" step="1" value="0" aria-label="Tilt the desktop. Hold away from centre to move; it returns to centre when released.">
              <span class="remote-sphere"></span>
            </div>
            ${speedSelect('tilt-speed', 'Tilt speed', 'medium')}
            ${chipRow('tilt')}
          </div>
        </div>

      </div>
      <div class="remote-wellness-hub" role="group" aria-label="Wellness">
        <span class="hub-desk" role="img" aria-label="Your desk">${DESK_GLYPH}</span>
        <span class="hub-score">${SEAT_GLYPH}<span class="hub-score-text">Wellness Score</span>
          <span class="hub-ring" role="img" aria-label="Wellness score, preview value"><i>75</i></span></span>
        <span class="hub-rule" aria-hidden="true"></span>
        <span class="hub-timer" role="timer" aria-label="Routine timer, not running">0m 00s</span>
        <span class="hub-rule" aria-hidden="true"></span>
        <button class="hub-tile" type="button" disabled aria-label="Save routine"
                title="Save routine — a routines feature, not connected in the preview">${SAVE_GLYPH}</button>
        <span class="hub-rule" aria-hidden="true"></span>
        <button class="hub-led" type="button" aria-label="Desk LEDs. Tap to switch power; hold to open LED Command Center." aria-pressed="false" aria-expanded="false" aria-controls="led-command-center"
                title="Tap: LEDs on/off · Hold: LED Command Center">${BULB_GLYPH}</button>
        <button class="hub-screen" data-touchscreen-toggle type="button" aria-label="Extend touchscreen"
                aria-pressed="false" title="Slide and turn touchscreen">Screen</button>
        <span class="remote-info" role="img" aria-label="About the wellness bar"></span>
      </div>
      <p id="glide-help" class="remote-hint">Glide: down = front, up = back, left/right stay fixed. Twist the outer half or hold Left/Right to turn. Presets: tap to recall, hold to save, swipe up to see the value.</p>
    </div>`;
    // Keep the proven controls and their IDs, rearranged to the updated app.
    const grid=body.querySelector('.remote-grid');
    const lift=body.querySelector('[data-motion-panel="lift"]'),glide=body.querySelector('[data-motion-panel="glide"]'),tilt=body.querySelector('[data-motion-panel="tilt"]');
    const forms=body.querySelector('.remote-forms'),hub=body.querySelector('.remote-wellness-hub');
    grid.replaceChildren(lift,glide,tilt);
    for(const card of [lift,glide,tilt]){
        card.classList.add('remote-card');
        const heading=document.createElement('div');heading.className='remote-card-heading';
        heading.append(card.querySelector('.remote-heading'),card.querySelector('.remote-speed'));card.prepend(heading);
        if(card!==glide){const adjust=document.createElement('div');adjust.className='remote-adjust';
            adjust.append(card.querySelector('.remote-readout'),card.querySelector('.remote-vslider,.remote-arc'));heading.after(adjust);
        }
    }
    const footer=document.createElement('div');footer.className='remote-footer';footer.append(forms,hub);grid.after(footer);
    dock.append(body);
    // Eight grips, inside the border box: the shell clips its own overflow to
    // keep the header's radius, so a handle hanging off the edge is invisible.
    for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
        const grip = document.createElement('span');
        grip.className = 'remote-resize';
        grip.dataset.edge = edge;
        dock.append(grip);
    }

    applyRemoteTheme(loadRemoteTheme());
    renderErgoForms();
    renderPresetChips();
    wireRemote(dock, header);
    // The glide compass, demo and recenter buttons are part of this panel, so
    // they are re-wired here. Wiring them once at startup left them pointing at
    // elements a rebuild had already replaced.
    setupGlideControls();
    dock.querySelector('#remote-shield').onclick=()=>setCollisionGuard(!roomSafety.guard);
    dock.querySelector('#remote-alert-sound').onclick=()=>{ledSounds.setEnabled(!ledSounds.enabled);syncSafetyUI();};
    mountSafetyAlert();syncSafetyUI();
    const bulb=dock.querySelector('.hub-led');
    bindHold(bulb,()=>setLedsEnabled(!ledsEnabled),()=>prepareLedCommandCenter().open());
    // Assistive technology can activate a button without pointer events.
    bulb.addEventListener('click',event=>{if(event.detail===0)setLedsEnabled(!ledsEnabled);});
    bulb.addEventListener('contextmenu',event=>event.preventDefault());
    dock.querySelector('.hub-screen').onclick = () => setTouchscreenOpen(screenTarget < 0.5);
    setLedsEnabled(ledsEnabled);
    setTouchscreenOpen(screenTarget > 0.5);
    wireHeightSlider();
    syncTiltUI();
}

function renderErgoForms() {
    const row = document.querySelector('.remote-forms-row');
    if (!row) return;
    row.innerHTML = ergoForms.map((form, i) =>
        `<button class="remote-form" type="button" data-form="${i}" data-set="${form.lift !== null && form.tilt !== null}"
                 title="Tap to recall. Press and hold to save the current pose. Double-click to rename.">${form.name}</button>`).join('');
}

function renderPresetChips() {
    for (const [kind, bank] of [['lift', liftPresets], ['tilt', tiltPresets]]) {
        document.querySelectorAll(`[data-preset-bank="${kind}"] .remote-chip`).forEach(chip => {
            const value = bank[Number(chip.dataset.slot)];
            chip.dataset.saved = String(value !== null);
            chip.querySelector('.preset-value').textContent = value === null ? 'Empty'
                : String(Number(value.toFixed(1))) + (kind === 'lift' ? '″' : '°');
            chip.title = value === null
                ? 'Empty. Press and hold to save the current ' + (kind === 'lift' ? 'height' : 'tilt') + '.'
                : (kind === 'lift' ? value.toFixed(1) + '"' : value.toFixed(1) + '°') + ' — tap to recall, hold to overwrite, swipe up or press Arrow Up to reveal.';
            chip.setAttribute('aria-label', `${kind === 'lift' ? 'Height' : 'Tilt'} preset ${Number(chip.dataset.slot) + 1}: ${value === null ? 'empty' : chip.title}`);
        });
    }
}

// Tap recalls, press-and-hold saves - the app's gesture, and the reason the two
// banks are separate: lift and tilt are stored independently there.
function bindHold(el, onTap, onHold, onReveal = null) {
    let timer = null, held = false, moved = false, revealed = false;
    let pointer = null, startX = 0, startY = 0;
    const cancel = () => { clearTimeout(timer); timer = null; };
    el.addEventListener('pointerdown', e => {
        if (e.button !== 0 || pointer !== null) return;
        pointer = e.pointerId; startX = e.clientX; startY = e.clientY;
        held = moved = revealed = false;
        // Synthetic/accessibility pointer events may have no active capture.
        try { el.setPointerCapture(e.pointerId); } catch {}
        timer = setTimeout(() => { held = true; onHold(); }, 550);
    });
    el.addEventListener('pointermove', e => {
        if (e.pointerId !== pointer) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.hypot(dx, dy) > 8) { moved = true; cancel(); }
        if (onReveal && !held && !revealed && dy <= -12 && Math.abs(dy) > Math.abs(dx)) {
            revealed = true; onReveal();
        }
    });
    el.addEventListener('pointerup', e => {
        if (e.pointerId !== pointer) return;
        cancel(); pointer = null;
        if (!held && !moved) onTap();
    });
    const abandon = () => { cancel(); pointer = null; };
    el.addEventListener('pointercancel', abandon);
    el.addEventListener('lostpointercapture', abandon);
    el.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp' && onReveal) { e.preventDefault(); onReveal(); return; }
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        if (!e.repeat) { if (e.shiftKey) onHold(); else onTap(); }
    });
}

const presetRevealTimers = new WeakMap();
function revealPresetChip(chip) {
    clearTimeout(presetRevealTimers.get(chip));
    chip.dataset.revealed = 'true';
    presetRevealTimers.set(chip, setTimeout(() => { chip.dataset.revealed = 'false'; }, 2500));
}

function goToHeight(inches) {
    if (roomGroove?.run && !grooveSettingPose) haltAllMotion();
    if (!loadedModel) return;
    manualLiftOverride = false;
    const minimum = minimumHeightForTilt(primaryTiltConfig()?.currentDeg ?? 0, currentConfig.size);
    targetLift = heightToLift(THREE.MathUtils.clamp(inches, minimum, HEIGHT_MAX));
}
function goToTilt(deg) {
    if (roomGroove?.run && !grooveSettingPose) haltAllMotion();
    const config = primaryTiltConfig();
    if (!config) return;
    tiltTarget = THREE.MathUtils.clamp(deg, config.minDeg,
        Math.min(config.maxDeg, maximumTiltForHeight(liftToHeight(currentLift), currentConfig.size)));
}
function goToPose(height, deg) {
    if (roomGroove?.run && !grooveSettingPose) haltAllMotion();
    const config = primaryTiltConfig();
    if (!loadedModel || !config) return;
    const tilt = THREE.MathUtils.clamp(deg, config.minDeg, config.maxDeg);
    const safeHeight = Math.max(height, minimumHeightForTilt(tilt, currentConfig.size));
    manualLiftOverride = false;
    targetLift = heightToLift(THREE.MathUtils.clamp(safeHeight, HEIGHT_MIN, HEIGHT_MAX));
    tiltTarget = tilt;
}

// ── The panel as a device mockup ─────────────────────────────────────────────
//
// The remote is a replica of the ErgoFlex Desk app, so the honest way to show
// it at a given form factor is to give it that device's screen and let its own
// layout answer. Drag any corner; it snaps to a real device and says which.
//
// CSS pixels are the app's dp, so the Flutter figures transfer unchanged. The
// Fold 5 numbers are quoted from lib/utils/layout_breakpoints.dart, which
// measured its portrait weights on the cover screen and documents both panes.
const REMOTE_DEVICES = [
    { id: 'fold5-cover-p', name: 'Fold 5 cover',               w: 344, h: 882 },
    { id: 'fold5-cover-l', name: 'Fold 5 cover, landscape',    w: 882, h: 344 },
    { id: 'fold5-open-p',  name: 'Fold 5 unfolded',            w: 674, h: 810 },
    { id: 'fold5-open-l',  name: 'Fold 5 unfolded, landscape', w: 810, h: 674 },
    { id: 'iphone-p',      name: 'iPhone',                     w: 393, h: 852 },
    { id: 'iphone-l',      name: 'iPhone, landscape',          w: 852, h: 393 },
    // 1878 x 2670 hardware pixels at 430 ppi - a 7.6in panel - taken at Apple's
    // @3x scale. The folded cover screen has not been confirmed; until it is,
    // the iPhone entry above is the closest honest stand-in for it.
    { id: 'apple-fold-p',  name: 'Apple foldable',             w: 626, h: 890 },
    { id: 'apple-fold-l',  name: 'Apple foldable, landscape',  w: 890, h: 626 },
    // The unfolded device running the app in a split window - 1043 x 2176
    // hardware pixels at the inner screen's 2.6875. A real form factor the
    // app is used in, and the narrowest tall one it has to hold.
    { id: 'fold5-split-p', name: 'Fold 5 split view',          w: 388, h: 810 }
];
const DEVICE_SNAP_PX = 24;          // how close a drag has to land, per axis

// The bounds are the table's own extremes rather than numbers of their own.
// The panel is a replica of an app that runs on real screens, so a size no
// real screen has is a size the layout was never designed to hold - it does
// not degrade, it distorts. Adding a device widens the range automatically.
const REMOTE_MIN_W = Math.min(...REMOTE_DEVICES.map(d => d.w));
const REMOTE_MAX_W = Math.max(...REMOTE_DEVICES.map(d => d.w));
const REMOTE_MIN_H = Math.min(...REMOTE_DEVICES.map(d => d.h));
const REMOTE_MAX_H = Math.max(...REMOTE_DEVICES.map(d => d.h));
const DOCK_SIZE_KEY = 'ergoflex.dockSizeV1';
const REMOTE_THEME_KEY = 'ergoflex.remoteThemeV1';
const DOCK_PAD = 8;                 // the same inset clampDockPosition keeps

let remoteSize = null;              // { w, h } in device px, or null for CSS sizing
let remoteDevice = null;            // the matched REMOTE_DEVICES entry, or null
let remoteScale = 1;                // shrink-to-fit when the device is taller than the viewer

// The app ships a light theme and a dark one, so the replica carries both and
// the header switches between them. Dark is the default because it is what the
// app is shown in and what every reference screenshot is.
function loadRemoteTheme() {
    const stored = readStore(REMOTE_THEME_KEY, 1, null);
    return stored?.theme === 'light' ? 'light' : 'dark';
}

function dockThemeName() {
    return document.getElementById('motion-dock')?.dataset.theme || 'dark';
}

function applyRemoteTheme(theme) {
    const dock = document.getElementById('motion-dock');
    if (!dock) return;
    dock.dataset.theme = theme === 'light' ? 'light' : 'dark';
    const button = dock.querySelector('.remote-theme');
    if (button) {
        const dark = dock.dataset.theme === 'dark';
        button.setAttribute('aria-pressed', String(dark));
        button.title = dark ? 'Dark theme — switch to light' : 'Light theme — switch to dark';
        button.setAttribute('aria-label', button.title);
    }
}

function snapRemoteSize(w, h) {
    for (const device of REMOTE_DEVICES) {
        if (Math.abs(w - device.w) <= DEVICE_SNAP_PX && Math.abs(h - device.h) <= DEVICE_SNAP_PX)
            return { w: device.w, h: device.h, device };
    }
    return { w, h, device: null };
}

// What the panel settles on when the finger lifts. Magnetic snapping while
// dragging only catches a size you were already close to; this is what makes
// every RESTING size a real screen, so the panel cannot be left at an aspect
// no device has and no layout was drawn for.
function nearestRemoteDevice(w, h) {
    let best = REMOTE_DEVICES[0], bestDistance = Infinity;
    for (const device of REMOTE_DEVICES) {
        const distance = (w - device.w) ** 2 + (h - device.h) ** 2;
        if (distance < bestDistance) { best = device; bestDistance = distance; }
    }
    return best;
}

// Which of the app's four layouts this size is. These are the predicates from
// lib/utils/layout_breakpoints.dart, and they are in JS rather than in a
// container query because CSS cannot ask about `shortestSide`.
function remoteShapeFor(w, h) {
    if (w > h) {
        // Three landscape cases, because main_screen.dart branches three ways:
        // isTabletLandscape (six Ergo Form slots), isNarrowLandscape (a phone
        // on its side, which gets its own weights), and the ordinary one.
        if (Math.min(w, h) >= 600) return 'tablet-landscape';
        return h < 500 ? 'narrow-landscape' : 'landscape';
    }
    return w >= 600 ? 'wide-portrait' : 'narrow-portrait';
}

// A device bigger than the viewer is shown smaller, not made unreachable: a
// Fold 5 cover screen is 882px tall and almost no laptop viewport has that
// once the header and the toolbar are out. The panel keeps the device's
// LAYOUT size - so its breakpoints still answer as that device - and is drawn
// scaled. Every pointer delta is divided back out, so dragging still tracks.
function remoteFitScale(w, h) {
    const container = canvas?.parentElement;
    if (!container) return 1;
    const top = parseFloat(canvas.style.top) || 0;
    const availableW = container.clientWidth - DOCK_PAD * 2;
    const availableH = container.clientHeight - top - DOCK_PAD * 2;
    if (availableW <= 0 || availableH <= 0) return 1;
    return Math.min(1, availableW / w, availableH / h);
}

function applyRemoteSize(w, h, { announce = false } = {}) {
    const dock = document.getElementById('motion-dock');
    if (!dock) return;
    // Clamped here rather than only at the drag, so no caller - the test hook
    // and the restore path included - can hand the layout a size it cannot hold.
    const snapped = snapRemoteSize(
        Math.round(THREE.MathUtils.clamp(w, REMOTE_MIN_W, REMOTE_MAX_W)),
        Math.round(THREE.MathUtils.clamp(h, REMOTE_MIN_H, REMOTE_MAX_H)));
    const changed = snapped.device?.id !== remoteDevice?.id;
    remoteSize = { w: snapped.w, h: snapped.h };
    remoteDevice = snapped.device;
    remoteScale = remoteFitScale(snapped.w, snapped.h);

    dock.style.setProperty('--dock-w', snapped.w + 'px');
    dock.style.setProperty('--dock-h', snapped.h + 'px');
    dock.style.setProperty('--remote-unit', (Math.min(snapped.w, snapped.h) / 100) + 'px');
    dock.style.setProperty('--remote-scale', String(remoteScale));
    dock.dataset.shape = remoteShapeFor(snapped.w, snapped.h);
    dock.dataset.device = snapped.device?.id || '';
    dock.dataset.sized = 'true';

    if (announce && changed && snapped.device)
        notifyUser(`${snapped.device.name} — ${snapped.device.w} × ${snapped.device.h}`);
    clampDockPosition();
}

// Re-apply the current device at the current fit. Deliberately NOT a call to
// syncViewerSize(): nothing the panel does may change the canvas, which is the
// invariant the whole floating rebuild was for.
function refitRemote() {
    if (remoteSize) applyRemoteSize(remoteSize.w, remoteSize.h);
    else clampDockPosition();
}

function persistRemoteSize() {
    if (!remoteSize) return;
    writeStore(DOCK_SIZE_KEY, { v: 1, w: remoteSize.w, h: remoteSize.h, device: remoteDevice?.id || null });
}

function restoreDockSize() {
    const stored = readStore(DOCK_SIZE_KEY, 1, null);
    const w = numberOrNull(stored?.w, REMOTE_MIN_W, REMOTE_MAX_W);
    const h = numberOrNull(stored?.h, REMOTE_MIN_H, REMOTE_MAX_H);
    if (w === null || h === null) return;   // never resized, or unreadable: CSS sizes it
    applyRemoteSize(w, h);
}

// The panel positions itself absolutely the moment it is dragged OR resized.
// Resizing from a never-dragged panel used to have nothing to work against:
// the panel was still parked by `left: 50%` and a transform, so there were no
// left/top numbers for a west or north edge to move.
function anchorDock(dock) {
    if (dock.dataset.floating === 'true') return;
    const rect = dock.getBoundingClientRect();
    const container = canvas.parentElement.getBoundingClientRect();
    dock.dataset.floating = 'true';
    dock.style.bottom = 'auto';
    // The parked state is `left: 50%` plus a -50% translate. Left and top are
    // absolute from here on, so that translate has to go or the panel sits
    // half its own width to the left of where it is positioned.
    dock.style.transform = 'none';
    dock.style.left = (rect.left - container.left) + 'px';
    dock.style.top = (rect.top - container.top) + 'px';
}

// Keep the panel inside the canvas's usable rectangle, not merely the viewer:
// a position saved at one window size, in one layout, must not strand it.
function clampDockPosition() {
    const dock = document.getElementById('motion-dock');
    const container = canvas?.parentElement;
    if (!dock || !container || dock.dataset.floating !== 'true') return;
    const pad = DOCK_PAD;
    const top = parseFloat(canvas.style.top) || 0;
    // offsetWidth/Height are the LAYOUT box; a scaled-to-fit device draws
    // smaller than that, and clamping against the layout box would refuse
    // positions that are plainly on screen.
    const drawnW = dock.offsetWidth * remoteScale;
    const drawnH = dock.offsetHeight * remoteScale;
    const maxX = Math.max(pad, container.clientWidth - drawnW - pad);
    const maxY = Math.max(top + pad, container.clientHeight - drawnH - pad);
    const x = THREE.MathUtils.clamp(parseFloat(dock.style.left) || 0, pad, maxX);
    const y = THREE.MathUtils.clamp(parseFloat(dock.style.top) || 0, top + pad, maxY);
    dock.style.left = x + 'px';
    dock.style.top = y + 'px';
    return { x, y };
}

// Where the panel lives depends on the shell, not on the mode.
//
// Both shells now give the viewer the whole window, so there is no longer any
// in-flow space below it to drop into: the panel floats inside the viewer and
// can be dragged and resized in the store exactly as in the studio. What keeps
// it off the product on the storefront is that it ARRIVES COLLAPSED - a bar,
// not a slab - which is handled at startup rather than by docking it.
//
// The docked branch below is still reached: the <=760px stacked fallback drops
// the shell entirely, and there the viewer is a normal block again.
function placeRemoteForMode() {
    const dock = document.getElementById('motion-dock');
    const viewer = document.getElementById('viewer-shell');
    if (!dock || !viewer) return;
    if (EVENT_DEMO) {
        const slot = document.getElementById('demo-remote');
        if (slot && dock.parentElement !== slot) slot.append(dock);
        dock.dataset.mode = 'docked';
        return;
    }
    const floating = document.body.classList.contains('shell-layout')
        && window.matchMedia('(min-width: 761px)').matches;
    dock.dataset.mode = floating ? 'floating' : 'docked';

    if (floating) {
        const stage = canvas?.parentElement;
        if (stage && dock.parentElement !== stage) stage.append(dock);
        restoreDockSize();
        placeDockFromStorage();
        return;
    }
    // Storefront: a sibling after the viewer, in flow. Clear anything the drag
    // left behind or it would still be positioned against the old parent.
    if (dock.parentElement !== viewer.parentElement) viewer.after(dock);
    dock.dataset.floating = '';
    dock.style.left = dock.style.top = dock.style.bottom = dock.style.transform = '';
    // A size the user dragged out in the shell is a device mockup size, which
    // means nothing to the stacked fallback's full-width bar.
    dock.style.width = dock.style.height = '';
    ['--dock-w', '--dock-h', '--remote-unit', '--remote-scale'].forEach(v => dock.style.removeProperty(v));
    delete dock.dataset.sized;
    delete dock.dataset.shape;
    delete dock.dataset.device;
    remoteScale = 1;
}

function placeDockFromStorage() {
    const dock = document.getElementById('motion-dock');
    const container = canvas?.parentElement;
    if (!dock || !container) return;
    const stored = readStore(DOCK_POS_KEY, 1, null);
    const x = numberOrNull(stored?.x, -1e4, 1e4);
    const y = numberOrNull(stored?.y, -1e4, 1e4);
    if (x === null || y === null) return;   // never moved: leave it parked by CSS
    dock.dataset.floating = 'true';
    dock.style.left = x + 'px';
    dock.style.top = y + 'px';
    dock.style.bottom = 'auto';
    dock.style.transform = 'none';
    clampDockPosition();
}

function wireRemote(dock, header) {
    // ---- drag ----
    let dragging = null;
    header.addEventListener('pointerdown', e => {
        // Only the bare strip drags. A pointerdown on the stop button, the
        // collapse toggle, or anything else operable belongs to that control.
        if (e.button !== 0 || e.target.closest('button, a, input, select, [tabindex]')) return;
        if (dock.dataset.mode !== 'floating') return;   // docked below the viewer: nothing to drag
        const rect = dock.getBoundingClientRect();
        dragging = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
        anchorDock(dock);
        header.classList.add('dragging');
        try { header.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
    });
    header.addEventListener('pointermove', e => {
        if (!dragging) return;
        const container = canvas.parentElement.getBoundingClientRect();
        dock.style.left = (e.clientX - container.left - dragging.dx) + 'px';
        dock.style.top = (e.clientY - container.top - dragging.dy) + 'px';
        clampDockPosition();
    });
    const endDrag = e => {
        if (!dragging) return;
        dragging = null;
        header.classList.remove('dragging');
        try { header.releasePointerCapture(e.pointerId); } catch {}
        const at = clampDockPosition();
        if (at) writeStore(DOCK_POS_KEY, { v: 1, x: at.x, y: at.y });
    };
    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);

    // ---- resize: the panel is a device, so its size is the point ----
    // Same pointer-capture shape as the studio's sidebar splitter, which is
    // the pattern that already works here.
    //
    // Bound once. The drag handlers above go on the header, which is rebuilt
    // with the panel, so they are replaced each time; these go on #motion-dock
    // itself, which is authored in the markup and survives `innerHTML = ''`.
    // Re-binding them stacked a second copy on every rebuild, and two copies
    // applied the same pointer delta twice against different scales.
    let resizing = null;
    if (dock.dataset.resizeWired !== 'true') {
        dock.dataset.resizeWired = 'true';
        dock.addEventListener('pointerdown', e => {
            const grip = e.target.closest('.remote-resize');
            if (!grip || e.button !== 0 || dock.dataset.mode !== 'floating') return;
            anchorDock(dock);
            const rect = dock.getBoundingClientRect();
            const container = canvas.parentElement.getBoundingClientRect();
            resizing = {
                edge: grip.dataset.edge,
                x0: e.clientX, y0: e.clientY,
                w0: dock.offsetWidth, h0: dock.offsetHeight,
                left0: rect.left - container.left,
                top0: rect.top - container.top
            };
            grip.classList.add('dragging');
            try { grip.setPointerCapture(e.pointerId); } catch {}
            e.preventDefault();
            e.stopPropagation();
        });
        dock.addEventListener('pointermove', e => {
            if (!resizing) return;
            // Pointer deltas are in drawn pixels; the size is in device pixels.
            const scale = remoteScale || 1;
            const dx = (e.clientX - resizing.x0) / scale;
            const dy = (e.clientY - resizing.y0) / scale;
            const { edge } = resizing;
            let w = resizing.w0, h = resizing.h0;
            if (edge.includes('e')) w = resizing.w0 + dx;
            if (edge.includes('w')) w = resizing.w0 - dx;
            if (edge.includes('s')) h = resizing.h0 + dy;
            if (edge.includes('n')) h = resizing.h0 - dy;
                w = THREE.MathUtils.clamp(w, REMOTE_MIN_W, REMOTE_MAX_W);
            h = THREE.MathUtils.clamp(h, REMOTE_MIN_H, REMOTE_MAX_H);
            applyRemoteSize(w, h, { announce: true });
            // A west or north grip moves the opposite corner as well as the size,
            // so the edge the user is NOT holding has to stay where it was.
            if (edge.includes('w')) dock.style.left = (resizing.left0 + (resizing.w0 - remoteSize.w) * scale) + 'px';
            if (edge.includes('n')) dock.style.top = (resizing.top0 + (resizing.h0 - remoteSize.h) * scale) + 'px';
            clampDockPosition();
        });
        const endResize = e => {
            if (!resizing) return;
            resizing = null;
            dock.querySelectorAll('.remote-resize.dragging').forEach(g => g.classList.remove('dragging'));
            try { e.target.releasePointerCapture?.(e.pointerId); } catch {}
            // Land on a real screen, however far off one the drag finished.
            const settle = nearestRemoteDevice(remoteSize.w, remoteSize.h);
            applyRemoteSize(settle.w, settle.h, { announce: true });
            persistRemoteSize();
            const at = clampDockPosition();
            if (at) writeStore(DOCK_POS_KEY, { v: 1, x: at.x, y: at.y });
        };
        dock.addEventListener('pointerup', endResize);
        dock.addEventListener('pointercancel', endResize);
    }

    // ---- theme ----
    header.querySelector('.remote-theme')?.addEventListener('click', () => {
        const next = dock.dataset.theme === 'dark' ? 'light' : 'dark';
        applyRemoteTheme(next);
        writeStore(REMOTE_THEME_KEY, { v: 1, theme: next });
    });

    // ---- collapse ----
    const dockToggle = document.getElementById('motion-dock-toggle');
    const toggleDock = makeCollapsible('motion-dock', {
        mode: 'display',
        storageKey: 'ergoflex.motionDockCollapsed',
        onToggle: collapsed => {
            dock.classList.toggle('collapsed', collapsed);
            dockToggle.textContent = collapsed ? '▲' : '▼';
            dockToggle.setAttribute('aria-label', collapsed ? 'Expand movement panel' : 'Collapse movement panel');
            // The canvas is not involved; only the panel's own footprint changed.
            clampDockPosition();
        }
    });
    dockToggle.onclick = toggleDock;
    // Docked below the viewer, the whole header is the affordance: the panel is
    // closed until you ask for it, and the bar is what you press.
    header.addEventListener('click', e => {
        if (dock.dataset.mode === 'floating') return;
        if (e.target.closest('button, a, input, select')) return;
        toggleDock();
    });

    // ---- stop ----
    document.getElementById('remote-stop').onclick = () => { haltAllMotion(); notifyUser('Movement stopped.'); };

    // ---- height ----
    const heightField = document.getElementById('desk-height-display');
    const commitHeight = () => {
        const value = Number(heightField.value);
        if (!isFinite(value)) { showHeight(liftToHeight(currentLift)); return; }
        const minimum = minimumHeightForTilt(primaryTiltConfig()?.currentDeg ?? 0, currentConfig.size);
        const clamped = THREE.MathUtils.clamp(value, minimum, HEIGHT_MAX);
        heightField.value = clamped.toFixed(2);
        goToHeight(clamped);
    };
    heightField.addEventListener('change', commitHeight);
    heightField.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitHeight(); heightField.blur(); } });
    document.getElementById('lift-speed').onchange = e => { liftSpeed = e.target.value; };

    // ---- tilt ----
    const tiltField = document.getElementById('tilt-value');
    const tiltSlider = document.getElementById('tilt-slider');
    const commitTilt = () => {
        const config = primaryTiltConfig();
        if (!config) return;
        const value = Number(tiltField.value);
        if (!isFinite(value)) { syncTiltUI(); return; }
        const clamped = THREE.MathUtils.clamp(value, config.minDeg,
            Math.min(config.maxDeg, maximumTiltForHeight(liftToHeight(currentLift), currentConfig.size)));
        tiltField.value = clamped.toFixed(2);
        goToTilt(clamped);
    };
    tiltField.addEventListener('change', commitTilt);
    tiltField.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitTilt(); tiltField.blur(); } });
    // This desk's front edge rises as the physical tilt value decreases.
    // Keep the control gesture intuitive: drag upward to raise that edge.
    wireJogSlider(tiltSlider, value => { tiltJog = -value; }, positionArcThumb);
    wireArcControl(dock.querySelector('.remote-arc'), tiltSlider);
    document.getElementById('tilt-speed').onchange = e => { tiltSpeed = e.target.value; };

    // ---- preset banks ----
    document.querySelectorAll('[data-preset-bank] .remote-chip').forEach(chip => {
        const kind = chip.closest('[data-preset-bank]').dataset.presetBank;
        const slot = Number(chip.dataset.slot);
        bindHold(chip,
            () => {
                const value = (kind === 'lift' ? liftPresets : tiltPresets)[slot];
                if (value === null) { notifyUser('That preset is empty. Press and hold to save the current position.'); return; }
                if (kind === 'lift') goToHeight(value); else goToTilt(value);
            },
            () => {
                if (kind === 'lift') {
                    liftPresets[slot] = Number(liftToHeight(currentLift).toFixed(1));
                    writeStore(LIFT_PRESET_KEY, { v: 1, slots: liftPresets });
                    notifyUser('Height ' + liftPresets[slot].toFixed(1) + '" saved to preset ' + (slot + 1) + '.');
                } else {
                    const config = primaryTiltConfig();
                    if (!config) { notifyUser('No tilt rig in this model to save.'); return; }
                    tiltPresets[slot] = Number(config.currentDeg.toFixed(1));
                    writeStore(TILT_PRESET_KEY, { v: 1, slots: tiltPresets });
                    notifyUser('Tilt ' + tiltPresets[slot].toFixed(1) + '° saved to preset ' + (slot + 1) + '.');
                }
                renderPresetChips();
                revealPresetChip(chip);
            }, () => revealPresetChip(chip));
    });

    // ---- ergo forms ----
    document.querySelector('.remote-forms-row').addEventListener('dblclick', e => {
        const button = e.target.closest('[data-form]');
        if (!button) return;
        const form = ergoForms[Number(button.dataset.form)];
        const name = prompt('Name this Ergo Form', form.name);
        if (name && name.trim()) {
            form.name = name.trim().slice(0, 24);
            writeStore(ERGO_FORMS_KEY, { v: 2, forms: ergoForms });
            renderErgoForms();
            wireErgoForms();
        }
    });
    wireErgoForms();
}

// Re-bound whenever the row is re-rendered, since renaming replaces the buttons.
function wireErgoForms() {
    document.querySelectorAll('.remote-form').forEach(button => {
        const form = ergoForms[Number(button.dataset.form)];
        bindHold(button,
            () => {
                if (form.lift === null || form.tilt === null) { notifyUser('That form is empty. Press and hold to save the current pose.'); return; }
                goToPose(form.lift, form.tilt);
            },
            () => {
                form.lift = Number(liftToHeight(currentLift).toFixed(1));
                const config = primaryTiltConfig();
                form.tilt = config ? Number(config.currentDeg.toFixed(1)) : 0;
                writeStore(ERGO_FORMS_KEY, { v: 2, forms: ergoForms });
                renderErgoForms();
                wireErgoForms();
                notifyUser(form.name + ' saved: ' + form.lift.toFixed(1) + '" at ' + form.tilt.toFixed(1) + '°.');
            });
    });
}

function syncGlideUI() {
    const state = `${glideOffset.x.toFixed(2)},${glideOffset.z.toFixed(2)},${glideActive},${glideInput.lengthSq() > 0},${roomCollisionBlocked}`;
    if (state === glideUIPrev) return; glideUIPrev = state;
    const demo = document.getElementById('glide-demo');
    if (demo) { demo.textContent = glideActive ? 'Pause demo' : 'Play demo'; demo.setAttribute('aria-pressed', String(glideActive)); }
    const status = document.getElementById('glide-status');
    if (status) status.textContent = roomCollisionBlocked ? 'Stopped · furniture ahead' : glideActive ? 'Demo playing' : glideInput.lengthSq() > 0 ? 'Gliding' : glideOffset.distanceTo(glideTarget) > 0.005 ? 'Moving to position' : 'Ready to move';
}
function startGlide() {
    if (!manualGlideReady()) return false;
    releaseGlideInput(); glideDemoOrigin.copy(glideOffset); glideActive = true; glideT = 0;
    syncGlideUI(); return true;
}
// Export uses an immediate home reset; customer Recenter uses setGlidePosition.
function stopGlide() {
    glideActive = false; releaseGlideInput(); glideTarget.set(0, 0, 0);
    applyGlideOffset(glideTarget); syncGlideUI();
}
function applyGlideOffset(next, { collide = false } = {}) {
    if (!loadedModel) return;
    let safetyEvent=null;
    if(collide&&!liveAR?.active&&workspaceRoom?.root){
        const result=roomInteractions?.moveDesk(deskCollisionBox(),{x:next.x-glideOffset.x,z:next.z-glideOffset.z});
        if(result){
            next=new THREE.Vector3(glideOffset.x+result.x,0,glideOffset.z+result.z);
            roomCollisionBlocked=result.blocked;safetyEvent=result.event;
            if(result.blocked)glideTarget.copy(next);
        }
    }
    const dx = next.x - glideOffset.x, dz = next.z - glideOffset.z;
    wheelRigs.forEach(rig => {
        rig.spin -= (dx + rig.latSign * dz) / rig.radius;
        rig.wrapper.rotation.z = rig.spin;
    });
    glideOffset.copy(next);
    applyDeskTransform();
    loadedModel.updateMatrixWorld(true);
    if (isSelectionMode) boxHelpers.forEach(helper => helper.update());
    if(safetyEvent)announceRoomSafety(safetyEvent);
}
function updateGlide(dt) {
    if (!loadedModel || roomSafety.alert) return;
    dt = Math.min(Math.max(dt, 0), 0.05);
    if (transformControl?.object || isDraggingTransform) { releaseGlideInput(); glideActive = false; glideTarget.copy(glideOffset); return; }
    // Rotation, tilt, desktop size, and room changes can alter the clearance.
    if (!liveAR?.active && workspaceRoom?.root) {
        clampGlidePosition(glideTarget);
        _glidePos.copy(glideOffset); clampGlidePosition(_glidePos);
        if (_glidePos.distanceToSquared(glideOffset) > 1e-12) applyGlideOffset(_glidePos);
    }
    if (glideActive) {
        glideT = Math.min(1, glideT + dt / GLIDE_DURATION);
        glidePath(glideT, _glidePos).add(glideDemoOrigin);
        clampGlidePosition(_glidePos);
        applyGlideOffset(_glidePos, { collide:true }); glideTarget.copy(glideOffset);
        if (glideT >= 1) glideActive = false;
    } else {
        if (glideInput.lengthSq() > 0) {
            // Fixed floor directions in the original placement frame: +X is
            // front, -Z is right. Orbiting or turning the desk never remaps them.
            // In AR the placement parent carries this frame into the real room.
            glideTarget.copy(glideOffset);
            glideTarget.x += glideInput.y * glideSpeed * dt;
            glideTarget.z -= glideInput.x * glideSpeed * dt;
            clampGlidePosition(glideTarget);
            applyGlideOffset(glideTarget, { collide:true });
        } else if (glideOffset.distanceToSquared(glideTarget) > 0.000001) {
            _glidePos.copy(glideTarget).sub(glideOffset);
            const step = Math.min(_glidePos.length(), glideSpeed * dt);
            _glidePos.setLength(step).add(glideOffset); applyGlideOffset(_glidePos, { collide:true });
        }
    }
    syncGlideUI();
}

// --- AR "See in your space" ---
// Android WebXR renders the live desk with DOM overlay controls; no GLB export
// or second renderer is needed. iOS Quick Look offers an interactive USDZ test
// asset and the configured GLB export as a static fallback.
// Both paths use meters calibrated from the selected desktop's physical width.
// WebXR requires HTTPS (or localhost) and iframe xr-spatial-tracking permission.
let liveAR = null;
let arBusy = false;
let lastARBlobUrl = null;
let lastAppleARBlobUrl = null;

async function prepareAppleTapAsset() {
    const { appleTapStates, exportAppleTapUSDZ } = await import('./apple-ar-interactions.mjs?v=apple-taps-handoff-fix-20260930');
    if (workspaceAccessories?.items.size) {
        throw new Error('Tap controls are not available with added desk accessories yet. Use the current-pose AR option.');
    }
    const height = liftToHeight(currentLift);
    const tilt = primaryTiltConfig()?.currentDeg ?? 0;
    const states = appleTapStates(height, tilt, currentConfig.size);
    const sourceMeshes = [];
    loadedModel.traverseVisible(object => {
        if (object.isMesh && !object.material?.isShaderMaterial) sourceMeshes.push(object);
    });
    const root = new THREE.Group();
    const samples = new Map();
    const meters = new THREE.Matrix4().makeScale(...Array(3).fill(arSizeReference().metersPerUnit));
    const materialCopies = new Map();
    const exported = sourceMeshes.map(source => {
        if (Array.isArray(source.material)) throw new Error('Apple tap export requires one material per desk surface.');
        let material = materialCopies.get(source.material);
        if (!material) {
            material = source.material.isMeshStandardMaterial ? source.material.clone() : new THREE.MeshStandardMaterial({
                color: source.material.color, map: source.material.map, roughness: .65,
                transparent: source.material.transparent, opacity: source.material.opacity, side: source.material.side
            });
            // USDZExporter writes emissive color but not emissiveIntensity.
            material.emissive.multiplyScalar(material.emissiveIntensity);
            material.emissiveIntensity = 1;
            materialCopies.set(source.material, material);
        }
        const mesh = new THREE.Mesh(source.geometry, material);
        mesh.name = source.name;
        mesh.matrixAutoUpdate = false;
        root.add(mesh);
        samples.set(mesh.id, []);
        return mesh;
    });
    const savedLift = currentLift;
    const savedDegrees = tiltConfigs.map(config => config.currentDeg);
    const savedPaused = motionPaused;
    try {
        // Synchronous sampling: no frame, UI update, saved preset or localStorage
        // write can see these temporary poses. Restore even if a rig throws.
        motionPaused = true;
        for (let i = 0; i < states.length; i++) {
            currentLift = heightToLift(states[i].height);
            if (primaryTiltConfig()) primaryTiltConfig().currentDeg = states[i].tilt;
            updateMovingObjectsPosition();
            tiltConfigs.forEach(applyTiltConfig);
            loadedModel.updateWorldMatrix(true, true);
            sourceMeshes.forEach((source, index) => {
                const matrix = meters.clone().multiply(source.matrixWorld);
                samples.get(exported[index].id).push(matrix);
                if (i === 0) exported[index].matrix.copy(matrix);
            });
        }
    } finally {
        currentLift = savedLift;
        tiltConfigs.forEach((config, i) => { config.currentDeg = savedDegrees[i]; });
        updateMovingObjectsPosition();
        tiltConfigs.forEach(applyTiltConfig);
        loadedModel.updateWorldMatrix(true, true);
        motionPaused = savedPaused;
    }
    root.updateMatrixWorld(true);
    try {
        const result = await exportAppleTapUSDZ(root, { states, samples });
        if (lastAppleARBlobUrl) URL.revokeObjectURL(lastAppleARBlobUrl);
        lastAppleARBlobUrl = URL.createObjectURL(new Blob([result.bytes], { type: 'model/vnd.usdz+zip' }));
        return { url: lastAppleARBlobUrl, bytes: result.bytes.length, ...result.stats };
    } finally {
        materialCopies.forEach(material => material.dispose());
    }
}

// Ask the browser what it can do rather than guessing from the user-agent.
// Chrome defaults to desktop-site mode on large foldables (and on tablets),
// which rewrites the UA to an "X11; Linux x86_64" desktop string — no Android
// in it. A Fold with working ARCore and a live immersive-ar session therefore
// used to fail a UA sniff and get told to open the page on a phone.
async function isMobileARDevice() {
    // Android and anything else with WebXR. Needs a secure context, so this
    // is also what reports false on a plain-http dev URL.
    if (navigator.xr) {
        try {
            if (await navigator.xr.isSessionSupported('immersive-ar')) return true;
        } catch { /* isSessionSupported throws on some older builds */ }
    }
    // iOS has no navigator.xr; AR Quick Look is the path there, and the
    // supported way to detect it is the <a rel="ar"> relationship.
    const a = document.createElement('a');
    return !!(a.relList && a.relList.supports && a.relList.supports('ar'));
}

async function prepareARModel({ appleTaps = true } = {}) {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    if (!customElements.get('model-viewer')) {
        await import('https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js');
    }
    haltAllMotion();
    stopGlide(); // desk must be at its home position for a clean export

    let appleAsset = null, appleError = null;
    if (appleTaps) {
        try { appleAsset = await prepareAppleTapAsset(); }
        catch (error) {
            console.warn('[ErgoFlex] Apple tap preview unavailable:', error);
            appleError = error.message;
        }
    }

    // Clone shares geometries/materials — cheap even at 830 meshes
    const clone = loadedModel.clone(true);
    // The browser's additive LED fields use custom shaders that GLB/Quick Look
    // cannot represent. Export the actual textured surfaces and LED strips.
    const browserLightFields = [];
    clone.traverse(object => {
        if (object.isMesh && object.material?.isShaderMaterial) browserLightFields.push(object);
    });
    browserLightFields.forEach(object => object.removeFromParent());
    clone.position.x = glideBase.x;
    clone.position.z = glideBase.z;

    const exportRoot = new THREE.Group();
    exportRoot.scale.setScalar(arSizeReference().metersPerUnit); // glTF units are meters
    exportRoot.add(clone);
    for (const group of workspaceAccessories?.exportGroups() || []) {
        group.matrix.elements[12] -= glideOffset.x;
        group.matrix.elements[14] -= glideOffset.z;
        exportRoot.add(group);
    }

    const glb = await new Promise((resolve, reject) =>
        new GLTFExporter().parse(exportRoot, resolve, reject, { binary: true }));
    const blob = new Blob([glb], { type: 'model/gltf-binary' });
    if (lastARBlobUrl) URL.revokeObjectURL(lastARBlobUrl);
    lastARBlobUrl = URL.createObjectURL(blob);

    let mv = document.getElementById('ar-model-viewer');
    if (!mv) {
        mv = document.createElement('model-viewer');
        mv.id = 'ar-model-viewer';
        mv.setAttribute('ar', '');
        // In the tall LA Tech Week iframe this hidden element sits below the
        // phone's visible viewport. Default lazy loading never starts there.
        mv.setAttribute('loading', 'eager');
        mv.setAttribute('ar-modes', 'webxr quick-look');
        mv.setAttribute('ar-scale', 'fixed'); // true size in the room
        mv.addEventListener('ar-status', event => {
            if (event.detail.status === 'failed') {
                showARHelpModal('AR could not start. Try opening the viewer directly on a compatible phone or tablet over HTTPS.');
            }
        });
        mv.style.cssText = 'position:fixed;bottom:0;left:0;width:2px;height:2px;opacity:0.01;pointer-events:none;';
        document.body.appendChild(mv);
    }
    await new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(to);
            mv.removeEventListener('load', onLoad);
            mv.removeEventListener('error', onError);
        };
        const onLoad = () => { cleanup(); resolve(); };
        const onError = event => { cleanup(); reject(new Error(`AR model loading failed (${event.detail?.type || 'unknown error'}).`)); };
        const to = setTimeout(() => { cleanup(); reject(new Error('AR model loading timed out. Open the viewer directly and try again.')); }, 120000);
        mv.addEventListener('load', onLoad);
        mv.addEventListener('error', onError);
        mv.src = lastARBlobUrl;
    });
    // Supplying ios-src prevents model-viewer from re-converting the interactive
    // asset and dropping its tap behavior graph. Android never enters this path.
    if (appleAsset) mv.setAttribute('ios-src', appleAsset.url);
    else mv.removeAttribute('ios-src');
    return { modelViewer: mv, bytes: blob.size, appleAsset, appleError };
}

const arWidthOverrides = new Map();
function arSizeReference() {
    const nominalWidth = Number(currentConfig.size.split('x')[0]);
    let widthInches = arWidthOverrides.get(currentConfig.size) ?? nominalWidth;
    try {
        const stored = Number(localStorage.getItem('ergoflex.arWidthV1.'+currentConfig.size));
        if (!arWidthOverrides.has(currentConfig.size) && stored >= 24 && stored <= 96) widthInches = stored;
    } catch {}
    let widthUnits;
    if (sizeVariantParts) {
        loadedModel.updateWorldMatrix(true,true);
        const inverse = loadedModel.matrixWorld.clone().invert();
        const parts = currentConfig.size === '60x30'
            ? [sizeVariantParts.largeTop,sizeVariantParts.largeTrim]
            : [sizeVariantParts.smallTop,sizeVariantParts.smallTrim];
        const bounds = new THREE.Box3();
        for (const part of parts) {
            part.geometry.computeBoundingBox();
            bounds.union(part.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(part.matrixWorld)));
        }
        // Authored width is Z. Cancel model yaw, AR placement and parent scale
        // before measuring, so changing the pose cannot change its real size.
        widthUnits = bounds.getSize(new THREE.Vector3()).z * Math.abs(loadedModel.scale.z);
    }
    const fallback = .0254 * (HEIGHT_MAX-HEIGHT_MIN)/((LIFT_MAX-LIFT_MIN)*loadedModel.scale.x);
    return {key:currentConfig.size,nominalWidth,widthInches,widthUnits,
        metersPerUnit:widthUnits>0 ? widthInches*.0254/widthUnits : fallback};
}

function setARWidth(inches) {
    const width = Number(inches);
    if (!Number.isFinite(width) || width<24 || width>96) return false;
    arWidthOverrides.set(currentConfig.size,width);
    try {localStorage.setItem('ergoflex.arWidthV1.'+currentConfig.size,String(width));} catch {}
    return true;
}

function getLiveAR() {
    if (!liveAR) liveAR = new ARWorkspace({
        get renderer() { return renderer; }, get camera() { return camera; },
        get controls() { return controls; }, get model() { return loadedModel; },
        get scene() { return scene; }, lights:() => Object.values(sceneLights),
        accessories:() => [...(workspaceAccessories?.mounts.values() || [])].map(mount => mount.group),
        metersPerUnit:() => arSizeReference().metersPerUnit,
        sizeReference:arSizeReference, setWidth:setARWidth,
        remote:() => document.getElementById('motion-dock'),
        ledControls:() => [], // Lighting opens from the app inside the WebXR overlay.
        halt:haltAllMotion, resize:syncViewerSize
    });
    return liveAR;
}

async function launchAR() {
    if (arBusy || !loadedModel) return;
    if (roomGroove?.prepared) { haltAllMotion(); roomGroove.reset(); }
    if (navigator.xr && await navigator.xr.isSessionSupported('immersive-ar').catch(() => false)) {
        const modal = showARHelpModal('Place the current desk at full size, then use the ErgoFlex app to Glide, turn, adjust height and tilt, or switch LEDs inside AR.');
        const place = document.createElement('button');
        place.type = 'button'; place.id = 'ar-place-button'; place.textContent = 'Start AR';
        place.addEventListener('click', () => {
            place.disabled = true;
            const starting = getLiveAR().start(); // requestSession runs during this tap
            modal.remove();
            starting.catch(error => showARHelpModal(`AR could not start: ${error.name}: ${error.message}. Try opening the viewer directly.`));
        });
        modal.querySelector('#ar-help-close').before(place);
        place.focus();
        return;
    }
    if (!await isMobileARDevice()) {
        showARHelpModal();
        return;
    }
    const buttons = [...document.querySelectorAll('#ar-btn, [data-ar-launch]')];
    arBusy = true;
    buttons.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); });
    const modal = showARHelpModal('Preparing your current desk configuration…');
    try {
        const { modelViewer, appleAsset, appleError } = await prepareARModel();
        if (!modal.isConnected) return;
        modal.querySelector('#ar-help-message').textContent = appleAsset
            ? 'iPhone tap-controls preview: tap a leg to switch Sitting/Standing, or a wing to cycle −5°, 39° and 65°. The desk raises if needed for tilt clearance. This preview needs an iPhone test. You can also open the current pose only.'
            : 'Your desk is ready. Place it in your room at full size.' + (appleError ? ' Tap-controls preview unavailable: ' + appleError : '');
        const place = document.createElement('button');
        place.type = 'button';
        place.id = 'ar-place-button';
        place.className = 'btn-primary w-full py-3';
        place.textContent = appleAsset ? 'Try iPhone tap controls' : 'Place in my space';
        // A fresh tap after export preserves the user activation required by
        // Quick Look and WebXR; exporting first can take several seconds.
        place.addEventListener('click', () => {
            if (!modelViewer.canActivateAR) {
                showARHelpModal('This browser could not enable AR. Open the viewer directly on a compatible phone or tablet over HTTPS.');
                return;
            }
            place.disabled = true;
            modelViewer.activateAR().then(() => modal.remove()).catch(err => {
                console.error('[ErgoFlex] AR launch failed:', err);
                showARHelpModal('AR could not start. Open this viewer over HTTPS on a compatible phone or tablet and try again.');
            });
        });
        modal.querySelector('#ar-help-close').before(place);
        if (appleAsset) {
            const staticPlace = document.createElement('button');
            staticPlace.type = 'button'; staticPlace.id = 'ar-static-button';
            staticPlace.className = 'btn-primary w-full py-3';
            staticPlace.textContent = 'Open current pose only';
            staticPlace.addEventListener('click', () => {
                modelViewer.removeAttribute('ios-src');
                staticPlace.disabled = true;
                modelViewer.activateAR().then(() => modal.remove()).catch(error => {
                    staticPlace.disabled = false;
                    showARHelpModal(`AR could not start. ${error.message || 'Open the viewer directly and try again.'}`);
                });
            });
            modal.querySelector('#ar-help-close').before(staticPlace);
        }
        place.focus();
    } catch (err) {
        console.error('[ErgoFlex] AR launch failed:', err);
        showARHelpModal(`The AR model could not be prepared. ${err.message || 'Please try again.'}`);
    } finally {
        arBusy = false;
        buttons.forEach(button => { button.disabled = false; button.removeAttribute('aria-busy'); });
    }
}

function showARHelpModal(message) {
    const returnFocus = document.activeElement;
    let modal = document.getElementById('ar-help-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'ar-help-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ar-help-title');
    modal.className = 'fixed inset-0 bg-black bg-opacity-25 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl text-center">
            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
            </div>
            <h3 id="ar-help-title" class="text-xl font-semibold text-gray-900 mb-2">See it in your space</h3>
            <p id="ar-help-message" class="text-gray-600 text-sm leading-relaxed mb-4"></p>
            <a id="ar-help-url" class="text-xs text-gray-400 break-all mb-6" target="_blank" rel="noopener">Open the viewer directly</a>
            <button class="btn-primary w-full py-3" id="ar-help-close">Got it</button>
        </div>
    `;
    modal.querySelector('#ar-help-message').textContent = message ||
        'Open this viewer over HTTPS on a compatible phone or tablet, then tap AR/XR to place your configured ErgoFlex desk in your room at full size.';
    modal.querySelector('#ar-help-url').href = window.location.href;
    const close = () => { modal.remove(); if (returnFocus?.isConnected) returnFocus.focus(); };
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.id === 'ar-help-close') close();
    });
    document.body.appendChild(modal);
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
        if (event.key === 'Tab') {
            const controls = [...modal.querySelectorAll('a, button:not(:disabled)')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    modal.querySelector('#ar-help-close').focus();
    return modal;
}

// --- Rig setup UI (draft state + buttons) ---
let rigPickMode = null; // 'base' | 'target'
let rigDraft = { baseLocal: null, baseName: null, targetEditorId: null, targetName: null, cylinderEditorIds: [], rodEditorIds: [] };


// --- Pick feedback -------------------------------------------------------------
// "Pick base / target / pivot" used to be a blind click: nothing lit up under the
// cursor and nothing stayed marked afterwards, so on a model this dense you could
// not tell which of a dozen overlapping parts you had just grabbed. A hover
// highlight plus a name label answers "what am I about to pick?", and the picked
// parts keep a coloured box until the rig is saved.
const PICK_COLOR = { base: 0xa855f7, target: 0x14b8a6, hover: 0xffd60a };
let hoverHelper = null;
let hoverObj = null;
const rigPickHelpers = { base: null, target: null };

function isPickModeActive() { return !!rigPickMode || isPickingPivot; }

function clearHoverHighlight() {
    if (hoverHelper) { scene.remove(hoverHelper); hoverHelper = null; }
    hoverObj = null;
    const label = document.getElementById('pick-hover-label');
    if (label) label.classList.add('hidden');
}

function updatePickHover(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactableObjects, false);

    if (hits.length === 0) { clearHoverHighlight(); return; }

    const obj = hits[0].object;
    if (obj !== hoverObj) {
        if (hoverHelper) scene.remove(hoverHelper);
        hoverHelper = new THREE.BoxHelper(obj, PICK_COLOR.hover);
        hoverHelper.material.depthTest = false;
        hoverHelper.renderOrder = 998;
        scene.add(hoverHelper);
        hoverObj = obj;
    }

    const label = document.getElementById('pick-hover-label');
    if (label) {
        const eid = obj.userData.editorId;
        const custom = partLabels.get(eid);
        label.textContent = custom ? custom + '  ·  ' + eid : (eid || obj.name);
        label.classList.remove('hidden');
        label.style.left = (event.clientX - rect.left + canvas.offsetLeft + 14) + 'px';
        label.style.top = (event.clientY - rect.top + canvas.offsetTop + 14) + 'px';
    }
}

function setRigPickHelper(kind, obj) {
    if (rigPickHelpers[kind]) { scene.remove(rigPickHelpers[kind]); rigPickHelpers[kind] = null; }
    if (!obj) return;
    const helper = new THREE.BoxHelper(obj, PICK_COLOR[kind]);
    helper.material.depthTest = false;
    helper.renderOrder = 997;
    scene.add(helper);
    rigPickHelpers[kind] = helper;
}

function clearRigPickHelpers() {
    setRigPickHelper('base', null);
    setRigPickHelper('target', null);
}

// --- Rig base pivot ------------------------------------------------------------
// The base pick seeds the pivot with the clicked part's bounding-box centre, which
// is almost never the real hinge. The marker below makes that point visible and
// movable — by gizmo, by number, or by snapping to a selection's centre.
let pivotMarker = null;
let pivotEditRigIdx = -1;   // >= 0 while editing a saved rig, -1 while drafting
let pivotGizmoOn = false;

function currentLiftOffset() { return currentLift - LIFT_MIN; }

function showPivotMarker(baseLocal) {
    if (!loadedModel || !baseLocal) return;
    if (!pivotMarker) {
        const mat = new THREE.MeshBasicMaterial({
            color: PICK_COLOR.base, depthTest: false, transparent: true, opacity: 0.85
        });
        pivotMarker = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 14), mat);
        pivotMarker.renderOrder = 999;
        pivotMarker.name = 'rigPivotMarker';
        pivotMarker.userData.isPivotMarker = true;
    }
    // Parented to the model so it tracks glide/lift in model-local coordinates
    if (pivotMarker.parent !== loadedModel) loadedModel.add(pivotMarker);
    pivotMarker.position.set(baseLocal.x, baseLocal.y + currentLiftOffset(), baseLocal.z);
    pivotMarker.updateMatrixWorld(true);
}

function hidePivotMarker() {
    setPivotGizmo(false);
    // Fully detached rather than just hidden — exporters and scene walks would
    // otherwise pick up an editor-only helper.
    if (pivotMarker && pivotMarker.parent) pivotMarker.parent.remove(pivotMarker);
}

function setPivotGizmo(on) {
    if (!transformControl) return;
    if (on && pivotMarker && pivotMarker.parent) {
        pivotGizmoOn = true;
        transformControl.setMode('translate');
        transformControl.attach(pivotMarker);
    } else {
        if (pivotGizmoOn) {
            pivotGizmoOn = false;
            transformControl.detach();
            // Restore whatever mode the Transform Tool radios were on
            const tMode = document.querySelector('input[name="transform_mode"]:checked');
            if (tMode && tMode.value !== 'none') transformControl.setMode(tMode.value);
            updateTransformProxy(); // hand the gizmo back to the part selection
        }
    }
    const btn = document.getElementById('rig-pivot-gizmo-btn');
    if (btn) {
        btn.classList.toggle('bg-purple-200', pivotGizmoOn);
        btn.textContent = pivotGizmoOn ? 'Stop dragging' : 'Drag in 3D';
    }
}

function readPivotInputs() {
    const num = id => parseFloat(document.getElementById(id)?.value);
    const x = num('rig-pivot-x'), y = num('rig-pivot-y'), z = num('rig-pivot-z');
    if (![x, y, z].every(Number.isFinite)) return null;
    return { x, y, z };
}

function syncPivotInputs(baseLocal) {
    if (!baseLocal) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v.toFixed(3); };
    set('rig-pivot-x', baseLocal.x);
    set('rig-pivot-y', baseLocal.y);
    set('rig-pivot-z', baseLocal.z);
}

function pivotFromMarker() {
    if (!pivotMarker) return null;
    return {
        x: pivotMarker.position.x,
        y: pivotMarker.position.y - currentLiftOffset(),
        z: pivotMarker.position.z
    };
}

function openPivotEditor(rigIdx = -1) {
    const base = rigIdx >= 0 ? actuatorRigs[rigIdx]?.baseLocal : rigDraft.baseLocal;
    if (!base) return;
    pivotEditRigIdx = rigIdx;
    showPivotMarker(base);
    syncPivotInputs(base);
    const panel = document.getElementById('rig-pivot-editor');
    if (panel) panel.classList.remove('hidden');
    const title = document.getElementById('rig-pivot-title');
    if (title) title.textContent = rigIdx >= 0
        ? 'Base pivot — ' + actuatorRigs[rigIdx].name
        : 'Base pivot (new rig)';
}

function closePivotEditor() {
    hidePivotMarker();
    pivotEditRigIdx = -1;
    const panel = document.getElementById('rig-pivot-editor');
    if (panel) panel.classList.add('hidden');
}

// Applying to a saved rig rebuilds it: the wrappers bake rest direction and length
// from the pivot, so moving the pivot means re-deriving both.
function applyPivotEdit() {
    const pivot = readPivotInputs();
    if (!pivot) return;

    if (pivotEditRigIdx >= 0) {
        const rig = actuatorRigs[pivotEditRigIdx];
        if (!rig) return;
        const data = {
            name: rig.name,
            baseLocal: pivot,
            targetEditorId: rig.targetEditorId,
            cylinderEditorIds: [...rig.cylinderEditorIds],
            rodEditorIds: [...rig.rodEditorIds]
        };
        removeActuatorRig(pivotEditRigIdx);
        buildActuatorRig(data);
        persistActuatorRigs();
        rebuildRigUI();
        pivotEditRigIdx = actuatorRigs.findIndex(r => r.name === data.name);
    } else {
        rigDraft.baseLocal = pivot;
        updateRigStatus();
    }
    showPivotMarker(pivot);
}

// Model-local centre of the current selection, for snapping the pivot to a part
// (or a couple of parts) rather than typing coordinates.
function selectionCenterLocal() {
    if (movingObjects.length === 0 || !loadedModel) return null;
    const box = new THREE.Box3();
    movingObjects.forEach(item => {
        item.obj.updateWorldMatrix(true, false);
        box.expandByObject(item.obj);
    });
    if (box.isEmpty()) return null;
    const c = box.getCenter(new THREE.Vector3());
    loadedModel.updateMatrixWorld(true);
    loadedModel.worldToLocal(c);
    c.y -= currentLiftOffset(); // normalise to the 28" reference height
    return { x: c.x, y: c.y, z: c.z };
}

function updateRigStatus() {
    const el = document.getElementById('rig-status');
    if (!el) return;
    const p = rigDraft.baseLocal;
    el.innerHTML = 'Base: ' + (rigDraft.baseName ? '<b>' + rigDraft.baseName + '</b>' : '—') +
        (p ? ' <span class="text-purple-600">pivot ' + p.x.toFixed(2) + ', ' + p.y.toFixed(2) + ', ' + p.z.toFixed(2) + '</span>' : '') +
        ' &nbsp;·&nbsp; Target: ' + (rigDraft.targetName ? '<b>' + rigDraft.targetName + '</b>' : '—') +
        ' &nbsp;·&nbsp; Cylinder: <b>' + rigDraft.cylinderEditorIds.length + '</b> parts' +
        ' &nbsp;·&nbsp; Rod: <b>' + rigDraft.rodEditorIds.length + '</b> parts';
}

function updateRigPickButtons() {
    const baseBtn = document.getElementById('rig-pick-base-btn');
    const targetBtn = document.getElementById('rig-pick-target-btn');
    if (baseBtn) {
        baseBtn.textContent = rigPickMode === 'base' ? 'Click a part...' : '1. Pick Base Part';
        baseBtn.classList.toggle('bg-purple-100', rigPickMode === 'base');
    }
    if (targetBtn) {
        targetBtn.textContent = rigPickMode === 'target' ? 'Click a part...' : '2. Pick Target Part';
        targetBtn.classList.toggle('bg-purple-100', rigPickMode === 'target');
    }
}

function selectedEditorIds() {
    return movingObjects
        .map(item => item.obj)
        .filter(obj => !isInTiltWrapper(obj) && !telescopingObjects.some(t => t.obj === obj))
        .map(obj => obj.userData.editorId)
        .filter(Boolean);
}

function saveActuatorRigFromUI() {
    const name = document.getElementById('rig-name-input')?.value?.trim();
    if (!name) return console.warn('[ErgoFlex] Give the rig a name first.');
    if (!rigDraft.baseLocal) return console.warn('[ErgoFlex] Pick a base part first.');
    if (!rigDraft.targetEditorId) return console.warn('[ErgoFlex] Pick a target part first.');
    if (rigDraft.cylinderEditorIds.length === 0 && rigDraft.rodEditorIds.length === 0)
        return console.warn('[ErgoFlex] Capture cylinder and/or rod parts first.');
    const rig = buildActuatorRig({
        name,
        baseLocal: rigDraft.baseLocal,
        targetEditorId: rigDraft.targetEditorId,
        cylinderEditorIds: rigDraft.cylinderEditorIds,
        rodEditorIds: rigDraft.rodEditorIds
    });
    if (!rig) return;
    transaction({ type: 'rig-save', name: name });
    persistActuatorRigs();
    clearRigPickHelpers();
    closePivotEditor();
    rigDraft = { baseLocal: null, baseName: null, targetEditorId: null, targetName: null, cylinderEditorIds: [], rodEditorIds: [] };
    const nameInput = document.getElementById('rig-name-input');
    if (nameInput) nameInput.value = '';
    updateRigStatus();
    rebuildRigUI();
}

function rebuildRigUI() {
    const list = document.getElementById('rig-list');
    if (!list) return;
    list.innerHTML = '';
    actuatorRigs.forEach((rig, idx) => {
        const div = document.createElement('div');
        div.className = 'bg-purple-50 border border-purple-200 p-2 rounded-lg flex justify-between items-center';
        div.innerHTML =
            '<span class="text-purple-800 text-xs font-medium">' + rig.name +
            ' <span class="font-normal text-purple-500">(cyl ' + rig.cylinderEditorIds.length + ' · rod ' + rig.rodEditorIds.length + ' → ' + (partRegistry.get(rig.targetEditorId)?.name || rig.targetEditorId) + ')</span></span>' +
            '<span class="flex items-center gap-2">' +
            '<button class="border border-purple-300 text-purple-600 hover:bg-purple-100 px-2 py-0.5 rounded text-[11px] font-medium" data-pivot-rig="' + idx + '" title="Show and move this rig\'s base pivot">Pivot</button>' +
            '<button class="text-red-400 hover:text-red-600 text-sm font-bold leading-none" data-remove-rig="' + idx + '" title="Remove rig">✕</button>' +
            '</span>';
        div.querySelector('[data-pivot-rig]').addEventListener('click', () => openPivotEditor(idx));
        div.querySelector('[data-remove-rig]').addEventListener('click', () => removeActuatorRig(idx));
        list.appendChild(div);
    });
}

// Re-fits the renderer to whatever size the viewer container currently is.
// Called on window resize, on ResizeObserver ticks, and after layout switches.
function syncViewerSize() {
    if (renderer?.xr.isPresenting) return;
    if (!renderer || !camera || !canvas.parentElement) return;
    const container = canvas.parentElement;
    const w = container.clientWidth;
    const viewerControls = container.querySelector('.viewer-controls');
    const top = EVENT_DEMO ? 0 : viewerControls ? viewerControls.offsetTop + viewerControls.offsetHeight + 12 : (w < 500 ? 188 : 168);
    // The movement panel floats over the canvas rather than displacing it, so its
    // size no longer reaches the camera at all. Coupling them is what made the
    // panel cost the desk ~283px of height, and what forced every tab to reserve
    // the tallest panel's height so switching tabs would not move the camera.
    const h = Math.max(160, container.clientHeight - top);
    if (w === 0 || container.clientHeight === 0) return;
    canvas.style.position = 'absolute'; canvas.style.top = top + 'px';
    camera.aspect = w / h;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

// Temp instrumentation: track if we've logged max height
let _loggedMaxHeight = false;

function animate(time, frame) {
    liveAR?.update(frame, time);

    // withNeutralPose sets motionPaused while it captures or applies geometry, so
    // a frame cannot advance the lift or the glide mid-capture. Rendering still
    // runs, so the viewer does not freeze.
    const dt = clock.getDelta();
    if (loadedModel && !motionPaused && !roomSafety.alert) {
        if (liftJog) ledAutoLift = false;
        else if (Math.abs(targetLift-currentLift) > .001) ledAutoLift = true;
        if (tiltJog) ledAutoTilt = false;
        else if (tiltTarget !== null) ledAutoTilt = true;
    }
    if (!motionPaused && !roomSafety.alert) {
        if (roomGroove?.run) roomGroove.update(dt);
        else updateGlide(dt);
    }
    if (!motionPaused && screenAssembly && Math.abs(screenProgress - screenTarget) > 0.0001) {
        const step = Math.min(1, dt / 2.2);
        setScreenProgress(Math.abs(screenTarget - screenProgress) <= step
            ? screenTarget : screenProgress + Math.sign(screenTarget - screenProgress) * step);
    }

    // Handle smooth animation if not manually scrubbing
    if (loadedModel && !manualLiftOverride && !motionPaused && !roomSafety.alert) {
        const minLift = heightToLift(minimumHeightForTilt(primaryTiltConfig()?.currentDeg ?? 0, currentConfig.size));
        const allowedTargetLift = Math.max(targetLift, minLift);
        if (Math.abs(allowedTargetLift - currentLift) > 0.001) {
            // Units per second, integrated against the real frame time. The old
            // `* 0.08` was a per-frame fraction, so the desk genuinely moved at
            // different speeds on different displays and stalled under load.
            const step = liftUnitsPerSecond() * dt;
            const remaining = allowedTargetLift - currentLift;
            currentLift = Math.max(minLift,
                currentLift + (Math.abs(remaining) <= step ? remaining : Math.sign(remaining) * step));
            updateMovingObjectsPosition();
            showHeight(liftToHeight(currentLift));

            // Temp instrumentation: log column positions at max height once
            if (!_loggedMaxHeight && Math.abs(currentLift - LIFT_MAX) < 0.05) {
                _loggedMaxHeight = true;
                console.log('[ErgoFlex] Reached max height (' + HEIGHT_MAX + '"). Telescoping column positions:');
                telescopingObjects.forEach(item => {
                    const wp = new THREE.Vector3();
                    item.obj.getWorldPosition(wp);
                    console.log('  ' + item.obj.name + ' localY=' + item.obj.position.y.toFixed(6) + ' worldY=' + wp.y.toFixed(6));
                });
            }
            if (currentLift < LIFT_MIN + 1) {
                _loggedMaxHeight = false; // reset when back near min
            }
        }
    }

    // The desk turns for as long as the ring is held over.
    if (loadedModel && !motionPaused && !roomSafety.alert && yawCommand) {
        // The same per-frame ceiling updateGlide applies. Without it a long frame
        // advances the turn by that whole gap - the desk jumps, and on a slow
        // machine turning outruns gliding at the same speed setting because only
        // one of them is throttled.
        const turnDt = Math.min(Math.max(dt, 0), 0.05);
        const step = yawCommand * yawRadiansPerSecond() * turnDt;
        const before=!liveAR?.active?deskCollisionBox():null;
        deskYaw += step;
        applyDeskTransform();
        loadedModel.updateMatrixWorld(true);
        const safetyStop=before&&roomInteractions?.turnSafety(before,deskCollisionBox());
        if(safetyStop?.blocked || (before&&!roomInteractions?.canTurn(before,deskCollisionBox()))){
            deskYaw-=step;applyDeskTransform();loadedModel.updateMatrixWorld(true);roomCollisionBlocked=true;
            if(safetyStop?.event)announceRoomSafety(safetyStop.event);
        }else{spinWheelsForYaw(step);roomCollisionBlocked=false;}
    }

    // Held off centre: drive for as long as it is held.
    if (loadedModel && !motionPaused && !roomSafety.alert && liftJog) {
        const jogDt = Math.min(Math.max(dt, 0), 0.05);
        const minLift = heightToLift(minimumHeightForTilt(primaryTiltConfig()?.currentDeg ?? 0, currentConfig.size));
        currentLift = THREE.MathUtils.clamp(
            currentLift + liftJog * liftUnitsPerSecond() * jogDt, minLift, LIFT_MAX);
        targetLift = currentLift;
        updateMovingObjectsPosition();
        showHeight(liftToHeight(currentLift));
    }
    if (loadedModel && !motionPaused && !roomSafety.alert && tiltJog) {
        const config = primaryTiltConfig();
        if (config) {
            const jogDt = Math.min(Math.max(dt, 0), 0.05);
            const heightLimit = config.name === 'tilting'
                ? maximumTiltForHeight(liftToHeight(currentLift), currentConfig.size) : config.maxDeg;
            config.currentDeg = THREE.MathUtils.clamp(
                config.currentDeg + tiltJog * tiltDegreesPerSecond() * jogDt,
                config.minDeg, Math.min(config.maxDeg, heightLimit));
            tiltTarget = null;
            applyTiltConfig(config);
            syncTiltUI();
        }
    }

    // Tilt eases toward its target the same way. applyTiltConfig is immediate, so
    // without this a speed control would have nothing to act on.
    if (loadedModel && !motionPaused && !roomSafety.alert && tiltTarget !== null) {
        const config = primaryTiltConfig();
        if (!config) tiltTarget = null;
        else if (Math.abs(tiltTarget - config.currentDeg) <= 0.01) {
            config.currentDeg = tiltTarget; applyTiltConfig(config); tiltTarget = null; syncTiltUI();
        } else {
            const allowedTilt = Math.min(tiltTarget,
                maximumTiltForHeight(liftToHeight(currentLift), currentConfig.size));
            const step = tiltDegreesPerSecond() * dt;
            const remaining = allowedTilt - config.currentDeg;
            config.currentDeg += Math.abs(remaining) <= step ? remaining : Math.sign(remaining) * step;
            applyTiltConfig(config); syncTiltUI();
        }
    }

    // Constantly update box helpers if we are dragging the transform proxy
    if (isSelectionMode && isDraggingTransform) {
        boxHelpers.forEach(helper => helper.update());
    }

    if (controls && !liveAR?.active) {
        updateCameraTween(dt);
        controls.update();
        const orbitButton = document.getElementById('rotate-scene');
        if (orbitButton && orbitButton.getAttribute('aria-pressed') !== String(controls.autoRotate)) orbitButton.setAttribute('aria-pressed', String(controls.autoRotate));
    }
    workspaceAccessories?.update();
    if (loadedModel && !motionPaused && !roomSafety.alert) {
        const completed = ledMotion.completionUntil;
        ledMotion.observe(ledPose(), time, {enabled:ledMotionEnabled && ledDiagnostic.strip === null && !document.hidden,
            liftReached:ledAutoLift && Math.abs(targetLift-currentLift)<=.001,
            tiltReached:ledAutoTilt && tiltTarget === null});
        if (!ledMotion.axes.lift) ledAutoLift = false;
        if (!ledMotion.axes.tilt) ledAutoTilt = false;
        ledSounds.update(ledMotion.owner?.sound || null, ledMotion.completionUntil > completed);
    }
    if (roomSafety.alert || ledEffect.mode !== 'solid' || ledDiagnostic.strip !== null || ledPixels?.active || ledMotion.owner || ledMotion.completionUntil || ledGame.active || ledMusic.active)
        updateLedEffectFrame(time / 1000);
    if (time-ledPlaybackUIAt > 150) {
        ledPlaybackUIAt = time;
        if (ledGame.active) ledGame.syncMonitor(workspaceAccessories);
        ledGame.syncUI(ledSounds.error || (ledMotion.owner ? `${ledMotion.owner.name} · movement cue` : ''));
        ledMusic.syncUI(true);
    }
    if (camera && !liveAR?.active) workspaceRoom?.update(camera);
    syncSafetyUI();
    if(time-touchscreenDrawAt>100){touchscreenDrawAt=time;updateTouchscreenDisplay();}
    roomLedSpill.update(workspaceRoom,ledPixels,{enabled:ledsEnabled&&!liveAR?.active,colour:ledFrameColor,gain:roomLedGain});
    if (renderer && scene && camera) renderer.render(liveAR?.active ? liveAR.scene : scene, camera);
}

// Studio presentation, customer configuration, and accessible controls.
const speciesPhotos = new Map(); // image path -> THREE.Texture (undefined while loading)
let surfaceFinish = 'gloss';
let grainEnabled = true;
let grainVisibility = 100;
let grainSheen = 100;
const grainRoughnessTextures = new Map();

function syncGrainControls() {
    for (const [id, value] of [['grain-visibility', grainVisibility], ['grain-sheen', grainSheen]]) {
        const input = document.getElementById(id);
        const output = document.getElementById(id + '-value');
        if (input) input.value = value;
        if (output) output.textContent = value + '%';
    }
}

function clearPhotoGrainTextures() {
    for (const [key, texture] of speciesTextures) {
        if (!key.includes('|photo|')) continue;
        texture.dispose();
        speciesTextures.delete(key);
    }
}

function grainRoughnessTexture(source, role) {
    const previous = grainRoughnessTextures.get(role);
    if (previous?.source === source && previous.strength === grainSheen) return previous.texture;
    previous?.texture.dispose();
    const image = source.image;
    if (!image?.width) return null;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    const strength = grainSheen / 100;
    for (let i = 0; i < data.length; i += 4) {
        const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i + 1] = data[i + 2] = 255 - (255 - luma) * strength;
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = source.anisotropy;
    grainRoughnessTextures.set(role, { source, strength: grainSheen, texture });
    return texture;
}
let studioGrid = null;
let isolatedVisibility = null;
let dialogReturnFocus = null;
let toastTimer;
function applyRoomLighting() {
    const measured = measuredRoomProfile();
    const profile = measured ? measured.modes[measured.mode] : ROOM_ATMOSPHERES[selectedRoomScene];
    const settings = roomLightSettings[selectedRoomScene] || {};
    const exposure = settings.exposure ?? profile.exposure;
    const daylight = settings.daylight ?? 1;
    const accent = settings.accent ?? 1;
    const ledStudio = document.getElementById('studio-environment')?.value === 'led';
    if (renderer) renderer.toneMappingExposure = exposure;
    if (scene) scene.environmentIntensity = profile.bounce * (ledStudio ? .35 : 1);
    if (sceneLights) {
        if (!measured) resetRoomLightRig(sceneLights);
        sceneLights.key.color.set(profile.key); sceneLights.key.intensity = profile.power * daylight * (ledStudio ? .55 : 1);
        sceneLights.key.position.set(selectedRoomScene === 'home' || selectedRoomScene === 'lounge' ? -5 : -3, 7, 5);
        if (selectedRoomScene === 'product') sceneLights.key.position.set(4.5, 8, 5.5);
        sceneLights.fill.color.set(profile.fill); sceneLights.fill.intensity = .45 * daylight * (ledStudio ? .4 : 1);
        sceneLights.rim.color.set(profile.accent); sceneLights.rim.intensity = .8 * accent * (ledStudio ? .7 : 1);
        sceneLights.hemi.color.set(profile.fill); sceneLights.hemi.groundColor.set('#746b61'); sceneLights.hemi.intensity = profile.ambient * (ledStudio ? .45 : 1);
        if (measured && workspaceRoom?.root) {
            configureRoomLightRig(workspaceRoom, sceneLights, measured.mode);
            sceneLights.fill.intensity *= measured.mode === 'night' || measured.mode === 'party' ? (measured.id === 'home' ? .25 : .35) : 1;
            workspaceRoom.roomAtmosphere?.(measured.mode, accent);
            workspaceRoom.life?.apply(measured.mode);
            workspaceRoom.life?.lightActivity();
        }
    }
    for (const [id, value] of [['studio-exposure', exposure], ['studio-daylight', daylight], ['studio-accent', accent]]) {
        const input = document.getElementById(id); if (input) input.value = value;
        const output = document.getElementById(`${id}-value`); if (output) output.textContent = `${Number(value).toFixed(2)}×`;
    }
    const label = document.getElementById('scene-light-name'); if (label) label.textContent = profile.label;
    updateTouchscreenDisplay();
}

function syncGrooveUI(state) {
    for (const panel of document.querySelectorAll('.groove-controls')) {
        const start = panel.querySelector('[data-groove-start]');
        start.disabled = !roomGroove?.prepared?.plan || !!roomGroove?.run;
        start.textContent = roomGroove?.prepared?.plan?.ok === false ? 'Check route' : 'Start Groove';
        panel.querySelector('[data-groove-stop]').disabled = !roomGroove?.run;
        panel.querySelector('[data-groove-status]').textContent = state.message;
    }
}
function grooveFootprint() {
    if (!loadedModel || !workspaceRoom?.roomLayout) return null;
    return withNeutralPose(() => {
        const savedYaw = deskYaw;
        deskYaw = 0; applyDeskTransform();
        try {
            loadedModel.updateWorldMatrix(true, true); workspaceRoom.root.updateWorldMatrix(true, false);
            const inverse = workspaceRoom.root.matrixWorld.clone().invert(), box = new THREE.Box3();
            loadedModel.traverseVisible(o => {
                if (!o.isMesh || !o.geometry || o.material?.isShaderMaterial) return;
                if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
                box.union(o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));
            });
            const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
            return { halfWidth: size.x / 2, halfDepth: size.z / 2, offsetX: center.x, offsetZ: center.z, margin: 45 };
        } finally { deskYaw = savedYaw; applyDeskTransform(); }
    });
}
function grooveController() {
    if (roomGroove) return roomGroove;
    roomGroove = new RoomGroove({
        get room() { return workspaceRoom; }, get sceneId() { return selectedRoomScene; },
        mode: phase => measuredRoomProfile().modes[phase],
        pose: () => ({ x: -glideOffset.z / workspaceRoom.root.scale.x, z: glideOffset.x / workspaceRoom.root.scale.x, yaw: deskYaw }),
        footprint: grooveFootprint, height: () => liftToHeight(currentLift), tilt: () => primaryTiltConfig()?.currentDeg || 0,
        safeHeight: (h,t) => Math.max(h, minimumHeightForTilt(t, currentConfig.size)),
        sync: syncGrooveUI, halt: haltAllMotion,
        stopPose: () => { glideTarget.copy(glideOffset); targetLift = currentLift; tiltTarget = null; manualLiftOverride = false; },
        canMove: () => {
            if(roomSafety.alert){syncSafetyUI();return false;}
            if (!loadedModel || liveAR?.active || transformControl?.object || isSelectionMode) { notifyUser('Turn off the editing tools before starting Groove.'); return false; }
            controls.autoRotate = false; return true;
        },
        manual: () => !!(glideInput.lengthSq() || yawCommand || liftJog || tiltJog || glideActive || transformControl?.object),
        goPose: (h,t) => { grooveSettingPose = true; try { goToPose(h,t); } finally { grooveSettingPose = false; } },
        move: p => {
            const before=deskCollisionBox(),oldYaw=deskYaw,turn = p.yaw - deskYaw;
            deskYaw = p.yaw;applyDeskTransform();loadedModel.updateMatrixWorld(true);
            const stop=before&&roomInteractions?.turnSafety(before,deskCollisionBox());
            if(stop?.blocked){deskYaw=oldYaw;applyDeskTransform();loadedModel.updateMatrixWorld(true);if(stop.event)announceRoomSafety(stop.event);return;}
            spinWheelsForYaw(turn);
            applyGlideOffset(new THREE.Vector3(p.z * workspaceRoom.root.scale.x, 0, -p.x * workspaceRoom.root.scale.x),{collide:true});
            glideTarget.copy(glideOffset); loadedModel.updateMatrixWorld(true); workspaceAccessories?.update();
        },
        dress: (phase, mode) => { workspaceAccessories?.setDayDress(phase); if (mode.color) setLedColor(mode.color, false); setLedsEnabled(mode.leds); }
    });
    return roomGroove;
}
async function prepareGrooveMode(sceneId, phase) {
    if (selectedRoomScene !== sceneId || !measuredRoomProfile(sceneId)?.modes[phase]) return;
    haltAllMotion(); setMeasuredRoomMode(sceneId, phase, false);
    await grooveController().prepare(sceneId, phase);
}
function positionHomeDesk(useModePose = false) {
    const profile = measuredRoomProfile();
    if (!loadedModel || !workspaceRoom?.roomLayout || !profile) return;
    const layout = workspaceRoom.roomLayout, mode = profile.modes[profile.mode], scale = workspaceRoom.root.scale.x;
    haltAllMotion();
    // A room/desktop-size change starts in its authored desk bay. Time-button
    // destinations belong to Groove; an old saved social phase must not spawn
    // a wider, rotated desk inside the bed or a neighbouring workstation.
    deskYaw = useModePose ? THREE.MathUtils.degToRad(mode.yaw) : 0;
    const f = grooveFootprint(), c = Math.cos(deskYaw), s = Math.sin(deskYaw);
    const ex = Math.abs(c) * f.halfWidth + Math.abs(s) * f.halfDepth + 70;
    const ez = Math.abs(s) * f.halfWidth + Math.abs(c) * f.halfDepth + 70;
    const ox = c * f.offsetX + s * f.offsetZ, oz = -s * f.offsetX + c * f.offsetZ;
    const fit = (value, min, max) => min > max ? (min + max) / 2 : THREE.MathUtils.clamp(value, min, max);
    const x = fit(layout.desk[0] + (useModePose ? mode.offset[0] : 0), -layout.width / 2 + ex - ox, layout.width / 2 - ex - ox);
    const z = fit(layout.desk[1] + (useModePose ? mode.offset[1] : 0), layout.back + ez - oz, layout.back + layout.depth - ez - oz);
    const next = new THREE.Vector3(z * scale, 0, -x * scale);
    applyGlideOffset(next); glideTarget.copy(glideOffset);
    loadedModel.updateMatrixWorld(true); workspaceAccessories?.update();
}

function syncHomeOfficeUI() {
    const shell = document.getElementById('viewer-shell');
    if (shell) { if (selectedRoomScene === 'home') shell.dataset.homeMode = homeMode; else delete shell.dataset.homeMode; }
    const active = measuredRoomProfile();
    if (shell) { if (active) shell.dataset.roomMode = active.mode; else delete shell.dataset.roomMode; }
    for (const id of ['home', 'gaming', 'music', 'creative', 'study', 'office', 'gym', 'kitchen', 'lounge', 'workshop', 'bedroom', 'gallery', 'scifi', 'coworking', 'library']) {
        const profile = measuredRoomProfile(id), prefix = profile.prefix;
        const panel = document.getElementById(measuredRoomPanelId(id));
        if (!panel) continue;
        panel.hidden = selectedRoomScene !== id;
        panel.querySelector(`[data-${prefix}-description]`).textContent = profile.modes[profile.mode].description + ' · ' + ROOM_STORIES[id][DAY_PHASES.indexOf(profile.mode)] + (['office', 'coworking'].includes(id) ? ` · ${profile.layout.stations.length + 1} ErgoFlex desks · App controls the Main desk` : '');
        panel.querySelector(`#${prefix}-room-size`).value = profile.layout.id;
        panel.querySelectorAll(`[data-${prefix}-mode]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(`data-${prefix}-mode`) === profile.mode)));
        panel.querySelectorAll(`[data-${prefix}-size]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(`data-${prefix}-size`) === currentConfig.size)));
    }
    const caption = document.getElementById('room-scene-caption');
    const feet = mm => { const inches = Math.round(mm / 25.4); return `${Math.floor(inches / 12)}′${inches % 12}″`; };
    if (active && caption) {
        const { layout } = active, mode = active.modes[active.mode];
        caption.textContent = `${layout.name} · ${feet(layout.width)} × ${feet(layout.depth)} (${layout.width / 1000} × ${layout.depth / 1000} m) · ${layout.height / 1000} m ceiling · ${mode.label}`;
    }
}

function setHomeLayout(id) {
    setMeasuredRoomLayout('home', id);
}
function setGamingLayout(id) { setMeasuredRoomLayout('gaming', id); }
function setMusicLayout(id) { setMeasuredRoomLayout('music', id); }
function setArtistLayout(id) { setMeasuredRoomLayout('creative', id); }
function setOfficeLayout(id) { setMeasuredRoomLayout('office', id); }
function setBedroomLayout(id) { setMeasuredRoomLayout('bedroom', id); }
function setGalleryLayout(id) { setMeasuredRoomLayout('gallery', id); }
function setLibraryLayout(id) { setMeasuredRoomLayout('library', id); }
function setCoworkingLayout(id) { setMeasuredRoomLayout('coworking', id); }
function setScifiLayout(id) { setMeasuredRoomLayout('scifi', id); }
function setWorkshopLayout(id) { setMeasuredRoomLayout('workshop', id); }
function setLoungeLayout(id) { setMeasuredRoomLayout('lounge', id); }
function setKitchenLayout(id) { setMeasuredRoomLayout('kitchen', id); }
function setGymLayout(id) { setMeasuredRoomLayout('gym', id); }
function setStudyLayout(id) { setMeasuredRoomLayout('study', id); }
function setMeasuredRoomLayout(sceneId, id) {
    if (!measuredRoomProfile(sceneId)?.layouts[id]) return;
    if (sceneId === 'home') homeLayoutId = id;
    else if (sceneId === 'gaming') gamingLayoutId = id;
    else if (sceneId === 'music') musicLayoutId = id;
    else if (sceneId === 'creative') artistLayoutId = id;
    else if (sceneId === 'study') studyLayoutId = id;
    else if (sceneId === 'office') officeLayoutId = id;
    else if (sceneId === 'gym') gymLayoutId = id;
    else if (sceneId === 'kitchen') kitchenLayoutId = id;
    else if (sceneId === 'workshop') workshopLayoutId = id;
    else if (sceneId === 'bedroom') bedroomLayoutId = id;
    else if (sceneId === 'gallery') galleryLayoutId = id;
    else if (sceneId === 'scifi') scifiLayoutId = id;
    else if (sceneId === 'coworking') coworkingLayoutId = id;
    else if (sceneId === 'library') libraryLayoutId = id;
    else loungeLayoutId = id;
    try { localStorage.setItem(`ergoflex.${sceneId}Layout`, id); } catch {}
    setRoomScene(sceneId, false);
    workspaceRoom.ready.then(() => {
        if (selectedRoomScene !== sceneId) return;
        const view = document.getElementById('camera-view');
        if (view?.value === 'room') view.dispatchEvent(new Event('change'));
    });
}

function setHomeMode(id, moveDesk = true) {
    setMeasuredRoomMode('home', id, moveDesk);
}
function setGamingMode(id, moveDesk = true) { setMeasuredRoomMode('gaming', id, moveDesk); }
function setMusicMode(id, moveDesk = true) { setMeasuredRoomMode('music', id, moveDesk); }
function setArtistMode(id, moveDesk = true) { setMeasuredRoomMode('creative', id, moveDesk); }
function setOfficeMode(id, moveDesk = true) { setMeasuredRoomMode('office', id, moveDesk); }
function setBedroomMode(id, moveDesk = true) { setMeasuredRoomMode('bedroom', id, moveDesk); }
function setGalleryMode(id, moveDesk = true) { setMeasuredRoomMode('gallery', id, moveDesk); }
function setLibraryMode(id, moveDesk = true) { setMeasuredRoomMode('library', id, moveDesk); }
function setCoworkingMode(id, moveDesk = true) { setMeasuredRoomMode('coworking', id, moveDesk); }
function setScifiMode(id, moveDesk = true) { setMeasuredRoomMode('scifi', id, moveDesk); }
function setWorkshopMode(id, moveDesk = true) { setMeasuredRoomMode('workshop', id, moveDesk); }
function setLoungeMode(id, moveDesk = true) { setMeasuredRoomMode('lounge', id, moveDesk); }
function setKitchenMode(id, moveDesk = true) { setMeasuredRoomMode('kitchen', id, moveDesk); }
function setGymMode(id, moveDesk = true) { setMeasuredRoomMode('gym', id, moveDesk); }
function setStudyMode(id, moveDesk = true) { setMeasuredRoomMode('study', id, moveDesk); }
function setMeasuredRoomMode(sceneId, id, moveDesk = true) {
    if (roomGroove?.prepared) { haltAllMotion(); roomGroove.reset(); }
    const profile = measuredRoomProfile(sceneId);
    if (!profile?.modes[id]) return;
    if (sceneId === 'home') homeMode = id;
    else if (sceneId === 'gaming') gamingMode = id;
    else if (sceneId === 'music') musicMode = id;
    else if (sceneId === 'creative') artistMode = id;
    else if (sceneId === 'study') studyMode = id;
    else if (sceneId === 'office') officeMode = id;
    else if (sceneId === 'gym') gymMode = id;
    else if (sceneId === 'kitchen') kitchenMode = id;
    else if (sceneId === 'workshop') workshopMode = id;
    else if (sceneId === 'bedroom') bedroomMode = id;
    else if (sceneId === 'gallery') galleryMode = id;
    else if (sceneId === 'scifi') scifiMode = id;
    else if (sceneId === 'coworking') coworkingMode = id;
    else if (sceneId === 'library') libraryMode = id;
    else loungeMode = id;
    try { localStorage.setItem(`ergoflex.${sceneId}Mode`, id); } catch {}
    if (selectedRoomScene === sceneId) {
        if (workspaceRoom?.life?.mode !== id) {
            // Return selected room props from the gizmo proxy before staging.
            for (const { obj } of [...movingObjects]) if (obj.userData?.sceneAsset) toggleMovingObject(obj, false, true);
            updateTransformProxy();
            discardSceneAssetUndoEntries();
        }
        delete roomLightSettings[sceneId];
        try { localStorage.setItem('ergoflex.sceneLights', JSON.stringify(roomLightSettings)); } catch {}
        if (moveDesk && loadedModel) {
            positionHomeDesk(true);
            const mode = profile.modes[id]; goToPose(mode.height, mode.tilt);
            if (mode.color) setLedColor(mode.color, false);
            setLedsEnabled(mode.leds);
            workspaceAccessories?.setDayDress(id);
        }
        applyRoomLighting();
    }
    syncHomeOfficeUI();
}

function setRoomScene(id, persist = true, { preserveDesk = false } = {}) {
    if (roomGroove) { haltAllMotion(); roomGroove.reset(); }
    const choice = ROOM_SCENES.find(s => s.id === id) || ROOM_SCENES[0];
    const measured = measuredRoomProfile(choice.id);
    if (loadedModel && measured && !homeDeskReturn && !workspaceRoom?.roomLayout) homeDeskReturn = { offset: glideOffset.clone(), yaw: deskYaw };
    if (loadedModel && measuredRoomProfile() && !measured && homeDeskReturn) {
        haltAllMotion(); deskYaw = homeDeskReturn.yaw; applyGlideOffset(homeDeskReturn.offset); glideTarget.copy(glideOffset); homeDeskReturn = null;
    }
    const hydrationToken = ++sceneAssetHydrationToken;
    if (choice.id !== selectedRoomScene || sceneAssetRegistry.size) {
        persistSceneAssetStates();
        discardSceneAssetUndoEntries();
        clearSceneAssetRegistration();
    }
    selectedRoomScene = choice.id;
    let homeScale;
    if (measured && loadedModel) {
        const reference = arSizeReference();
        // Nominal desktop inches establish the room's physical units. An AR
        // calibration preference does not silently resize this architecture.
        homeScale = reference.widthUnits > 0 ? reference.widthUnits / (reference.nominalWidth * 25.4) : 1 / (reference.metersPerUnit * 1000);
    }
    if (choice.id === 'gaming' && !gamingLayoutId) gamingLayoutId = measured.layout.id;
    if (choice.id === 'music' && !musicLayoutId) musicLayoutId = measured.layout.id;
    if (choice.id === 'creative' && !artistLayoutId) artistLayoutId = measured.layout.id;
    if (choice.id === 'study' && !studyLayoutId) studyLayoutId = measured.layout.id;
    if (choice.id === 'bedroom' && !bedroomLayoutId) bedroomLayoutId = measured.layout.id;
    if (choice.id === 'gallery' && !galleryLayoutId) galleryLayoutId = measured.layout.id;
    if (choice.id === 'library' && !libraryLayoutId) libraryLayoutId = measured.layout.id;
    if (choice.id === 'coworking' && !coworkingLayoutId) coworkingLayoutId = measured.layout.id;
    if (choice.id === 'scifi' && !scifiLayoutId) scifiLayoutId = measured.layout.id;
    if (choice.id === 'workshop' && !workshopLayoutId) workshopLayoutId = measured.layout.id;
    if (choice.id === 'lounge' && !loungeLayoutId) loungeLayoutId = measured.layout.id;
    if (choice.id === 'kitchen' && !kitchenLayoutId) kitchenLayoutId = measured.layout.id;
    if (choice.id === 'gym' && !gymLayoutId) gymLayoutId = measured.layout.id;
    if (choice.id === 'office' && !officeLayoutId) officeLayoutId = measured.layout.id;
    roomInteractions?.end();roomInteractions?.select(null);roomLedSpill.dispose();roomCollisionBlocked=false;roomSafety.reset();syncSafetyUI();
    workspaceRoom?.set(choice.id, { size: currentConfig.size, scale: homeScale, layout: measured?.layout.id,
        createStation: ['office', 'coworking'].includes(choice.id) && loadedModel ? spec => captureOfficeStation(spec, homeScale) : null });
    if (measured) {
        if (!preserveDesk) positionHomeDesk();
        if (!preserveDesk && persist && loadedModel) {
            const mode = measured.modes[measured.mode]; goToPose(mode.height, mode.tilt);
            if (mode.color) setLedColor(mode.color, false);
            setLedsEnabled(mode.leds);
        }
    }
    // Room props and desk dressing load over the network. A failure leaves the
    // procedural room standing and is reported in Build checks rather than
    // only in the console.
    const roomReady = workspaceRoom?.ready || Promise.resolve();
    const dressReady = workspaceAccessories?.dress(choice.id) || Promise.resolve();
    const assetsReady = Promise.allSettled([roomReady, dressReady]).then(async results => {
        if (results[0].status === 'rejected') {
            reportSceneWarning('room-props', `Scene props for ${choice.name} could not be loaded (${results[0].reason.message}). The room is shown without them.`);
        }
        if (results[1].status === 'rejected') {
            reportSceneWarning('desk-dressing', `Desk dressing for ${choice.name} could not be loaded (${results[1].reason.message}).`);
        }
        if(hydrationToken!==sceneAssetHydrationToken)return;
        // Give procedural furnishings stable editor IDs before restoring placements.
        roomInteractions?.bind(workspaceRoom);
        await hydrateSceneAssets(choice.id, hydrationToken);
        if (hydrationToken === sceneAssetHydrationToken) {
            workspaceAccessories?.setDayDress(measuredRoomProfile()?.mode || 'morning');
            roomInteractions?.bind(workspaceRoom);roomLedSpill.bind(workspaceRoom);
        }
    });
    if (workspaceRoom) workspaceRoom.ready = assetsReady;
    if (floorMesh) floorMesh.visible = choice.id === 'product';
    const shell = document.getElementById('viewer-shell');
    if (shell) shell.dataset.roomScene = choice.id;
    document.querySelectorAll('[data-room-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.roomScene === choice.id)));
    const caption = document.getElementById('room-scene-caption');
    if (caption) {
        const [wide, rear, front] = ROOM_ATMOSPHERES[choice.id].space;
        caption.textContent = choice.id === 'product' ? 'Explore your desk from every angle.' : `${((4200 + wide * 2) / 1000).toFixed(1)} × ${((4000 + rear + front) / 1000).toFixed(1)} m · ${ROOM_ATMOSPHERES[choice.id].label} · Furnishings for inspiration`;
    }
    const heading = document.querySelector('.viewer-heading h2');
    const interactionHint=document.getElementById('room-interaction-hint');
    if(interactionHint)interactionHint.hidden=choice.id==='product';
    if (heading) heading.textContent = choice.id === 'product' ? 'Designed to move you.' : choice.caption;
    const environment = document.getElementById('studio-environment');
    if (environment) environment.value = choice.tone;
    if (shell) shell.dataset.environment = choice.tone;
    applyRoomLighting();
    syncHomeOfficeUI();
    updateSceneLibraryStatus();
    if (persist) {
        try { localStorage.setItem('ergoflex.roomScene', choice.id); } catch {}
    }
    // The camera is deliberately left alone. Changing the room used to fire a
    // change on #camera-view, which snapped to a preset - so every scene switch
    // threw away wherever you had orbited to. Swapping the backdrop is not a
    // reason to move the viewer.
    requestAnimationFrame(syncViewerSize);
}
function notifyUser(message) {
    const toast = document.getElementById('studio-toast');
    toast.textContent = message; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.hidden = true, 4500);
}
function persistCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cartItems)); }
    catch { notifyUser('Build list is available for this visit. Browser storage is unavailable.'); }
    updateCartUI();
}
function syncBuildSummary() {
    const el = document.getElementById('build-summary');
    if (el) el.textContent = `${currentConfig.woodFinish} / ${currentConfig.baseFinish}`;
    const size = document.getElementById('size-preview-note');
    if (size) size.textContent = `Selected: ${PRODUCT_CONFIG.sizes[currentConfig.size].name}. The 3D desktop and trim match this size.`;
}
// Applies the current sheen to every material role, and derives each wood
// surface's texture repeat from its own size in inches so grain scale stays
// physically constant as the desk changes size.
function applySurfaceFinish() {
    const treatment = key => SURFACE_TREATMENTS[key][surfaceFinish] || SURFACE_TREATMENTS[key].satin;
    const species = woodSpecies(currentConfig.woodFinish);

    woodMaterials.forEach((material, role) => {
        const { roughness, clearcoat } = treatment('wood');
        material.roughness = roughness;
        material.clearcoat = clearcoat;
        const texture = grainEnabled ? woodTextureFor(currentConfig.woodFinish, role) : null;
        if (texture) applyGrainScale(texture, role, species);
        material.map = texture;
        material.bumpMap = texture;
        // Species may raise their own relief, and drive roughness from the same
        // image. A near-black finish has its albedo variation scaled away with
        // everything else, so its grain has to be carried by shading and by
        // varying gloss - which is how black-stained timber reads in the first place.
        material.bumpScale = (role === 'edge' ? 0.0016 : (species.bumpScale || 0.0006)) * grainVisibility / 100;
        const roughnessTexture = texture && species.grainSheen && role !== 'edge' && grainSheen > 0
            ? grainRoughnessTexture(texture, role) : null;
        if (roughnessTexture) applyGrainScale(roughnessTexture, role, species);
        material.roughnessMap = roughnessTexture;
        material.needsUpdate = true;
    });

    if (sharedBasePaintMaterial) {
        const { roughness, clearcoat } = treatment('powder');
        sharedBasePaintMaterial.roughness = roughness;
        sharedBasePaintMaterial.clearcoat = clearcoat;
        sharedBasePaintMaterial.needsUpdate = true;
    }
    if (sharedPolishedAluminumMaterial) {
        const { roughness } = treatment('aluminium');
        sharedPolishedAluminumMaterial.roughness = roughness;
        sharedPolishedAluminumMaterial.metalness = 1.0;
        sharedPolishedAluminumMaterial.needsUpdate = true;
    }
    if (sharedBlackPlasticMaterial) {
        const { roughness, clearcoat } = treatment('plastic');
        sharedBlackPlasticMaterial.roughness = roughness;
        sharedBlackPlasticMaterial.clearcoat = clearcoat;
        sharedBlackPlasticMaterial.needsUpdate = true;
    }
}

// A species change swaps the map on every wood role and retints. Natural Birch
// keeps its photographic albedo unmodulated; the generated species already carry
// their own colour, so they are tinted only lightly to preserve the swatch
// relationship without washing the grain out.
// The photograph carries the grain; the tint carries the species. Multiplying a
// light birch surface by a near-black tint is what makes Black Birch read as satin
// black wood while keeping the grain visible in it.
function applyWoodSpecies(finish) {
    const tint = woodSpecies(finish.name).tint || '#ffffff';
    woodMaterials.forEach(material => material.color.set(tint));
    applySurfaceFinish();
}

// A duplicate of the photograph, processed for a finish that the original tone
// would fight. Two problems, both from tinting a warm cream surface toward black:
//
//   grayscale - the photograph's own colour survives the tint and the result
//               reads as dark brown. Reducing the duplicate to luminance first
//               leaves a neutral base, so the tint alone decides the colour.
//   boost     - multiplying down scales the grain variation down with it, and on
//               a surface this pale there was nothing left to see. Stretching
//               contrast about the image's own mean keeps the grain legible.
//
// The source photograph is untouched; light finishes still use it at full tone.
function processGrainPhoto(base, { grayscale = false, boost = 1 } = {}) {
    const image = base.image;
    if (!image || !image.width) return base;
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    if (grayscale) {
        for (let i = 0; i < px.length; i += 4) {
            const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            px[i] = px[i + 1] = px[i + 2] = luma;
        }
    }
    if (boost !== 1) {
        let mean = 0;
        for (let i = 0; i < px.length; i += 4) mean += (px[i] + px[i + 1] + px[i + 2]) / 3;
        mean /= (px.length / 4);
        for (let i = 0; i < px.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                px[i + c] = Math.max(0, Math.min(255, mean + (px[i + c] - mean) * boost));
            }
        }
    }
    context.putImageData(data, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = base.anisotropy;
    return texture;
}

// Face veneer is photographic for every species. The edge stays generated: it is
// stacked plywood laminations, which is not what a face photograph shows.
function woodTextureFor(name, role) {
    const spec = woodSpecies(name);
    if (spec.photo && role !== 'edge') {
        const base = loadSpeciesPhoto(spec.photo);
        if (!base) return generateGrainTexture(name, role);
        // One Texture carries one repeat, so each role needs its own view of the
        // image or whichever role ran last would set the grain scale for all of
        // them and the physical scaling would silently not hold. Keyed by path,
        // so finishes sharing an image share these clones too.
        const boost = (spec.contrastBoost || 1) * grainVisibility / 100;
        const grayscale = !!spec.grayscale;
        const key = spec.photo + '|photo|' + boost + (grayscale ? '|bw' : '') + '|' + role;
        if (!speciesTextures.has(key)) {
            const source = (boost === 1 && !grayscale)
                ? base
                : processGrainPhoto(base, { grayscale, boost });
            const perRole = source.clone();
            perRole.needsUpdate = true;
            speciesTextures.set(key, perRole);
        }
        return speciesTextures.get(key);
    }
    return generateGrainTexture(name, role);
}

// Grain scale is physical: a 60in top gets 1.25x the repeats of a 48in top, so
// the grain stays the same size rather than stretching with the surface.
function applyGrainScale(texture, role, species) {
    const size = surfaceInches(role);
    texture.repeat.set(Math.max(0.25, size.w * species.repeatsPerInch),
                       Math.max(0.25, size.d * species.repeatsPerInch));
    // The two birch finishes share the same face photograph. Turn its grain
    // across the UVs while leaving the generated plywood edge laminations alone.
    texture.rotation = species.photo === './bir.jpg' && role !== 'edge' ? Math.PI / 2 : 0;
    texture.center.set(0.5, 0.5);
    texture.needsUpdate = true;
}

// The measured dimensions of each wood surface, in inches. Falls back to the
// reference assembly's numbers before the model has loaded.
function surfaceInches(role) {
    const fallback = { desktop: { w: 44, d: 32 }, shelf: { w: 43, d: 15 }, edge: { w: 44, d: 3.5 },
                       wing: { w: 35, d: 18 } }[role]
        || { w: 44, d: 32 };
    if (!loadedModel) return fallback;
    const names = { desktop: ['Desktop_3'], shelf: ['Top_Shelf_3'], edge: ['Desktop'],
                    wing: ['Desktop_1'] }[role] || [];
    const box = new THREE.Box3();
    let found = false;
    partRegistry.forEach(entry => {
        if (!names.includes(entry.name)) return;
        box.expandByObject(entry.obj);
        found = true;
    });
    if (!found || box.isEmpty()) return fallback;
    const size = box.getSize(new THREE.Vector3());
    const perWorld = worldToInches();
    // The side panels stand upright, so their visible face is spanned by Z and Y.
    // Measuring them on the horizontal Z-by-X plane would read the 0.7in
    // thickness as the depth and smear the grain up the panel.
    if (role === 'wing') return { w: size.z * perWorld, d: size.y * perWorld };
    // Z is the width axis in this asset and X the depth (docs/sizing-gate.md).
    return { w: size.z * perWorld, d: size.x * perWorld };
}

// Inches per world unit, derived from the lift calibration the rest of the app
// already trusts.
function worldToInches() {
    const scale = loadedModel ? loadedModel.scale.x : 1;
    return (HEIGHT_MAX - HEIGHT_MIN) / ((LIFT_MAX - LIFT_MIN) * scale);
}
function downloadFile(name, text, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadEstimate(items) {
    const lines = ['ERGOFLEX — CUSTOM SHOP', 'Configuration estimate · ' + new Date().toLocaleDateString(), ''];
    items.forEach((item, i) => {
        lines.push(`${i + 1}. ErgoFlex · ${PRODUCT_CONFIG.sizes[item.size].name}`, `   ${item.woodFinish} desktop / ${item.baseFinish} frame`);
        for (const line of priceBreakdown(item)) lines.push(`   ${line.label}${line.provisional ? '*' : ''}: ${money(line.price)}`);
        lines.push(`   Quantity ${item.quantity} × ${money(item.price)} = ${money(item.quantity * item.price)}`, '');
    });
    if (items.some(item => item.accessories?.length)) lines.push('* Accessory prices are provisional estimates per desk; availability and mounting fit need confirmation.', '');
    lines.push('Estimated total: ' + money(items.reduce((sum, i) => sum + i.price * i.quantity, 0)), '', 'Design preview only. Taxes, delivery, availability, and final specifications require confirmation.');
    downloadFile('ErgoFlex-estimate.txt', lines.join('\n'));
    notifyUser('Your configuration estimate has been downloaded.');
}
function openDialog(modal) {
    if (modal.classList.contains('hidden')) dialogReturnFocus = document.activeElement;
    modal.classList.remove('hidden'); modal.focus();
}
function closeDialog(modal) {
    modal.classList.add('hidden'); dialogReturnFocus?.focus();
}
function showAllParts() {
    if (isolatedVisibility) isolatedVisibility.forEach((visible, obj) => obj.visible = visible);
    isolatedVisibility = null;
    document.getElementById('isolate-parts')?.setAttribute('aria-pressed', 'false');
}
// A short eased move instead of a jump. The presets and every shortcut go
// through this, so framing is consistent wherever it is triggered from.
const cameraTween = { active: false, t: 0, duration: 0.4, fallback: null,
    fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(), toTarget: new THREE.Vector3() };

function startCameraTween(toPos, toTarget) {
    cameraTween.fromPos.copy(camera.position);
    cameraTween.fromTarget.copy(controls.target);
    cameraTween.toPos.copy(toPos);
    cameraTween.toTarget.copy(toTarget);
    cameraTween.t = 0;
    cameraTween.active = true;
    // The tween advances in the render loop. A throttled or hidden tab stops
    // delivering frames, and the camera would simply never arrive — so promise
    // the end state on a timer, which keeps running, and snap to it if the
    // animation has not finished on its own.
    clearTimeout(cameraTween.fallback);
    cameraTween.fallback = setTimeout(() => {
        if (!cameraTween.active) return;
        cameraTween.active = false;
        camera.position.copy(cameraTween.toPos);
        controls.target.copy(cameraTween.toTarget);
        controls.update();
    }, cameraTween.duration * 1000 + 250);
}

function updateCameraTween(dt) {
    if (!cameraTween.active) return;
    cameraTween.t = Math.min(1, cameraTween.t + dt / cameraTween.duration);
    const e = cameraTween.t < 0.5
        ? 4 * cameraTween.t ** 3
        : 1 - Math.pow(-2 * cameraTween.t + 2, 3) / 2;   // ease-in-out cubic
    camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, e);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, e);
    controls.update();
    if (cameraTween.t >= 1) cameraTween.active = false;
}

// The named sub-assemblies a viewer actually wants to look at. Resolved live,
// because rigs reparent their parts and the wrappers are the right thing to
// frame once they exist.
const DEFAULT_MIN_DISTANCE = 2;
const CLOSEUP_MIN_DISTANCE = 0.35;

function cameraShortcutTargets(key) {
    if (!loadedModel) return [];
    const byPrefix = prefixes => {
        const out = [];
        partRegistry.forEach(entry => {
            if (prefixes.some(p => entry.name === p || entry.name.startsWith(p))) out.push(entry.obj);
        });
        return out;
    };
    switch (key) {
        case 'desk': return [loadedModel];
        case 'desktop': {
            const tilt = tiltConfigs.find(c => c.wrapperGroup);
            return tilt ? [tilt.wrapperGroup] : byPrefix(['Desktop', 'Top_Shelf']);
        }
        case 'wheels': return wheelRigs.length ? wheelRigs.map(r => r.wrapper) : byPrefix(['Wheel_']);
        case 'actuators': return actuatorRigs.length
            ? actuatorRigs.flatMap(r => [r.cylWrapper, r.rodWrapper, r.targetObj].filter(Boolean))
            : byPrefix(['Linear_Actuators', 'L_A_Hardware_Top']);
        case 'columns': return byPrefix(['Lift_Column']);
        default: return [loadedModel];
    }
}

// Sub-assemblies are small. OrbitControls clamps to minDistance 2 and
// focusObjects respects that clamp, so a wheel or a clevis would be framed no
// closer than 2 world units — not a close-up at all. Drop the floor while a
// close-up is active and restore it on reset.
function focusCameraShortcut(key) {
    const objects = cameraShortcutTargets(key);
    if (!objects.length) return notifyUser('That assembly is not in the current model.');
    controls.minDistance = key === 'desk' ? DEFAULT_MIN_DISTANCE : CLOSEUP_MIN_DISTANCE;
    focusObjects(objects, { animate: true });
}

function focusObjects(objects, { animate = false } = {}) {
    if (!camera || !controls || !objects.length) return;
    if (loadedModel && objects.includes(loadedModel)) objects = [...objects, ...(workspaceAccessories?.objects() || [])];
    const box = new THREE.Box3(); objects.forEach(obj => box.expandByObject(obj));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const direction = camera.position.clone().sub(controls.target).normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
    let distance = controls.minDistance;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new THREE.Vector3(x, y, z).sub(center);
        const depth = point.dot(direction);
        distance = Math.max(distance, depth + Math.abs(point.dot(up)) / tanV, depth + Math.abs(point.dot(right)) / tanH);
    }
    // Measured halls can exceed the product viewer's original zoom limit.
    // Allow the distance required to frame the complete room at this aspect.
    if (workspaceRoom?.root && objects.includes(workspaceRoom.root)) controls.maxDistance = Math.max(30, distance * 1.12);
    distance = Math.min(controls.maxDistance, distance * 1.12);
    const position = center.clone().addScaledVector(direction, distance);
    controls.autoRotate = false;
    if (animate) {
        startCameraTween(position, center);
    } else {
        cameraTween.active = false;
        controls.target.copy(center); camera.position.copy(position); controls.update();
    }
}

// Every section is visible at once now, so there is nothing to switch between.
// Kept because the viewer's Glide button and the debug surface both ask for a
// section by name: bring it into view and focus it instead.
function setMotionTab(tab) {
    const dock = document.getElementById('motion-dock');
    if (dock?.classList.contains('collapsed')) document.getElementById('motion-dock-toggle')?.click();
    const panel = document.querySelector(`[data-motion-panel="${tab}"]`);
    if (!panel) return;
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (tab === 'glide') document.getElementById('glide-pad')?.focus();
    if (tab !== 'glide') releaseGlideInput();
}
function initStudio() {
    const toast = document.createElement('div'); toast.id = 'studio-toast'; toast.role = 'status'; toast.hidden = true; document.body.append(toast);
    // V2 adds the accessories axis. A V1 payload is a valid V2 with an empty
    // accessory list, so migration is a read of the old key when the new one is
    // absent — no separate conversion step, and V1 data is left untouched.
    const readStored = (v2Key, v1Key) => {
        if (EVENT_DEMO) return null;
        try {
            const raw = localStorage.getItem(v2Key) ?? localStorage.getItem(v1Key);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    };
    try {
        const shared = EVENT_DEMO ? null : new URLSearchParams(location.search).get('build');
        const stored = shared ? JSON.parse(shared) : readStored(SAVED_BUILD_KEY, 'ergoflexSavedBuildV1');
        if (validConfig(stored)) currentConfig = cleanConfig(stored);
        if (shared && !validConfig(stored)) notifyUser('This build link is invalid. Showing the default configuration.');
    } catch { notifyUser('Saved configuration could not be read. Showing the default build.'); }
    try {
        const saved = readStored(CART_KEY, 'ergoflexCartV1') || [];
        if (Array.isArray(saved)) cartItems = saved.filter(validConfig).slice(0, 100).map((item, index) => ({ ...cleanConfig(item), id: `restored-${index}`, quantity: Math.max(1, Math.min(20, Math.round(Number(item.quantity) || 1))), price: configurationPrice(cleanConfig(item)) }));
    } catch {}
    // An accessory can become incompatible if the stored size no longer suits it.
    const dropped = incompatibleAccessories(currentConfig);
    if (dropped.length) {
        currentConfig.accessories = currentConfig.accessories.filter(id => accessoryFits(id, currentConfig.size));
        notifyUser(`${dropped.map(a => a.name).join(', ')} removed: not available for this size.`);
    }
    populateSizeOptions();
    applyConfigToUI();
    buildGuidedConfiguration();
    updateCartUI();
    document.getElementById('open-editor').onclick = () => setSetupLayout(true);
    document.getElementById('cart-btn').onclick = showCartModal;
    document.getElementById('export-cart').onclick = () => cartItems.length ? downloadEstimate(cartItems) : notifyUser('Add a configuration first.');
    document.getElementById('download-quote').onclick = () => downloadEstimate([{ ...currentConfig, price: configurationPrice(currentConfig), quantity: 1 }]);
    document.getElementById('save-build').onclick = () => {
        try { localStorage.setItem(SAVED_BUILD_KEY, JSON.stringify(currentConfig)); notifyUser('Build saved with your finishes, size and accessories.'); }
        catch { notifyUser('Browser storage is unavailable. Download an estimate to keep your build.'); }
    };
    // A saved build outranks the catalog default on every later visit, and there
    // was no way to take that back from the page - clearing it meant editing
    // localStorage by hand.
    document.getElementById('reset-build').onclick = () => {
        try { localStorage.removeItem(SAVED_BUILD_KEY); localStorage.removeItem('ergoflexSavedBuildV1'); } catch {}
        currentConfig = defaultConfig();
        applyConfigToUI();
        applyAccessoryVisibility();
        renderAccessories();
        updatePrice();
        notifyUser('Back to the standard build: ' + currentConfig.woodFinish + ' on ' + currentConfig.baseFinish + '.');
    };
    document.getElementById('share-build').onclick = async () => {
        const url = new URL(location.href); url.search = ''; url.searchParams.set('build', JSON.stringify(currentConfig));
        try { await navigator.clipboard.writeText(url.href); notifyUser('Configuration link copied.'); }
        catch { downloadFile('ErgoFlex-build-link.txt', url.href); notifyUser('Configuration link downloaded.'); }
    };
    const sizeNote = document.createElement('p'); sizeNote.id = 'size-preview-note'; sizeNote.className = 'studio-note'; sizeSelect.after(sizeNote);
    const materialOptions = document.createElement('div'); materialOptions.className = 'material-options';
    materialOptions.innerHTML = `<label>Surface sheen <select id="surface-finish"><option value="matte">Matte</option><option value="satin">Satin</option><option value="gloss" selected>Gloss</option></select></label><label class="check-label"><input id="wood-grain" type="checkbox" checked> Show wood grain</label><div class="grain-controls"><label for="grain-visibility">Grain visibility <output id="grain-visibility-value" for="grain-visibility">100%</output></label><input id="grain-visibility" type="range" min="0" max="100" value="100" aria-label="Grain visibility"><label for="grain-sheen">Grain sheen <output id="grain-sheen-value" for="grain-sheen">100%</output></label><input id="grain-sheen" type="range" min="0" max="100" value="100" aria-label="Grain sheen"></div><p class="studio-note">Grain visibility changes the wood pattern and relief. Grain sheen changes how strongly the pattern reflects light. The finish above sets the overall shine.</p>`;
    document.getElementById('selected-wood-name').after(materialOptions);
    document.getElementById('surface-finish').onchange = e => { surfaceFinish = e.target.value; applySurfaceFinish(); };
    document.getElementById('wood-grain').onchange = e => { grainEnabled = e.target.checked; applySurfaceFinish(); };
    document.getElementById('grain-visibility').oninput = e => {
        grainVisibility = Number(e.target.value);
        document.getElementById('grain-visibility-value').textContent = grainVisibility + '%';
        clearPhotoGrainTextures();
        applySurfaceFinish();
    };
    document.getElementById('grain-sheen').oninput = e => {
        grainSheen = Number(e.target.value);
        document.getElementById('grain-sheen-value').textContent = grainSheen + '%';
        applySurfaceFinish();
    };
    const looks = document.createElement('div'); looks.className = 'look-presets';
    looks.innerHTML = `<div class="eyebrow">A LITTLE INSPIRATION</div><div><button data-look="Natural Birch|White">Light & natural</button><button data-look="Walnut|Forest">Warm & grounded</button><button data-look="Black Birch|Black">All in black</button></div>`;
    document.getElementById('config-column').children[0].after(looks);
    looks.querySelectorAll('[data-look]').forEach(b => b.onclick = () => b.dataset.look.split('|').forEach((name, i) => {
        const type = i ? 'base' : 'wood';
        const finish = PRODUCT_CONFIG[i ? 'baseFinishes' : 'woodFinishes'].find(f => f.name === name);
        const swatch = [...document.querySelectorAll(`[data-material="${type}"]`)].find(el => el.dataset.finish === name);
        selectFinish(finish, type, swatch);
    }));
    const viewer = canvas.parentElement;
    const top = document.createElement('div'); top.className = 'viewer-heading';
    top.innerHTML = `<div class="eyebrow" id="scene-status">LOADING YOUR WORKSPACE</div><h2>Designed to move you.</h2><p id="build-summary"></p>`; viewer.append(top);
    const toolbar = document.createElement('div'); toolbar.className = 'studio-toolbar';
    toolbar.innerHTML = `<label><span>Backdrop</span><select id="studio-environment"><option value="gallery">Gallery</option><option value="warm">Warm studio</option><option value="slate" selected>Slate studio</option></select></label><label><span>Camera</span><select id="camera-view"><option value="hero">Perspective</option><option value="room">Whole room</option><option value="front">Front</option><option value="side">Side</option><option value="top">Top</option></select></label><button id="fit-view" title="Fit the whole desk in view">Fit</button><span class="camera-shortcuts" role="group" aria-label="Camera shortcuts"><button data-camera-focus="desktop" title="Frame the desktop and shelf">Desktop</button><button data-camera-focus="wheels" title="Frame the omni wheels">Wheels</button><button data-camera-focus="actuators" title="Frame the linear actuators">Actuators</button><button data-camera-focus="columns" title="Frame the lift columns">Columns</button></span><button id="rotate-scene" aria-pressed="false">Orbit</button><button id="grid-toggle" aria-pressed="false">Grid</button><button id="capture-view">Capture ↗</button><details class="render-settings"><summary>Light & quality</summary><div><p id="scene-light-name"></p><label>Exposure <output id="studio-exposure-value"></output><input id="studio-exposure" type="range" min="0.6" max="1.6" step="0.05" value="1.02"></label><label>Main light <output id="studio-daylight-value"></output><input id="studio-daylight" type="range" min="0.2" max="2" step="0.05" value="1"></label><label>Accent light <output id="studio-accent-value"></output><input id="studio-accent" type="range" min="0" max="2" step="0.05" value="1"></label><button id="reset-scene-light" type="button">Reset scene lighting</button><label>Quality<select id="render-quality"><option value="1">Balanced</option><option value="2" selected>High</option></select></label></div></details>`;
    toolbar.querySelector('#studio-environment').insertAdjacentHTML('beforeend', '<option value="led">LED studio</option>');
    const viewerControls = document.createElement('div'); viewerControls.className = 'viewer-controls';
    viewerControls.append(toolbar);
    const scenes = document.createElement('div'); scenes.className = 'scene-switcher';
    scenes.innerHTML = `<span class="scenes-label">Scenes</span><div class="scene-options" role="group" aria-label="Workspace scenes">${ROOM_SCENES.map(s => `<button type="button" data-room-scene="${s.id}" aria-pressed="${s.id === 'product'}"><span class="scene-dot scene-${s.id}" aria-hidden="true"></span>${s.name}</button>`).join('')}</div>`;
    const roomCaption = document.createElement('p'); roomCaption.id = 'room-scene-caption'; roomCaption.setAttribute('aria-live', 'polite');
    const interactionHint=document.createElement('p');interactionHint.id='room-interaction-hint';interactionHint.className='studio-note';interactionHint.hidden=true;
    interactionHint.textContent='Drag floor furnishings to move them; select one to rotate it. Drag wall decorations along their wall. Contact stops the desk until CLEAR. After clearing, small objects can be pushed. Turn on the shield to stop before contact.';
    const objectControls=document.createElement('div');objectControls.id='room-object-controls';objectControls.className='room-object-controls';objectControls.hidden=true;
    objectControls.innerHTML='<span data-room-object-name role="status"></span><button type="button" data-room-object-turn="-15" aria-label="Rotate selected furnishing left 15 degrees">↶ Rotate left</button><button type="button" data-room-object-turn="15" aria-label="Rotate selected furnishing right 15 degrees">Rotate right ↷</button><button type="button" data-room-object-done>Done</button>';
    objectControls.querySelectorAll('[data-room-object-turn]').forEach(button=>button.onclick=()=>roomInteractions?.rotateSelected(Number(button.dataset.roomObjectTurn)));
    objectControls.querySelector('[data-room-object-done]').onclick=()=>roomInteractions?.select(null);
    const roomControls = ['home', 'gaming', 'music', 'creative', 'study', 'office', 'gym', 'kitchen', 'lounge', 'workshop', 'bedroom', 'gallery', 'scifi', 'coworking', 'library'].map(id => {
        const profile = measuredRoomProfile(id), prefix = profile.prefix;
        const panel = document.createElement('div'); panel.id = measuredRoomPanelId(id);
        panel.className = 'measured-room-controls'; panel.hidden = true;
        panel.innerHTML = `<div class="home-layout-choices" role="group" aria-label="${ROOM_SCENES.find(s => s.id === id).name} size"><label for="${prefix}-room-size">Room</label><select id="${prefix}-room-size">${Object.values(profile.layouts).map(layout => `<option value="${layout.id}">${layout.name} · ${layout.width / 1000} × ${layout.depth / 1000} m</option>`).join('')}</select><button type="button" data-${prefix}-size="48x30">48″ desk</button><button type="button" data-${prefix}-size="60x30">60″ desk</button></div><div class="home-time-choices" role="group" aria-label="Time of day">${Object.entries(profile.modes).map(([modeId, mode]) => `<button type="button" data-${prefix}-mode="${modeId}" aria-pressed="false">${mode.label}</button>`).join('')}</div><p data-${prefix}-description></p>`;
        panel.querySelector(`#${prefix}-room-size`).onchange = e => setMeasuredRoomLayout(id, e.target.value);
        panel.querySelectorAll(`[data-${prefix}-size]`).forEach(b => b.onclick = () => { sizeSelect.value = b.getAttribute(`data-${prefix}-size`); sizeSelect.dispatchEvent(new Event('change', { bubbles: true })); });
        panel.insertAdjacentHTML('beforeend', '<div class="groove-controls"><button type="button" data-groove-start disabled>Start Groove</button><button type="button" data-groove-stop disabled>Stop</button><span data-groove-status role="status">Choose a time, then tap the desk to start its Groove.</span></div>');
        panel.querySelector('[data-groove-start]').onclick = () => grooveController().start();
        panel.querySelector('[data-groove-stop]').onclick = haltAllMotion;
        panel.querySelectorAll(`[data-${prefix}-mode]`).forEach(b => b.onclick = () => prepareGrooveMode(id, b.getAttribute(`data-${prefix}-mode`)));
        return panel;
    });
    viewerControls.append(scenes, ...roomControls, roomCaption, interactionHint, objectControls); viewer.append(viewerControls);
    scenes.querySelectorAll('button').forEach(button => button.onclick = () => setRoomScene(button.dataset.roomScene));
    new ResizeObserver(syncViewerSize).observe(viewerControls);
    try {
        const requestedRoom = new URLSearchParams(location.search).get('room');
        selectedRoomScene = EVENT_DEMO ? 'product' : ROOM_SCENES.some(s => s.id === requestedRoom) ? requestedRoom : localStorage.getItem('ergoflex.roomScene') || 'product';
    } catch {}
    setRoomScene(selectedRoomScene, false);
    const applyEnvironment = (value) => {
        document.getElementById('viewer-shell').dataset.environment = value;
        if (floorMesh) floorMesh.material.opacity = value === 'led' ? .42 : value === 'slate' ? .36 : .24;
        applyRoomLighting();
    };
    document.getElementById('studio-environment').onchange = e => applyEnvironment(e.target.value);
    document.getElementById('studio-environment').value = (ROOM_SCENES.find(s => s.id === selectedRoomScene) || ROOM_SCENES[0]).tone;
    applyEnvironment(document.getElementById('studio-environment').value);
    try {
        const saved = JSON.parse(localStorage.getItem('ergoflex.sceneLights') || '{}');
        for (const id of Object.keys(ROOM_ATMOSPHERES)) {
            const settings = saved?.[id]; if (!settings) continue;
            roomLightSettings[id] = {};
            for (const [key, min, max] of [['exposure', .6, 1.6], ['daylight', .2, 2], ['accent', 0, 2]]) {
                if (Number.isFinite(settings[key])) roomLightSettings[id][key] = Math.max(min, Math.min(max, settings[key]));
            }
        }
    } catch {}
    const saveLighting = () => { try { localStorage.setItem('ergoflex.sceneLights', JSON.stringify(roomLightSettings)); } catch {} };
    for (const key of ['exposure', 'daylight', 'accent']) document.getElementById(`studio-${key}`).oninput = e => {
        (roomLightSettings[selectedRoomScene] ||= {})[key] = Number(e.target.value);
        applyRoomLighting(); saveLighting();
    };
    document.getElementById('reset-scene-light').onclick = () => { delete roomLightSettings[selectedRoomScene]; applyRoomLighting(); saveLighting(); };
    applyRoomLighting();
    document.getElementById('render-quality').onchange = e => {
        if (!renderer) return;
        renderer.setPixelRatio(Math.min(devicePixelRatio, Number(e.target.value))); syncViewerSize();
    };
    document.getElementById('fit-view').onclick = () => { controls.minDistance = DEFAULT_MIN_DISTANCE; if (loadedModel) focusObjects([loadedModel], { animate: true }); };
    document.querySelectorAll('[data-camera-focus]').forEach(button => {
        button.onclick = () => focusCameraShortcut(button.dataset.cameraFocus);
    });
    document.getElementById('camera-view').onchange = e => {
        if (!camera || !loadedModel) return;
        if (e.target.value === 'room') {
            const dock = document.getElementById('motion-dock');
            if (dock && !dock.classList.contains('collapsed')) document.getElementById('motion-dock-toggle')?.click();
            controls.minDistance = DEFAULT_MIN_DISTANCE;
            camera.position.copy(controls.target).add(new THREE.Vector3(5, 4, 5));
            focusObjects(workspaceRoom?.root ? [loadedModel, workspaceRoom.root] : [loadedModel], { animate: true });
            return;
        }
        const direction = { hero: [4.8, 2.3, 4.2], front: [6, 0.2, 0], side: [0, 0.2, 6], top: [0, 6, 0.001] }[e.target.value];
        controls.minDistance = DEFAULT_MIN_DISTANCE;
        camera.position.copy(controls.target).add(new THREE.Vector3(...direction)); focusObjects([loadedModel], { animate: true });
    };
    document.getElementById('rotate-scene').onclick = e => {
        if (!controls) return;
        controls.autoRotate = !controls.autoRotate; e.target.setAttribute('aria-pressed', String(controls.autoRotate));
    };
    document.getElementById('grid-toggle').onclick = e => {
        if (!scene) return;
        if (!studioGrid) { studioGrid = new THREE.GridHelper(12, 48, 0x9aa9a2, 0xc6ceca); studioGrid.position.y = 0.002; studioGrid.material.transparent = true; studioGrid.material.opacity = 0.35; studioGrid.visible = false; scene.add(studioGrid); }
        studioGrid.visible = !studioGrid.visible; e.target.setAttribute('aria-pressed', String(studioGrid.visible));
    };
    document.getElementById('capture-view').onclick = () => {
        if (!renderer || !loadedModel) return notifyUser('Wait for the desk to finish loading.');
        workspaceAccessories?.update();
        renderer.render(scene, camera);
        try { canvas.toBlob(blob => {
            if (!blob) return notifyUser('Capture is unavailable in this browser.');
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ErgoFlex-design.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            notifyUser(selectedRoomScene === 'product' ? 'Desk image downloaded with a transparent background.' : 'Workspace scene image downloaded.');
        }); } catch { notifyUser('Image capture is unavailable. Try serving the project with npm run dev.'); }
    };
    document.querySelectorAll('#viewer-shell button[title]').forEach(b => b.setAttribute('aria-label', b.title));
    buildMotionRemote();
    placeRemoteForMode();
    // The storefront opens with the panel closed, so the desk is unobstructed
    // until the controls are actually asked for.
    let dockPreference = null;
    try { dockPreference = localStorage.getItem('ergoflex.motionDockCollapsed'); } catch {}
    if (!EVENT_DEMO && !document.body.classList.contains('setup-layout') && dockPreference === null) {
        document.getElementById('motion-dock-toggle')?.click();
    }
    // A saved position is only valid against the layout it was saved in, so
    // re-check it whenever the box it lives in could have changed shape.
    window.addEventListener('resize', refitRemote);
    if (document.fonts?.ready) document.fonts.ready.then(clampDockPosition).catch(() => {});
    // A device scaled to fit has to be re-fitted when the box it fits into
    // changes - a divider drag, a collapse, a window resize.
    if (window.ResizeObserver && canvas?.parentElement)
        new ResizeObserver(refitRemote).observe(canvas.parentElement);
    const editorTools = document.createElement('div'); editorTools.className = 'precision-tools';
    editorTools.innerHTML = `<div class="eyebrow">PRECISION & VISIBILITY</div><div><button id="focus-selected">Focus selection <kbd>F</kbd></button><button id="isolate-parts" aria-pressed="false">Isolate</button><button id="show-all-parts">Show all</button></div><div><label>Coordinates <select id="transform-space"><option value="world">World</option><option value="local">Local</option></select></label><label class="check-label"><input type="checkbox" id="transform-snap"> Snap transforms</label></div><p class="studio-note">G Gumball · Q Hide · F Focus<br>Arrows move · rings rotate · squares scale<br>Snap: 0.05 scene units / 15° / 10% scale</p>`;
    document.getElementById('part-search-input').parentElement.after(editorTools);
    const liftTools = document.createElement('div'); liftTools.className = 'precision-tools';
    liftTools.innerHTML = `<div class="eyebrow">LIFT ASSEMBLY</div><div><button id="assign-lift">Assign selected</button><button id="unassign-lift">Remove selected</button></div><p class="studio-note">Selection is independent of animation. Assign unrigged parts here to make them follow the lift. Changes apply to this session.</p>`;
    document.getElementById('clone-parts-btn').parentElement.after(liftTools);
    document.getElementById('assign-lift').onclick = () => {
        if (transformControl?.object) return notifyUser('Set Transform Tool to Off before assigning lift parts.');
        const added = [];
        movingObjects.forEach(({ obj }) => {
            if (isInTiltWrapper(obj) || TELESCOPING_PARTS.includes(obj.name) || liftObjects.has(obj)) return;
            // baseY comes from the canonical transform, not obj.position, because the
            // part may still be parented to the transform proxy.
            const canon = canonicalTransform(obj);
            liftObjects.set(obj, { obj, baseY: (canon ? canon.p.y : obj.position.y) - (currentLift - LIFT_MIN) });
            added.push(obj);
        });
        if (added.length) transaction({ type: 'lift-membership', objects: added, added: true });
        notifyUser(added.length ? `${added.length} parts assigned to lift for this session.` : 'Select unrigged parts first. Tilt, actuator, and wheel rigs keep their own motion.');
    };
    document.getElementById('unassign-lift').onclick = () => {
        const removed = [];
        movingObjects.forEach(({ obj }) => {
            const entry = liftObjects.get(obj);
            if (!entry) return;
            removed.push({ obj, baseY: entry.baseY });
            liftObjects.delete(obj);
        });
        if (removed.length) transaction({ type: 'lift-membership', objects: removed, added: false });
        notifyUser(`${removed.length} parts removed from lift for this session.`);
    };
    document.getElementById('focus-selected').onclick = () => movingObjects.length ? focusObjects(movingObjects.map(i => i.obj), { animate: true }) : notifyUser('Select objects to focus on them.');
    document.getElementById('isolate-parts').onclick = e => {
        if (isolatedVisibility) return showAllParts();
        if (!movingObjects.length) return notifyUser('Select parts to isolate first.');
        const selected = new Set(movingObjects.map(i => i.obj)); isolatedVisibility = new Map();
        interactableObjects.forEach(obj => { isolatedVisibility.set(obj, obj.visible); obj.visible = selected.has(selectionTarget(obj)); });
        e.target.setAttribute('aria-pressed', 'true');
    };
    document.getElementById('show-all-parts').onclick = showAllParts;
    document.getElementById('transform-space').onchange = e => transformControl?.setSpace(e.target.value);
    document.getElementById('transform-snap').onchange = e => {
        transformControl?.setTranslationSnap(e.target.checked ? 0.05 : null);
        transformControl?.setRotationSnap(e.target.checked ? Math.PI / 12 : null);
        transformControl?.setScaleSnap(e.target.checked ? 0.1 : null);
    };
    document.querySelectorAll('.config-header').forEach(header => {
        const id = header.nextElementSibling.id; header.role = 'button'; header.tabIndex = 0;
        header.setAttribute('aria-controls', id); header.setAttribute('aria-expanded', String(header.nextElementSibling.classList.contains('expanded')));
        header.addEventListener('click', () => header.setAttribute('aria-expanded', String(header.nextElementSibling.classList.contains('expanded'))));
        header.onkeydown = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); header.click(); } };
    });
    document.addEventListener('keydown', e => {
        const modal = document.getElementById('cart-modal');
        if (!modal.classList.contains('hidden')) {
            if (e.key === 'Escape') { e.preventDefault(); closeDialog(modal); }
            if (e.key === 'Tab') {
                const elements = [...modal.querySelectorAll('button,input')].filter(el => !el.disabled);
                if (e.shiftKey && (document.activeElement === elements[0] || document.activeElement === modal)) { e.preventDefault(); elements.at(-1).focus(); }
                else if (!e.shiftKey && document.activeElement === elements.at(-1)) { e.preventDefault(); elements[0].focus(); }
            }
            return;
        }
        if (e.key === 'Escape') { haltAllMotion(); syncGlideUI(); }
        if (!setupLayoutOn || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input,select,textarea,[contenteditable],#glide-pad')) return;
        const mode = { q: 'none', g: 'unified' }[e.key.toLowerCase()];
        if (mode) { e.preventDefault(); document.querySelector(`input[name="transform_mode"][value="${mode}"]`).click(); }
        if (e.key.toLowerCase() === 'f') { e.preventDefault(); document.getElementById('focus-selected').click(); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const hasSceneAssets = movingObjects.some(item => item.obj.userData?.sceneAsset);
            if (hasSceneAssets) { e.preventDefault(); deleteSelectedSceneAssets(); }
        }
    });
}

// Small console API for setup & testing (open DevTools and type `ErgoFlex.`)
window.ErgoFlex = {
    setTouchscreenOpen,
    get touchscreenOpen() { return screenTarget > 0.5; },
    get touchscreenProgress() { return screenProgress; },
    get touchscreenReady() { return !!screenAssembly; },
    get touchscreenDisplay() {return touchscreenDisplay;},
    get touchscreenTexture() {return touchscreenTexture;},
    get collisionState() {return {guard:roomSafety.guard,alert:roomSafety.alert?{...roomSafety.alert}:null};},
    setCollisionGuard,clearCollisionAlert,
    setLedsEnabled,
    setLedColor,
    prepareLedCommandCenter,
    applyCustomLedLook,
    get customLedLook() {return customLedLook;},
    applyCustomLedPalette,
    get ledPreviewFrame() {return ledPixelFrame;},
    mountLedPalette,
    mountLedEffects,
    mountLedPlayback,
    setLedMotionEnabled,
    get ledMotionState() {return {enabled:ledMotionEnabled,owner:ledMotion.owner ? {...ledMotion.owner} : null,completionUntil:ledMotion.completionUntil,source:ledPixelSource};},
    get ledGameMode() {return ledGame;},
    get ledMusicMode() {return ledMusic;},
    get ledSoundState() {return {enabled:ledSounds.enabled,owner:ledSounds.owner,error:ledSounds.error,alertCount:ledSounds.alertCount,audioState:ledSounds.alertContext?.state};},
    mountLedDiagnostic,
    setLedDiagnostic,
    get ledDiagnostic() { return { ...ledDiagnostic }; },
    get ledStripMap() { return { version: LED_STRIP_MAP_VERSION, status: 'provisional', strips: LED_STRIPS.map(strip => ({ ...strip })) }; },
    get ledPixelRenderer() { return ledPixels; },
    setLedEffect,
    get ledEffect() { return { ...ledEffect }; },
    get ledColor() { return ledColor; },
    setLedGlow,
    get ledGlow() { return ledGlow; },
    get ledFullBrightness() { return LED_FULL_BRIGHTNESS; },
    setLedSurface,
    get ledSurfaces() { return { ...ledSurfaces }; },
    get ledsEnabled() { return ledsEnabled; },
    get ledCount() { return ledParts.length; },
    get workspaceAccessories() { return workspaceAccessories; },
    get workspaceRoom() { return workspaceRoom; },
    get roomInteractions() { return roomInteractions; },
    get roomLedSpill() { return roomLedSpill; },
    get roomCollisionBlocked() { return roomCollisionBlocked; },
    get roomScene() { return selectedRoomScene; },
    roomScenes: ROOM_SCENES,
    setRoomScene,
    setHomeMode,
    get homeMode() { return homeMode; },
    setHomeLayout,
    get homeLayout() { return selectedHomeLayout().id; },
    setGamingMode,
    get gamingMode() { return gamingMode; },
    setGamingLayout,
    get gamingLayout() { return selectedGamingLayout().id; },
    setMusicMode,
    get musicMode() { return musicMode; },
    setMusicLayout,
    get musicLayout() { return selectedMusicLayout().id; },
    setArtistMode,
    get artistMode() { return artistMode; },
    setArtistLayout,
    get artistLayout() { return selectedArtistLayout().id; },
    setBedroomMode,
    get bedroomMode() { return bedroomMode; },
    setBedroomLayout,
    get bedroomLayout() { return selectedBedroomLayout().id; },
    setGalleryMode,
    get galleryMode() { return galleryMode; },
    setGalleryLayout,
    get galleryLayout() { return selectedGalleryLayout().id; },
    setLibraryMode,
    get libraryMode() { return libraryMode; },
    setLibraryLayout,
    get libraryLayout() { return selectedLibraryLayout().id; },
    setCoworkingMode,
    get coworkingMode() { return coworkingMode; },
    setCoworkingLayout,
    get coworkingLayout() { return selectedCoworkingLayout().id; },
    setScifiMode,
    get scifiMode() { return scifiMode; },
    setScifiLayout,
    get scifiLayout() { return selectedScifiLayout().id; },
    setWorkshopMode,
    get workshopMode() { return workshopMode; },
    setWorkshopLayout,
    get workshopLayout() { return selectedWorkshopLayout().id; },
    setLoungeMode,
    get loungeMode() { return loungeMode; },
    setLoungeLayout,
    get loungeLayout() { return selectedLoungeLayout().id; },
    setKitchenMode,
    get kitchenMode() { return kitchenMode; },
    setKitchenLayout,
    get kitchenLayout() { return selectedKitchenLayout().id; },
    setGymMode,
    get gymMode() { return gymMode; },
    setGymLayout,
    get gymLayout() { return selectedGymLayout().id; },
    setOfficeMode,
    get officeMode() { return officeMode; },
    setOfficeLayout,
    get officeLayout() { return selectedOfficeLayout().id; },
    setStudyMode,
    get studyMode() { return studyMode; },
    setStudyLayout,
    get studyLayout() { return selectedStudyLayout().id; },
    addSceneAsset,
    deleteSelectedSceneAssets,
    get tiltConfigs() { return tiltConfigs; },
    get partRegistry() { return partRegistry; },
    get sceneAssetRegistry() { return sceneAssetRegistry; },
    get sceneAssetStates() { return sceneAssetStates; },
    get movingObjects() { return movingObjects; },
    get liftObjects() { return [...liftObjects.values()]; },
    selectByNames(names) {
        const set = new Set(names);
        let count = 0;
        partRegistry.forEach(entry => {
            if (set.has(entry.name)) {
                toggleMovingObject(entry.obj, true, true);
                count++;
            }
        });
        updateTransformProxy();
        if (selectedPartsCount) selectedPartsCount.innerText = movingObjects.length;
        return count;
    },
    setHeight(h) {
        if (roomGroove?.run) haltAllMotion();
        manualLiftOverride = true;
        h = THREE.MathUtils.clamp(Number(h) || HEIGHT_MIN,
            minimumHeightForTilt(primaryTiltConfig()?.currentDeg ?? 0, currentConfig.size), HEIGHT_MAX);
        currentLift = targetLift = heightToLift(h);
        updateMovingObjectsPosition();
        showHeight(h);
    },
    setTilt(name, deg) {
        if (roomGroove?.run) haltAllMotion();
        const config = tiltConfigs.find(c => c.name === name);
        if (!config) return false;
        const heightLimit = config.name === 'tilting'
            ? maximumTiltForHeight(liftToHeight(currentLift), currentConfig.size) : config.maxDeg;
        config.currentDeg = THREE.MathUtils.clamp(Number(deg) || 0, config.minDeg, Math.min(config.maxDeg, heightLimit));
        applyTiltConfig(config);
        rebuildTiltUI(); // keep sliders/labels in sync
        return true;
    },
    setAutoRotate(v) { if (controls) controls.autoRotate = !!v; },
    setMotionTab,
    haltAllMotion,
    prepareGrooveMode,
    startGroove() { return grooveController().start(); },
    get grooveState() { return roomGroove?.state || { status: 'idle' }; },
    get grooveRouting() { return roomGroove?.prepared ? roomGroove.snapshot() : null; },
    get deskYaw() { return deskYaw; },
    // Drives the ring's command directly: the gesture is a pointer path, and the
    // behaviour worth asserting is what the command does to the desk.
    jogYaw: setYawCommand,
    get yawRate() { return yawRadiansPerSecond(); },
    get yawProjection() { return meanYawProjection(); },
    get glideSpeed() { return glideSpeed; },
    get glideBounds() { return glideBounds(); },
    get glideTarget() { return { x: glideTarget.x, z: glideTarget.z }; },
    get glideInput() { return { x: glideInput.x, y: glideInput.y }; },
    get yawCommand() { return yawCommand; },
    get heightInches() { return liftToHeight(currentLift); },
    placeDockFromStorage,
    // Rebuilding is how the panel is exercised against corrupt storage without
    // a full page reload.
    rebuildMotionRemote() { buildMotionRemote(); placeRemoteForMode(); },
    setShellMode,
    get shellMode() { return shellMode; },
    remoteDevices: REMOTE_DEVICES,
    remoteSizeBounds: { minW: REMOTE_MIN_W, maxW: REMOTE_MAX_W, minH: REMOTE_MIN_H, maxH: REMOTE_MAX_H },
    setRemoteSize(w, h) { anchorDock(document.getElementById('motion-dock')); applyRemoteSize(w, h, { announce: true }); persistRemoteSize(); },
    get remoteSize() { return remoteSize ? { ...remoteSize } : null; },
    get remoteDevice() { return remoteDevice?.id || null; },
    get remoteShape() { return document.getElementById('motion-dock')?.dataset.shape || null; },
    get remoteScale() { return remoteScale; },
    get remoteTheme() { return document.getElementById('motion-dock')?.dataset.theme || null; },
    setRemoteTheme(theme) { applyRemoteTheme(theme); writeStore(REMOTE_THEME_KEY, { v: 1, theme: dockThemeName() }); },
    resetView() { const btn = document.getElementById('reset-view'); if (btn) btn.click(); },
    setPivotByName(name) {
        let done = false;
        partRegistry.forEach(e => { if (!done && e.name === name) { setPivotPart(e.editorId); done = true; } });
        return done;
    },
    undo: performUndo,
    get undoCount() { return undoStack.length; },
    get transformControl() { return transformControl; },
    get transformProxy() { return transformProxy; },
    exportTiltConfigs: serializeTiltConfigs,
    saveTiltConfig,
    removeTiltConfig,
    addSelectedToTiltConfig,
    removeSelectedFromTiltConfig,
    get actuatorRigs() { return actuatorRigs; },
    buildActuatorRig,
    removeActuatorRig,
    persistActuatorRigs,
    exportActuatorRigs: serializeActuatorRigs,
    get wheelRigs() { return wheelRigs; },
    get glideActive() { return glideActive; },
    startGlide,
    stopGlide,
    setGlidePosition,
    get glidePosition() { return { x: glideOffset.x, z: glideOffset.z }; },
    get currentConfig() { return { ...currentConfig }; },
    get renderer() { return renderer; },
    get loadedModel() { return loadedModel; },
    // Edit machinery. Exposed because it is scene state with no DOM
    // representation — there is no element whose value reflects a part's
    // canonical transform or the lift baseline derived from it.
    get editRevision() { return editRevision; },
    get undoCount2() { return undoStack.length; },
    get redoCount() { return redoStack.length; },
    redo: performRedo,
    get deskHeight() { return liftToHeight(currentLift); },
    commitTransform,
    canonicalTransform,
    withNeutralPose,
    get modelFingerprint() { return modelFingerprint; },
    get lockedParts() { return [...lockedParts]; },
    get deletedBakedRigs() { return { tilt: [...deletedBakedRigs.tilt], actuator: [...deletedBakedRigs.actuator] }; },
    focusCameraShortcut,
    applyPreset,
    toggleAccessory,
    get priceLines() { return priceBreakdown(currentConfig); },
    runValidation,
    reportSceneWarning,
    validConfigForTest: validConfig,
    alignSelection,
    distributeSelection,
    setLocked,
    isLocked,
    refreshTransformInspector,
    get inspectedPart() { return inspectorTarget(); },
    get woodMaterials() { return Object.fromEntries([...woodMaterials].map(([role, m]) => [role, {
        roughness: m.roughness, clearcoat: m.clearcoat, metalness: m.metalness,
        color: '#' + m.color.getHexString(),
        bumpScale: m.bumpScale, roughnessMapped: !!m.roughnessMap,
        mapId: m.map ? m.map.uuid : null,
        mapRotation: m.map ? m.map.rotation : null,
        roughnessRotation: m.roughnessMap ? m.roughnessMap.rotation : null,
        repeat: m.map ? [m.map.repeat.x, m.map.repeat.y] : null
    }])); },
    get frameMaterial() { return sharedBasePaintMaterial && { roughness: sharedBasePaintMaterial.roughness, clearcoat: sharedBasePaintMaterial.clearcoat, metalness: sharedBasePaintMaterial.metalness }; },
    get metalMaterial() { return sharedPolishedAluminumMaterial && { roughness: sharedPolishedAluminumMaterial.roughness, metalness: sharedPolishedAluminumMaterial.metalness }; },
    get plasticMaterial() { return sharedBlackPlasticMaterial && { roughness: sharedBlackPlasticMaterial.roughness, clearcoat: sharedBlackPlasticMaterial.clearcoat }; },
    setSurfaceFinish(value) { surfaceFinish = value; applySurfaceFinish(); },
    focusCameraShortcutTargets: cameraShortcutTargets,
    get roomLightingState() {
        const c = sceneLights?.key.shadow.camera;
        return c && { mode: workspaceRoom?.root?.userData.lighting?.mode || 'product',
            key: sceneLights.key.position.toArray(), target: sceneLights.key.target.position.toArray(),
            shadow: { left: c.left, right: c.right, top: c.top, bottom: c.bottom, near: c.near, far: c.far },
            viewMatrix: c.matrixWorldInverse.toArray(), shadowLights: scene.children.filter(o => o.isLight && o.castShadow).length };
    },
    get cameraState() { return { position: camera.position.toArray(), target: controls.target.toArray(), minDistance: controls.minDistance }; },
    serializeProject,
    applyProject,
    readAutosaveRing,
    writeAutosave,
    prepareARModel,
    get arSize() {return arSizeReference();},
    get arState() { return {status:liveAR?.status || 'idle',active:!!liveAR?.active,error:liveAR?.error,tracking:!!liveAR?.hitReady,placed:!!liveAR?.placed,drawCalls:renderer?.info.render.calls}; },
    launchAR
};

// --- Feature-module context ---
//
// studio.js owns every piece of mutable scene state. Feature modules never
// import studio.js (that would be a cycle); they receive this object and read
// through it.
//
// The distinction that matters: scene, renderer, controls and loadedModel are
// REASSIGNED (loadedModel on every model load, the renderer on context
// recovery), so they must be getters — a module that captured the value would
// be holding a stale reference the moment the model reloads. The Map and array
// containers below are only ever mutated in place, never reassigned, so plain
// references stay valid. Anything that clears one of those containers must use
// `.length = 0` or `.clear()` for exactly that reason.
const ctx = {
    get scene() { return scene; },
    get camera() { return camera; },
    get renderer() { return renderer; },
    get controls() { return controls; },
    get loadedModel() { return loadedModel; },
    get transformProxy() { return transformProxy; },
    get currentLift() { return currentLift; },
    get currentConfig() { return currentConfig; },

    partRegistry,
    partLabels,
    liftObjects,
    tiltConfigs,
    actuatorRigs,
    wheelRigs,
    proxyOriginalParents,
    animOriginalParents,

    notifyUser,
    pushUndo,
    LIFT_MIN, LIFT_MAX, HEIGHT_MIN, HEIGHT_MAX
};

// Populate the configurator UI first so it works even if 3D init fails
initStudio();
populateFinishOptions();
setTrimColor(trimColor, false);
document.getElementById('trim-color')?.addEventListener('input', event => setTrimColor(event.target.value));
mountLedPalette(document.getElementById('led-palette'));
mountLedEffects(document.getElementById('led-effects'));
mountLedPlayback(document.getElementById('led-playback'));
mountLedDiagnostic(document.getElementById('led-mapping'));
setLedColor(ledColor, false);
document.getElementById('led-color')?.addEventListener('input', event => setLedColor(event.target.value));
setLedGlow(ledGlow, false);
document.getElementById('led-glow')?.addEventListener('input', event =>
    setLedGlow(Number(event.target.value) * LED_FULL_BRIGHTNESS / 100));
for (const [key, value] of Object.entries(ledSurfaces)) setLedSurface(key, value, false);
document.querySelectorAll('[data-led-surface]').forEach(slider =>
    slider.addEventListener('input', event => setLedSurface(event.target.dataset.ledSurface, event.target.value)));
updatePrice();
initThreeJS();
