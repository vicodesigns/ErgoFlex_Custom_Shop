# Director preview improvements — October 29, 2026

- Added Loop on/off beside the chapter transport. It repeats a chapter or selected camera/Groove preview within its bounds. It applies only while editing, not to client-cut playback or baking.
- Selected-range playback resumes from its paused position and restarts at its in-point after completion.
- Unchanged selected-range previews reuse the prepared 3D stage instead of rebuilding the room.
- Ctrl/Cmd+D duplicates the selected camera key or movement using existing insertion and overlap rules. Text fields retain native editing behavior.
- Disabled camera-move preview for the final keyframe, which has no outgoing segment.

Verification: preview timing and actual player range-handler tests passed, along with camera, movement clip and chapter pacing regressions. Syntax checks passed. Localhost port 3000 returned HTTP 200 outside the restricted shell. Browser-control requests timed out, so visual and interactive verification of this pass remains outstanding. No saved user cuts were changed by this pass.
