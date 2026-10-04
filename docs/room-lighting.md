# Environment lighting and material refinement

The shared finishing pass covers Home office, Gaming, Music, Artist, Study,
Office, Gym, Kitchen, Lounge, Workshop, Bedroom, Gallery, Sci-fi, Co-working
and Library, across the existing measured room sizes.

## Lighting

- Morning uses a lower sun angle; afternoon a higher angle; evening a low,
  oblique angle. Each layout's window side sets the light direction. The Home
  office has rear windows. These are designed moods, not a geographic solar
  simulation.
- Directional light targets move to the measured room centre. Fill and rim
  positions follow the room footprint instead of the product viewer origin.
- Night and social modes use a soft overhead wash alongside each room's
  existing task lamps, illuminated fixtures and desk LEDs. Sci-fi retains an
  artificial orbital wash.
- The one existing directional shadow map fits the floor and wall height for
  each layout. Its resolution remains unchanged, including the mobile limit.
  No additional shadow maps are introduced. Large rooms consequently have
  coarser shadow detail than small rooms.
- Exposure, Main light and Accent light sliders retain their existing roles.
  Selecting a mood resets its manual lighting overrides as before.
- Product lighting restores its original target, shadow bounds, softness and
  bias when leaving a room. The AR lighting implementation is separate.

## Material detail

Builders explicitly identify wood, plaster, fabric, painted surfaces, metal,
stone and rubber. Original room geometry receives small shared 128 px bump
and roughness maps. Untextured wood also receives a subtle colour grain.
Each surface uses a second UV set with a repeat distance in millimetres; the
grain/fabric detail does not stretch with the room size.

Authored colour maps and original UVs remain in place. Screens, signage,
artwork, emissive fixtures and imported library models retain their existing
materials. Small instanced book bands have separate materials to retain the
original instancing and avoid applying lamp relief to the book batches.

Relief is shading only: physical room dimensions, furniture placement,
editable scene identities and collision/Glide bounds are unaffected. Texture
maps are created once per surface type per room, with no per-frame texture
generation. All owned texture slots are disposed when switching rooms;
cached imported model textures remain owned by their cache.

## Verification

`npm run test:room-lighting` loads all 15 environments in the actual browser
app, exercises all five moods and checks full shadow coverage, changing
daylight direction, detail UVs, imported-material isolation, texture disposal
and product lighting restoration. The largest Library layout checks a 18 ×
20 m floor. Visual review uses the full-quality screenshot helper, including
daylight, evening, night and social scenes.

The new `room-refinement.mjs` is included in the website upload builder. This
pass updates the local preview; it does not deploy or rebuild a website ZIP.
