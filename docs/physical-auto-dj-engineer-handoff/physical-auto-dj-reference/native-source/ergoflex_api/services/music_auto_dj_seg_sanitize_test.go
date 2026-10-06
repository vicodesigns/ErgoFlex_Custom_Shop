package services

// Stored segment overrides reach the Auto DJ pool carrying COLOUR ONLY.
//
// Two independent reasons, and the tests below are written so that a fix for
// one cannot be mistaken for a fix for the other:
//
//   - SAFETY. validateMusicSegmentConfigs admits fx 0-33, and fx 22 is the
//     STATIC Strobe — fxStrobe has no comfortMode reference, so it free-runs
//     with none of the 350ms full-field flash floor. Every assertion here runs
//     under FlashComfortOff (the UI's "Standard", the default), where
//     applyFlashComfortToPool returns the pool untouched. A mutant that
//     classifies fx 22 as flash-heavy instead of stripping it therefore passes
//     nothing: classification never runs on this path.
//   - HONESTY. Segments 1 and 2 share physical tier 1. A stored music fx on
//     one and not the other would make any reported five-tier plan a fiction,
//     so valid music fx is stripped too, not only the dangerous static one.

import (
	"encoding/json"
	"testing"

	"ergoflex_api/models"
)

// storedSegsPayloads returns a preset and a favourite whose stored
// segment_configs carry every field the DJ must not inherit.
//
// Segment 0 carries fx 22 — the unguarded STATIC strobe. Segment 1 carries
// fx 28, a perfectly valid MUSIC effect: both must be gone, or only half the
// rule is implemented.
func storedSegsPayloads() (preset, fav json.RawMessage) {
	segs := `[
		{"id":0,"fx":22,"sx":255,"ix":255,"on":true,"reverse":true,"mirror":true,
		 "col":[[255,0,0,0],[0,0,0,0],[0,0,0,0]]},
		{"id":1,"fx":28,"sx":10,"ix":10,"pal":6,
		 "col":[[0,22,255,0],[0,0,0,0],[0,0,0,0]]},
		{"id":3,"on":false,"col":[[7,8,9,0],[0,0,0,0],[0,0,0,0]]}
	]`
	preset = json.RawMessage(`{"mode":"music","wled":{"on":true,"seg":[]},
		"music":{"visualization":0,"palette_id":0,"speed":219,"segment_configs":` + segs + `}}`)
	fav = json.RawMessage(`{"visualization":0,"palette_id":0,"speed":200,"segment_configs":` + segs + `}`)
	return preset, fav
}

func djPoolWithStoredSegs(t *testing.T) map[string]djPick {
	t.Helper()
	presetPayload, favPayload := storedSegsPayloads()
	svc, cleanup := newDJTestService(t, &fakeDJStore{})
	t.Cleanup(cleanup)
	svc.SetCustomPresetSource(&fakePresetSource{presets: []models.CustomPreset{
		{ID: "3f9c2b1a-4d5e-4f60-8a7b-9c0d1e2f3a4b", UserID: 1, Name: "Sick", Payload: presetPayload},
	}})
	svc.SetMusicFavoritesSource(&fakeFavSource{favs: []models.MusicModeFavorite{
		{ID: 12, Name: "Red Blue", Payload: favPayload},
	}})

	s := DJSettings{
		Version: DJSettingsVersion,
		Looks: []DJLookRef{
			{Kind: DJLookKindCustomPreset, RefID: "3f9c2b1a-4d5e-4f60-8a7b-9c0d1e2f3a4b", Weight: 2},
			{Kind: DJLookKindMusicFavorite, RefID: "12", Weight: 2},
		},
		SwitchBars: 8,
	}
	// FlashComfortOff is the DEFAULT ("Standard" in the UI) and the mode in
	// which applyFlashComfortToPool filters nothing at all.
	prog, err := svc.resolveDJSettings(1, s, djCapabilities{LayerFxKnown: true, LayerFxSupported: true},
		FlashComfortOff, djBaseline{paletteID: 7, speed: 128}, false, 42)
	if err != nil {
		t.Fatalf("resolve failed: %v", err)
	}
	deck, ok := prog.Selector.(*djDeck)
	if !ok {
		t.Fatalf("want a bare deck, got %T", prog.Selector)
	}
	byRef := map[string]djPick{}
	for _, wl := range deck.pool {
		byRef[wl.pick.refID] = wl.pick
	}
	return byRef
}

