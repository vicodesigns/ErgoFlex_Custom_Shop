// lib/services/desk_viewer/desk_led_message.dart
//
// The `desk.led` message for the live 3D viewer: the desk's light settings plus the
// movement-cue inputs. Pure functions so the mapping is testable without a renderer.

import 'package:ergoflex_app/models/desk_status.dart';
import 'package:ergoflex_app/models/led_look.dart';

class DeskLedMessage {
  /// Wheels command (WheelsStatus.movementDirection, the firmware's field 9) -> the
  /// strip's drive-mode code the viewer's cue renderer expects.
  ///
  /// COPIED from ergoflex_api services.mapCommandToDriveMode, which is confirmed on
  /// hardware (2026-08-25): the diagonal names are firmware-inverted and the rotations
  /// are swapped on purpose. Do not "fix" it from the names; change both together.
  static const Map<int, int> _driveModeForCommand = {
    3: 7, // physically left-forward
    8: 8, // left-backward
    1: 9, // right-forward
    6: 10, // right-backward
    2: 3, // forward
    7: 4, // backward
    9: 6, // rotate left
    10: 5, // rotate right
    4: 1, // strafe left
    5: 2, // strafe right
  };

  /// 0 when the wheels are not moving. `movementDirection` is the STICKY last opcode
  /// (it persists through idle and holds sentinels outside 1..10), so it is only
  /// meaningful while [WheelsStatus.isMoving] is true.
  static int wheelDriveMode(WheelsStatus? wheels) {
    if (wheels == null || !wheels.isMoving) return 0;
    return _driveModeForCommand[wheels.movementDirection] ?? 0;
  }

  /// Null when there is no look to show (the viewer keeps its last look).
  static Map<String, dynamic>? build({
    required LedLook? look,
    required bool cues,
    required int wheelDir,
  }) {
    if (look == null) return null;
    return {
      'type': 'desk.led',
      'schemaVersion': 1,
      'on': look.on,
      'bri': look.bri,
      'rgb': look.rgb,
      'fx': look.fx,
      'sx': look.sx,
      'cues': cues,
      'fresh': look.fresh,
      'wheelDir': wheelDir,
    };
  }
}
