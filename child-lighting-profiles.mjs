// Growing child room · per-stage light character (pass 2026-11-05). Pure data,
// no Three import, so the growth-profile module and review tools can load it.
// Mode overrides merged into childModesForStage (studio key / fill / hemi /
// exposure). Values stay inside the bands every other room uses.
// Morning vs afternoon (round 2): morning is a low, warm-gold key against a
// cool shadow fill and less ambient (long, contrasty shadows); afternoon is a
// high, white key with a warm, generous fill (soft, flat, bright).
const M = (exposure, power, ambient, sky, key, fill, accent) => ({ exposure, power, ambient, bounce: ambient * 1.4, sky, key, fill, accent });
export const CHILD_STAGE_LIGHT = {
    early: {
        morning: M(1.05, 1.75, .38, ['#9fcbe8', '#ffdcb4'], '#ffd9a6', '#c9d9ea', '#ffd29c'),
        afternoon: M(1.06, 1.15, .52, ['#b4d8e8', '#f4f2e6'], '#fffaf0', '#efe9dd', '#fff0d8'),
        evening: M(1.12, .5, .25, ['#5e7aa8', '#f7b48a'], '#ffc58c', '#c9cad8', '#ffcf98'),
        night: M(1.12, .06, .13, ['#0e1d35', '#2c4466'], '#9fb4d8', '#8d9fbf', '#ffc98a')
    },
    primary: {
        morning: M(1.04, 1.85, .38, ['#7fbbe6', '#ffe0b8'], '#ffdba8', '#c7d8ec', '#ffd9a8'),
        afternoon: M(1.06, 1.3, .53, ['#86c2ea', '#f6f4ea'], '#fffaf0', '#f0ebe0', '#fff2dc'),
        evening: M(1.12, .55, .26, ['#4c6a9c', '#f8a47c'], '#ffbd84', '#c7cad9', '#ffcf98'),
        night: M(1.1, .05, .12, ['#0f1f3a', '#304a6e'], '#a6b8d8', '#8fa1c0', '#ffcc8e')
    },
    preteen: {
        morning: M(1.06, 1.75, .38, ['#a3c4e6', '#ffd8c8'], '#ffd8b4', '#cbd5ea', '#f6d0bc'),
        afternoon: M(1.05, 1.15, .51, ['#a8cce6', '#f6f0e6'], '#fff9f0', '#eee8e0', '#f6e6d4'),
        evening: M(1.12, .5, .25, ['#58598f', '#f2a39c'], '#ffb592', '#cbc4d9', '#ffc7a6'),
        night: M(1.12, .05, .15, ['#151838', '#3a3a6a'], '#a9a8d4', '#a39bc8', '#ffc28c')
    },
    teen: {
        morning: M(1.14, 1.75, .4, ['#93b4d0', '#f2dcc4'], '#ffdcb0', '#c4d2e4', '#efd6bc'),
        afternoon: M(1.14, 1.2, .54, ['#a2bfd4', '#f2eee6'], '#fffaf2', '#ebe8e2', '#efe6d8'),
        evening: M(1.14, .42, .25, ['#28466e', '#e88a5a'], '#ffad7a', '#bcc3d8', '#c68cff'),
        night: M(1.2, .05, .27, ['#0b1324', '#1e2c48'], '#8e9cc4', '#8f9cc4', '#ffad6a')
    },
    college: {
        morning: M(1.05, 1.7, .38, ['#9cbcd8', '#f4e0c8'], '#ffdfb6', '#c8d4e4', '#efdcc4'),
        afternoon: M(1.05, 1.15, .5, ['#a8c2d4', '#f0ece4'], '#fffaf2', '#ece8e0', '#f0e6d6'),
        evening: M(1.1, .4, .23, ['#2b3d5e', '#dc9068'], '#ffb27e', '#bfc6d6', '#ffcf9c'),
        night: M(1.12, .05, .15, ['#0a1222', '#1c2a44'], '#8f9cc0', '#8f9abc', '#ffc58c')
    }
};
export const childStageLight = (age, key) => CHILD_STAGE_LIGHT[age]?.[key] || {};
