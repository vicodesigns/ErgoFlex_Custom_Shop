// lib/services/desk_viewer/desk_viewer_asset_server.dart
//
// Serves the bundled viewer (desk_viewer/**) to the WebView over
// loopback. ES modules and the GLB cannot load from file:// origins, and a
// hosted page would break offline use. Bound to 127.0.0.1 on an ephemeral
// port, GET-only, and only paths under the viewer's asset prefix.

import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;

import 'package:ergoflex_app/utils/logger.dart';

class DeskViewerAssetServer {
  DeskViewerAssetServer._();
  static final DeskViewerAssetServer instance = DeskViewerAssetServer._();

  static const String _prefix = 'desk_viewer/';

  HttpServer? _server;
  Future<Uri>? _starting;

  /// Base URI of the running server (starting it on first use).
  Future<Uri> ensureStarted() => _starting ??= _start();

  Future<Uri> _start() async {
    try {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      _server = server;
      server.listen(_handle, onError: (Object e) {
        releaseLog('[DeskViewer] asset server error: $e');
      });
      return Uri.parse('http://127.0.0.1:${server.port}/');
    } catch (_) {
      _starting = null; // allow a retry on the next mount
      rethrow;
    }
  }

  Future<void> _handle(HttpRequest request) async {
    final response = request.response;
    try {
      if (request.method != 'GET') {
        response.statusCode = HttpStatus.methodNotAllowed;
        return;
      }
      final path = request.uri.pathSegments;
      if (path.isEmpty || path.any((s) => s == '..' || s.isEmpty)) {
        response.statusCode = HttpStatus.notFound;
        return;
      }
      final key = '$_prefix${path.join('/')}';
      final data = await rootBundle.load(key);
      response.headers.contentType = _contentTypeFor(key);
      response.headers.set('Cache-Control', 'no-store');
      response.add(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
    } catch (_) {
      response.statusCode = HttpStatus.notFound;
    } finally {
      await response.close();
    }
  }

  static ContentType _contentTypeFor(String key) {
    if (key.endsWith('.html')) return ContentType('text', 'html', charset: 'utf-8');
    if (key.endsWith('.js') || key.endsWith('.mjs')) {
      return ContentType('text', 'javascript', charset: 'utf-8');
    }
    if (key.endsWith('.glb')) return ContentType('model', 'gltf-binary');
    return ContentType.binary;
  }

  Future<void> stop() async {
    final s = _server;
    _server = null;
    _starting = null;
    await s?.close(force: true);
  }
}