func TestDJPoolPicksCarryOnlyColour(t *testing.T) {
	byRef := djPoolWithStoredSegs(t)
	for _, ref := range []string{
		"custom_preset:3f9c2b1a-4d5e-4f60-8a7b-9c0d1e2f3a4b",
		"music_favorite:12",
	} {
		pick, ok := byRef[ref]
		if !ok {
			t.Fatalf("%s missing from the pool", ref)
		}
		if len(pick.segs) != 3 {
			t.Fatalf("%s: want 3 segments preserved, got %d", ref, len(pick.segs))
		}
		for _, seg := range pick.segs {
			if seg.FX != nil {
				t.Errorf("%s seg %d: stored fx %d survived into the DJ pool", ref, seg.ID, *seg.FX)
			}
			if seg.SX != nil || seg.IX != nil {
				t.Errorf("%s seg %d: stored sx/ix survived: %+v", ref, seg.ID, seg)
			}
			if seg.On != nil || seg.Reverse != nil || seg.Mirror != nil {
				t.Errorf("%s seg %d: stored on/reverse/mirror survived: %+v", ref, seg.ID, seg)
			}
		}
		// Colour is the whole point of carrying segments at all — stripping it
		// would make this test pass while deleting the feature.
		if pick.segs[0].Col == nil || (*pick.segs[0].Col)[0] != [4]int{255, 0, 0, 0} {
			t.Errorf("%s seg 0: colour must survive, got %+v", ref, pick.segs[0])
		}
		if pick.segs[1].Pal == nil || *pick.segs[1].Pal != 6 {
			t.Errorf("%s seg 1: per-segment palette must survive, got %+v", ref, pick.segs[1])
		}
		if !pick.remixable {
			t.Errorf("%s: a colour-carrying look must stay remixable after sanitization", ref)
		}
	}
}

// A stored on:false must be neither honoured nor inverted — the key is simply
// never emitted. MusicSegmentConfig's pointer+omitempty fields are what makes
// "absent" distinguishable from "present at false" on the wire, so the control
// half of this test proves the distinction is real rather than assumed.
func TestStoredSegmentOnFalseIsNeverEmitted(t *testing.T) {
	byRef := djPoolWithStoredSegs(t)
	pick := byRef["music_favorite:12"]
	var dark *MusicSegmentConfig
	for i := range pick.segs {
		if pick.segs[i].ID == 3 {
			dark = &pick.segs[i]
		}
	}
	if dark == nil {
		t.Fatal("segment 3 missing from the pick")
	}
	if dark.On != nil {
		t.Fatalf("stored on:false survived as %v — the DJ does not own segment on/off", *dark.On)
	}
	blob, err := json.Marshal(*dark)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var keys map[string]json.RawMessage
	if err := json.Unmarshal(blob, &keys); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, present := keys["on"]; present {
		t.Fatalf(`emitted config carries an "on" key: %s`, blob)
	}
	if _, present := keys["col"]; !present {
		t.Fatalf("colour must still be emitted: %s", blob)
	}

	// CONTROL: an explicitly-false On is emitted as "on":false, so the
	// assertion above is about absence and not about omitempty swallowing
	// every false value it sees.
	no := false
	ctrl, err := json.Marshal(MusicSegmentConfig{ID: 3, On: &no})
	if err != nil {
		t.Fatalf("marshal control: %v", err)
	}
	if string(ctrl) != `{"id":3,"on":false}` {
		t.Fatalf("wire format changed — absent and false are no longer distinguishable: %s", ctrl)
	}
}

func TestDJSanitizeStoredSegsDoesNotMutateInput(t *testing.T) {
	fx, sx, on := 22, 255, true
	col := RGBWStops{{1, 2, 3, 0}, {0, 0, 0, 0}, {0, 0, 0, 0}}
	in := []MusicSegmentConfig{{ID: 0, FX: &fx, SX: &sx, On: &on, Col: &col}}

	out := djSanitizeStoredSegs(in)
	if out[0].FX != nil {
		t.Fatal("output kept fx")
	}
	if in[0].FX == nil || *in[0].FX != 22 || in[0].SX == nil || in[0].On == nil {
		t.Fatalf("sanitization mutated the stored look: %+v", in[0])
	}
	// The colour pointer must be a copy too, or writing through the pick's
	// segment would edit the user's stored preset in memory.
	if out[0].Col == in[0].Col {
		t.Fatal("colour pointer is shared with the stored look")
	}
	(*out[0].Col)[0] = [4]int{9, 9, 9, 9}
	if (*in[0].Col)[0] != [4]int{1, 2, 3, 0} {
		t.Fatal("writing through the sanitized copy changed the stored look")
	}
	if djSanitizeStoredSegs(nil) != nil {
		t.Fatal("nil in, nil out")
	}
}

// Sanitization is scoped to the Auto DJ pool. The manual "tap a preset" route
// unmarshals segment_configs straight into []MusicSegmentConfig
// (routes/led_routes.go, applyMusicPreset) and must keep honouring everything
// the user stored — otherwise this change quietly removes a feature from the
// path nobody asked about.
func TestSanitizationIsScopedToTheDJPool(t *testing.T) {
	_, favPayload := storedSegsPayloads()
	var upd MusicConfigUpdate
	if err := json.Unmarshal(favPayload, &upd); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(upd.SegmentConfigs) != 3 || upd.SegmentConfigs[0].FX == nil || *upd.SegmentConfigs[0].FX != 22 {
		t.Fatalf("the manual apply path must still read stored fx: %+v", upd.SegmentConfigs)
	}
	if upd.SegmentConfigs[0].On == nil || !*upd.SegmentConfigs[0].On {
		t.Fatalf("the manual apply path must still read stored on: %+v", upd.SegmentConfigs[0])
	}
	if djd := djSegsFromMusicConfig(upd); djd[0].FX != nil || djd[0].On != nil {
		t.Fatalf("the DJ path must strip what the manual path keeps: %+v", djd[0])
	}
	// ...and reading it for the DJ must not have damaged the caller's copy.
	if upd.SegmentConfigs[0].FX == nil {
		t.Fatal("djSegsFromMusicConfig mutated its argument")
	}
}
