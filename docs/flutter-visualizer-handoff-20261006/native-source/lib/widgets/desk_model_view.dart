// lib/widgets/desk_model_view.dart
//
// Live 3D desk for the wellness footer. Follows the MEASURED lift/tilt from
// DeskStateCubit (never a target, never phase text). Shows [fallback] — the
// original artwork — until the viewer is ready AND a valid pose exists, and
// again if the viewer fails. Display-only: the viewer has no command route.

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:ergoflex_app/blocs/desk_state/desk_state_cubit.dart';
import 'package:ergoflex_app/http/user_api_client.dart';
import 'package:ergoflex_app/injection_container.dart';
import 'package:ergoflex_app/models/led_look.dart';
import 'package:ergoflex_app/services/desk_viewer/desk_led_message.dart';
import 'package:ergoflex_app/services/desk_viewer/desk_pose.dart';
import 'package:ergoflex_app/services/desk_viewer/desk_viewer_transport.dart';
import 'package:ergoflex_app/services/desk_viewer/webview_desk_viewer_transport.dart';
import 'package:ergoflex_app/utils/feature_flags.dart';
import 'package:ergoflex_app/utils/logger.dart';

class DeskModelView extends StatefulWidget {
  final double size;
  final Widget fallback;

  /// Test seam. Defaults to the WebView transport.
  final DeskViewerTransport Function()? transportFactory;

  /// Whether the user has LED status indicators (lift/tilt/wheel cues) switched on. The
  /// desk only lights those cues when it is, so the model must follow. Test seam; defaults
  /// to the user's saved setting. Failure means "off" — a missing setting must not invent cues.
  final Future<bool> Function()? ledCuesLoader;

  const DeskModelView({
    super.key,
    required this.size,
    required this.fallback,
    this.transportFactory,
    this.ledCuesLoader,
  });

  /// Android and iOS only; web / Linux desk panel / desktop keep the artwork
  /// until a renderer adapter is qualified there.
  static bool get isSupported {
    if (!FeatureFlags.liveDeskModel || kIsWeb) return false;
    return Platform.isAndroid || Platform.isIOS;
  }

  @override
  State<DeskModelView> createState() => _DeskModelViewState();
}

