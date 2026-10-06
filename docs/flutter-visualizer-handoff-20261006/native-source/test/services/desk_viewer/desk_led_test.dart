import 'package:flutter_test/flutter_test.dart';

import 'package:ergoflex_app/models/desk_status.dart';
import 'package:ergoflex_app/models/led_look.dart';
import 'package:ergoflex_app/services/desk_viewer/desk_led_message.dart';

Map<String, dynamic> _look({Object? rgb, Object? on = true, Object? bri = 200}) => {
      'on': on,
      'bri': bri,
      'rgb': rgb ?? [10, 20, 30],
      'fx': 15,
      'sx': 90,
      'ix': 128,
      'pal': 0,
      'source': 'http_get',
      'age_ms': 1200,
      'fresh': true,
    };

WheelsStatus _wheels({required bool moving, required int command}) =>
    DeskStatus.fromJson({
      'wheels_status': {
        'is_moving': moving,
        'movement_command': command,
      },
    }).wheelsStatus;

void main() {
  group('LedLook.fromJson', () {
    test('parses a complete look', () {
      final look = LedLook.fromJson(_look())!;
      expect(look.on, true);
      expect(look.bri, 200);
      expect(look.rgb, [10, 20, 30]);
      expect(look.fx, 15);
      expect(look.fresh, true);
    });

    test('absent or malformed looks are null, never an "off" look', () {
      expect(LedLook.fromJson(null), isNull);
      expect(LedLook.fromJson('x'), isNull);
      expect(LedLook.fromJson(_look(on: 'yes')), isNull);
      expect(LedLook.fromJson(_look(rgb: [1, 2])), isNull);
      expect(LedLook.fromJson(_look(rgb: [1, 2, 'z'])), isNull);
      expect(LedLook.fromJson(_look(bri: null)), isNull);
    });

    test('clamps out-of-range values', () {
      final look = LedLook.fromJson(_look(rgb: [-4, 999, 5], bri: 900))!;
      expect(look.rgb, [0, 255, 5]);
      expect(look.bri, 255);
    });

    test('age does not change equality, so a steady look does not re-emit', () {
      final a = LedLook.fromJson(_look())!;
      final b = LedLook.fromJson({..._look(), 'age_ms': 9000})!;
      expect(a, b);
      final stale = LedLook.fromJson({..._look(), 'fresh': false})!;
      expect(a == stale, isFalse);
    });
  });

  test('DeskStatus carries led_look when the frame has one, null otherwise', () {
    expect(DeskStatus.fromJson({'led_look': _look()}).ledLook, isNotNull);
    expect(DeskStatus.fromJson({}).ledLook, isNull);
    expect(DeskStatus.fromJson({'led_look': {'on': true}}).ledLook, isNull);
  });

  group('wheel drive mode (mirrors the API hardware-verified table)', () {
    const expected = {
      1: 9, 2: 3, 3: 7, 4: 1, 5: 2, 6: 10, 7: 4, 8: 8, 9: 6, 10: 5,
    };
    expected.forEach((command, mode) {
      test('command $command -> drive mode $mode', () {
        expect(
            DeskLedMessage.wheelDriveMode(_wheels(moving: true, command: command)),
            mode);
      });
    });

    test('a stopped desk has no cue even with a sticky last opcode', () {
      expect(
          DeskLedMessage.wheelDriveMode(_wheels(moving: false, command: 2)), 0);
    });

    test('sentinels and out-of-range commands give no cue', () {
      for (final c in [0, 11, 46, 48, 93, -1]) {
        expect(DeskLedMessage.wheelDriveMode(_wheels(moving: true, command: c)),
            0,
            reason: 'command $c');
      }
      expect(DeskLedMessage.wheelDriveMode(null), 0);
    });
  });

  test('message is null without a look; carries cues and wheel mode with one', () {
    expect(DeskLedMessage.build(look: null, cues: true, wheelDir: 3), isNull);
    final msg = DeskLedMessage.build(
        look: LedLook.fromJson(_look()), cues: true, wheelDir: 3)!;
    expect(msg['type'], 'desk.led');
    expect(msg['cues'], true);
    expect(msg['wheelDir'], 3);
    expect(msg['rgb'], [10, 20, 30]);
  });
}
