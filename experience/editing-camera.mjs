// The Director's Editing camera (19 Nov 2026, Vico: "I want to move around without the camera changing on me … so I can
// play back everything and my camera stays put … Then I can toggle that off and go back to the camera as it's supposed
// to play in the scene"). A Director session state, never in the cut: while it is on, the stage (stage.mjs cam) does
// not put the camera on the chapter's camera keys, whether playing, scrubbing, seeking or re-preparing; everything else
// plays. A bake (a preview video of the chapter) always films the keys. The film render never turns it on.
// Pure: node tests run it.
export const PREF = 'holdCamera';   // in the Director's UI store (ergoflex.director.ui.v1): per browser, kept across reloads
// Whether the stage's camera keys drive the camera this frame.
export const cameraFollows = ({ held = false, baking = false } = {}) => !held || !!baking;
// The view as it is (the camera and the orbit pivot), and back.
export function poseOf(camera, controls) {
  return { p: camera.position.toArray(), q: camera.quaternion.toArray(), up: camera.up.toArray(), t: controls.target.toArray(), fov: camera.fov, zoom: camera.zoom ?? 1 };
}
export function putPose(camera, controls, pose) {
  if (!pose) return;
  camera.position.fromArray(pose.p); camera.up.fromArray(pose.up); camera.quaternion.fromArray(pose.q); controls.target.fromArray(pose.t);
  camera.fov = pose.fov; camera.zoom = pose.zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld?.(true);
}