class _DeskModelViewState extends State<DeskModelView>
    with WidgetsBindingObserver {
  late final DeskViewerTransport _transport;
  final String _sessionId = DateTime.now().microsecondsSinceEpoch.toString();
  int _sequence = 0;

  bool _viewerReady = false;
  bool _failed = false;
  bool _started = false;
  DeskPose? _latestPose;
  bool _live = false;
  bool _reducedMotion = false;
  LedLook? _look;
  bool _cues = false;
  int _wheelDir = 0;

  // Finger rotation: deltas are coalesced to one message per ~frame.
  double _pendingDx = 0, _pendingDy = 0;
  Timer? _orbitFlush;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _transport = (widget.transportFactory ?? WebViewDeskViewerTransport.new)();
    releaseLog('[DeskViewer] mount size=${widget.size}');
    _boot();
    _loadCues();
  }

  Future<void> _boot() async {
    try {
      await _transport.start(_onViewerMessage);
      if (!mounted) return;
      setState(() => _started = true);
    } catch (e) {
      releaseLog('[DeskViewer] start failed, using artwork: $e');
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _loadCues() async {
    try {
      final loader = widget.ledCuesLoader ??
          () => serviceLocator<UserApiClient>().getLedStatusIndicatorsSetting();
      final enabled = await loader();
      if (!mounted || enabled == _cues) return;
      _cues = enabled;
      _pushLed();
    } catch (_) {
      // Leave cues off: no setting, no cue.
    }
  }

  void _pushLed() {
    if (!_viewerReady) return;
    final msg = DeskLedMessage.build(look: _look, cues: _cues, wheelDir: _wheelDir);
    if (msg != null) _transport.send(jsonEncode(msg));
  }

  void _onViewerMessage(String raw) {
    if (!mounted || raw.length > 4096) return;
    Map<String, dynamic> msg;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return;
      msg = decoded;
    } catch (_) {
      return;
    }
    switch (msg['type']) {
      case 'viewer.ready':
        releaseLog('[DeskViewer] viewer ready (pose=${_latestPose != null})');
        setState(() => _viewerReady = true);
        _pushLed(); // look first so the first frame is already lit
        _push(); // replay the latest snapshot after (re)load
        break;
      case 'viewer.error':
        final code = msg['code'];
        if (code == 'pose.rejected') {
          releaseLog('[DeskViewer] pose rejected: ${msg['detail']}');
          break; // viewer kept its last good pose; no need to drop to artwork
        }
        releaseLog('[DeskViewer] viewer error $code ${msg['detail']}');
        if (code == 'js-error' && _viewerReady) break; // running; keep last pose
        setState(() {
          _failed = true;
          _viewerReady = false;
        });
        break;
      default:
        break;
    }
  }

  void _onDeskState(DeskState state) {
    _live = state.live;
    final look = state.status?.ledLook;
    final wheelDir = DeskLedMessage.wheelDriveMode(state.status?.wheelsStatus);
    final nextLook = look ?? _look; // a frame without a look keeps the last one
    if (nextLook != _look || wheelDir != _wheelDir) {
      _look = nextLook;
      _wheelDir = wheelDir;
      _pushLed();
    }
    final pose = DeskPoseAdapter.fromStatus(state.status);
    if (pose != null && pose != _latestPose) {
      _latestPose = pose;
      _push();
    }
    if (mounted) setState(() {});
  }

  void _push() {
    final pose = _latestPose;
    if (!_viewerReady || pose == null) return;
    _transport.send(jsonEncode({
      'type': 'desk.pose',
      'schemaVersion': 1,
      'sessionId': _sessionId,
      'sequence': ++_sequence,
      'mode': _live ? 'live' : 'cached',
      'heightInches': pose.heightInches,
      'tiltDegrees': pose.tiltDegrees,
      'reducedMotion': _reducedMotion,
    }));
  }

  void _onPanUpdate(DragUpdateDetails d) {
    _pendingDx += d.delta.dx;
    _pendingDy += d.delta.dy;
    _orbitFlush ??= Timer(const Duration(milliseconds: 16), () {
      _orbitFlush = null;
      final dx = _pendingDx, dy = _pendingDy;
      _pendingDx = _pendingDy = 0;
      if (!mounted || (dx == 0 && dy == 0)) return;
      _transport.send(jsonEncode({
        'type': 'viewer.orbit',
        'schemaVersion': 1,
        'dx': dx.clamp(-300.0, 300.0),
        'dy': dy.clamp(-300.0, 300.0),
      }));
    });
  }

  void _resetView() {
    _pendingDx = _pendingDy = 0;
    _transport.send(jsonEncode({'type': 'viewer.resetView', 'schemaVersion': 1}));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState lifecycle) {
    if (!_viewerReady) return;
    final paused = lifecycle != AppLifecycleState.resumed;
    _transport.send(jsonEncode({
      'type': paused ? 'viewer.pause' : 'viewer.resume',
      'schemaVersion': 1,
    }));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reducedMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _orbitFlush?.cancel();
    _transport.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<DeskStateCubit>();
    return BlocListener<DeskStateCubit, DeskState>(
      bloc: cubit,
      listener: (_, state) => _onDeskState(state),
      child: Builder(builder: (context) {
        // First build: seed from the retained snapshot.
        if (_latestPose == null && cubit.state.hasData) {
          _live = cubit.state.live;
          _latestPose = DeskPoseAdapter.fromStatus(cubit.state.status);
          _look = cubit.state.status?.ledLook;
          _wheelDir = DeskLedMessage.wheelDriveMode(cubit.state.status?.wheelsStatus);
        }
    final showModel =
            _started && _viewerReady && !_failed && _latestPose != null;
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Mounted (and visible) as soon as it starts so WebGL really renders;
              // the artwork sits on top until there is a measured pose. The
              // canvas stays transparent/clear until the first pose arrives.
              if (_started && !_failed)
                Opacity(
                  opacity: _live ? 1.0 : 0.55,
                  // The WebView never sees touches (they would fight the parent
                  // scroll/swipe handling); Flutter turns drags into orbit messages.
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onPanUpdate: showModel ? _onPanUpdate : null,
                    onDoubleTap: showModel ? _resetView : null,
                    child: IgnorePointer(child: _transport.buildView()),
                  ),
                ),
              if (!showModel) widget.fallback,
              if (showModel && !_live)
                const Positioned(
                  right: 0,
                  bottom: 0,
                  child: Icon(Icons.cloud_off, size: 12, color: Colors.grey),
                ),
            ],
          ),
        );
      }),
    );
  }
}
