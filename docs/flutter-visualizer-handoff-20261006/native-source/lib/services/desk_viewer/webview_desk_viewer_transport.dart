// lib/services/desk_viewer/webview_desk_viewer_transport.dart
//
// webview_flutter implementation (Android / iOS). The viewer is served from
// the bundled assets over loopback; navigation anywhere else is blocked and
// the only bridge is the viewer -> host `ErgoBridge` channel. The host can
// send pose data in; nothing the page does can reach a desk command.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:ergoflex_app/services/desk_viewer/desk_viewer_asset_server.dart';
import 'package:ergoflex_app/services/desk_viewer/desk_viewer_transport.dart';
import 'package:ergoflex_app/utils/logger.dart';

class WebViewDeskViewerTransport implements DeskViewerTransport {
  WebViewController? _controller;

  @override
  Future<void> start(void Function(String message) onMessage) async {
    final base = await DeskViewerAssetServer.instance.ensureStarted();
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.transparent)
      ..addJavaScriptChannel('ErgoBridge',
          onMessageReceived: (m) => onMessage(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (url) => releaseLog('[DeskViewer] page finished $url'),
        onNavigationRequest: (request) {
          final uri = Uri.tryParse(request.url);
          final ours = uri != null &&
              uri.host == base.host &&
              uri.port == base.port;
          return ours ? NavigationDecision.navigate : NavigationDecision.prevent;
        },
        onWebResourceError: (error) {
          if (error.isForMainFrame ?? true) {
            onMessage(jsonEncode({
              'type': 'viewer.error',
              'code': 'webview-error',
              'detail': error.description,
            }));
          }
        },
      ));
    _controller = controller;
    releaseLog('[DeskViewer] loading $base');
    await controller.loadRequest(base.resolve('wellness-embed.html'));
  }

  @override
  Widget buildView() => WebViewWidget(controller: _controller!);

  @override
  Future<void> send(String json) async {
    // jsonEncode of a String yields a valid, fully escaped JS string literal.
    await _controller?.runJavaScript(
        'window.ErgoViewer && window.ErgoViewer.receive(${jsonEncode(json)});');
  }

  @override
  Future<void> dispose() async {
    _controller = null;
  }
}
