# Shared Office

Preview: `index.html?room=office&view=room`. Add `&layout=spacious` to open
the four-desk design team room directly.

| Room | Floor size | Ceiling | ErgoFlex desks |
| --- | --- | --- | --- |
| Two-person office | 4.2 × 4.8 m | 2.8 m | 2 |
| Small team studio | 5.8 × 6.0 m | 2.9 m | 3 |
| Design team office | 7.0 × 7.2 m | 3.0 m | 4 |
| Collaborative office | 8.6 × 8.8 m | 3.2 m | 5 |
| Flagship design studio | 10.5 × 10.0 m | 3.4 m | 6 |

The main desk has a green work zone marked **Main · Your ErgoFlex**. The app's
Glide, lift, tilt, LED and posture controls act on this desk only. Other units
are snapshots of the actual current ErgoFlex geometry, with corrected trim,
wood textures, wheels and actuator poses. They are grouped as editable Studio
assets, with fixed role-specific postures:

- Drafting: 43.5 inches, 39 degrees; original plan sheet, rulers, pencil and paper stand.
- Digital design: 28 inches, level; monitor, tablet and keyboard.
- Prototyping: 43.5 inches, −5 degrees; desktop 3D printer and notebook.
- Architecture: 43.5 inches, 25 degrees; original plan sheet and drawing tools.
- Planning and research: 28 inches, level; laptop, papers and phone.

Room selection adds stations progressively. Switching 48/60 inches changes desk
widths, without scaling the room, chairs or other furniture. Each unit has a
Steelcase Leap chair. Larger rooms add a sofa conversation area, and design
team rooms add an acoustic planter divider. All include shared coffee storage,
a project pinboard, daylight windows and linear pendant lighting. The flagship
also includes a six-person team review table.

Morning, Afternoon, Evening, Night and Team social modes adjust the main desk
posture/placement and room lighting. Secondary desk postures remain fixed.
Lighting uses four practical point lights and the existing directional shadow
setup. Secondary desk meshes are batched by material to reduce draw calls;
textures shared with the main desk are retained safely during room disposal.

Room choice, mode and whole-station edits save independently from other scenes
and survive project export/import. These are illustrative layouts: Glide stays
within physical wall bounds, but furniture collision avoidance is not simulated.
Room decorations and secondary desks do not change pricing or enter AR export.

Verification: `npm run test:office`. Screenshot helper accepts
`--office-layout` and `--office-mode`. The site upload builder includes
`office-room.mjs`; this change does not publish a website update by itself.
