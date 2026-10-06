// lib/services/desk_viewer/desk_pose.dart
//
// Measured desk pose for the live 3D viewer. Display-only: derived from the
// canonical DeskStateCubit snapshot via DeskCalculations, never from targets
// (desiredPosition) and never from raw frames.

import 'package:equatable/equatable.dart';

import 'package:ergoflex_app/constants/desk_calculations.dart';
import 'package:ergoflex_app/models/desk_status.dart';

class DeskPose extends Equatable {
  final double heightInches;
  final double tiltDegrees;

  const DeskPose({required this.heightInches, required this.tiltDegrees});

  @override
  List<Object?> get props => [heightInches, tiltDegrees];
}

class DeskPoseAdapter {
  /// Pulses may overshoot the nominal range slightly before the firmware
  /// clamps; beyond this the reading is treated as invalid, not clamped.
  static const int _overshootPulses = 100;

  /// Returns the measured pose, or null when the snapshot cannot support one.
  /// Null means "show the fallback artwork" — never a default pose.
  static DeskPose? fromStatus(DeskStatus? status) {
    if (status == null) return null;
    final lift = status.liftStatus;
    final tilt = status.tiltStatus;

    // MotorSystemStatus.initial() (a frame with no lift/tilt section) reports
    // position 0 / max 0, which would convert to a plausible 28" / +65° pose.
    if (_looksUnreported(lift) || _looksUnreported(tilt)) return null;

    final liftPulses = lift.position;
    final tiltPulses = tilt.position;
    if (!liftPulses.isFinite || !tiltPulses.isFinite) return null;
    if (liftPulses < 0 ||
        liftPulses > DeskCalculations.MAX_LIFT_PULSES + _overshootPulses) {
      return null;
    }
    if (tiltPulses < 0 ||
        tiltPulses > DeskCalculations.MAX_TILT_PULSES + _overshootPulses) {
      return null;
    }

    final liftClamped =
        liftPulses.round().clamp(0, DeskCalculations.MAX_LIFT_PULSES);
    final tiltClamped =
        tiltPulses.round().clamp(0, DeskCalculations.MAX_TILT_PULSES);

    return DeskPose(
      heightInches: DeskCalculations.calculateHeightInches(liftClamped),
      tiltDegrees: DeskCalculations.calculateTiltAngle(tiltClamped),
    );
  }

  static bool _looksUnreported(MotorSystemStatus m) =>
      m.position == 0 && m.maxPosition == 0;
}
