# Screens across the environments

The **Screens** menu in the viewer toolbar controls environment displays. Scene screens start on in the rooms; Product starts dark to preserve the product presentation. Turn on Product screens to preview content for the active Start From preset.

- **View selected screen** frames the glass from the front and hides the scene tools for a clear preview. **Show scene controls** restores them.
- **Scene screens on** switches the whole environment's content on or off.
- **Display → Selected screen on** controls one monitor or room display.
- **All screens on** also clears individual off choices for that environment.
- **Enable screen clicks** turns off both Rearrange modes.
- Click the visible glass of a screen to toggle it when both Rearrange modes and Studio part selection are off. Screen clicks never move the object. Clicking while the whole scene is off enables that screen alone.
- Power choices save in browser storage and in project JSON. Individual desk screen choices are separate for each room layout, desk and 48″/60″ width. Changing activities keeps those power choices.

## Content

Every room has five sets of illustrative content following its morning, afternoon, evening, night and shared activity labels. Office/co-working show project boards; library/study/college show sources and notebook pages; music shows audio tracks and mix meters; art/gallery show colour studies and portfolio layers; workshop shows floor plans; kitchens show recipes; lounge and gaming show scene previews; gym shows training metrics; technical rooms show simulated signal graphs; healthcare uses illustrative workflow checklists. No real service, patient or monitoring data is used.

OCC desks follow workstation roles: film editing, audio mixing, colour/illustration and student reels. Existing institutional room displays and the sci-fi mission/telemetry displays retain their authored activity-specific content and gain power controls. Lounge and gaming TVs now follow the same five-phase schedule as desk monitors.

The supplied curved monitor’s glass now renders on both sides and sits 2 mm forward of its original position, clearing the chassis bevel. The monitor body, arm mount and saved object placement are unchanged.

Live/video sources keep priority over illustrative graphics. Switching a display off darkens its glass without ending capture or modifying its source. Stop sharing using the existing sharing controls. The desk's built-in motion controller remains functional and is separate from the environment display toggle.

Graphics are rendered into shared canvas textures. Discovery is throttled and cached textures are bounded to avoid accumulating a texture per desk across every room visited. Native display maps remain attached when off so room activity updates can continue safely.

## Verification

Run `npm run test:scene-screens`: visits every environment, checks five distinct activity images, scene/individual power, native displays through phase changes, video priority, independent width choices, reload persistence and a real canvas pointer click. Screenshots and the review report are under `scene-shots/screen-themes/`.
