// lib/widgets/led/dj_now_strips_sheet.dart
//
// What the Auto DJ has on each of the eight strips right now: effect, palette,
// colour, speed and intensity per strip. Opened from the music sheet's
// "Now: …" chip. The data is the payload the API last SENT (DJStripRender).

import 'package:flutter/material.dart';

import 'package:ergoflex_app/l10n/app_localizations.dart';
import 'package:ergoflex_app/models/dj_strip_render.dart';
import 'package:ergoflex_app/models/led_models.dart';
import 'package:ergoflex_app/models/led_user_palette.dart';
import 'package:ergoflex_app/widgets/led/music_segment_labels.dart';
import 'package:ergoflex_app/widgets/led/palette_data.dart';
import 'package:ergoflex_app/widgets/led/palette_swatch_widget.dart';

class DjNowStripsSheet extends StatelessWidget {
  final List<DJStripRender> strips;
  final List<LedUserPalette> userPalettes;

  const DjNowStripsSheet({super.key, required this.strips, this.userPalettes = const []});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = AppLocalizations.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: theme.dividerColor,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            l10n.ledMusicDjNowStripsTitle,
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          for (final s in strips) _row(context, theme, l10n, s),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, ThemeData theme, AppLocalizations l10n, DJStripRender s) {
    final dim = theme.colorScheme.onSurface.withValues(alpha: 0.45);
    if (!s.on) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          SizedBox(width: 96, child: Text(ledStripLabel(l10n, s.id), style: TextStyle(color: dim))),
          Text(l10n.ledMusicDjNowStripOff, style: TextStyle(color: dim)),
        ]),
      );
    }
    final mine = userPalettes.where((p) => p.id != null && p.id == s.upalRef).firstOrNull;
    final effect = ergoLedEffectRegistry[s.fx]?.displayName ?? 'FX ${s.fx}';
    final palette = mine?.name ?? PaletteData.getName(s.pal ?? 0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        SizedBox(width: 96, child: Text(ledStripLabel(l10n, s.id))),
        Container(
          width: 12,
          height: 12,
          margin: const EdgeInsets.only(right: 8),
          decoration: BoxDecoration(
            color: s.color ?? theme.colorScheme.outline,
            shape: BoxShape.circle,
          ),
        ),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(effect, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            Row(children: [
              Container(
                width: 28,
                height: 8,
                margin: const EdgeInsets.only(right: 6),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  gradient: mine != null
                      ? userPaletteGradient(mine)
                      : LinearGradient(colors: _builtinColours(s.pal ?? 0)),
                ),
              ),
              Flexible(child: Text(palette, style: theme.textTheme.bodySmall)),
            ]),
          ]),
        ),
        if (s.speed != null || s.intensity != null)
          Text('${s.speed ?? '–'} / ${s.intensity ?? '–'}',
              style: theme.textTheme.labelSmall?.copyWith(color: dim)),
      ]),
    );
  }

  static List<Color> _builtinColours(int pal) {
    final stops = PaletteData.getStops(pal);
    if (stops.length >= 2) return stops;
    final c = stops.isEmpty ? const Color(0xFF888888) : stops.first; // theme-exempt: palette preview data
    return [c, c];
  }
}
