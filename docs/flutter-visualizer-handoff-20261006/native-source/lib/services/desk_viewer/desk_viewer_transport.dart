// lib/services/desk_viewer/desk_viewer_transport.dart
//
// Seam between DeskModelView and the platform renderer, so the widget's
// forwarding / readiness / fallback logic can be tested with a fake.

import 'package:flutter/widgets.dart';

abstract class DeskViewerTransport {
  /// Starts the renderer. [onMessage] receives the viewer's raw JSON strings
  /// (`viewer.ready`, `viewer.error`, `pose.applied`). Throws if the platform
  /// cannot host the viewer — the caller keeps the fallback artwork.
  Future<void> start(void Function(String message) onMessage);

  /// The renderer surface. Valid after [start] completes.
  Widget buildView();

  /// Delivers one JSON message to the viewer.
  Future<void> send(String json);

  Future<void> dispose();
}
