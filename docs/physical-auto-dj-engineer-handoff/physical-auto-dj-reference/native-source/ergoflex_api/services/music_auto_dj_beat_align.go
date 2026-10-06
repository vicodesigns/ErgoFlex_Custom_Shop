// services/music_auto_dj_beat_align.go
// Phase 2: a PHRASE rotation waits for the next beat instead of firing on
// whichever 500ms tick noticed the bar count was reached.
//
// WHAT THIS IS NOT. It does not align to the DOWNBEAT, and the difference is not
// pedantry — the data will not support one. music_analyzer.py initialises
// beat_in_bar to 0, resets it to 0 on every tempo unlock, and increments it % 4
// on each PLL phase wrap. Nothing anywhere scores accent across the four beat
// slots, so beat_in_bar == 0 sits on the true musical downbeat about one time in
// four and is never corrected. The BEAT phase is genuine — a free-running PLL
// nudged only by near-grid detections at PHASE_CORRECT_GAIN 0.15, halved from
// 0.30 in 2026-07 because the higher gain wobbled the grid +/-38ms per beat. So
// this aligns to the thing that is actually measured.
//
// WHY PHRASE ONLY. Drops and quiet transitions are REACTIVE: djDecide fires them
// off met.Flags and their entire value is immediacy. Holding a slam for up to a
// beat (~666ms at 90 BPM) outlives the analyzer's own DROP_LATCH_SEC of 0.6s, so
// the slam would land after the moment it was reacting to.
//
// WHAT IT DOES NOT COMPENSATE FOR. sync_offset_ms is a HOST-side delay line:
// UpdateMetrics releases frames `offset` ms late so the strip matches audio
// arriving through a laggy Bluetooth speaker. The phase this reads is therefore
// already in the listener's timeline. Adding the offset again here would
// double-count it.

package services

import (
	"log"
	"time"
)

const (
	// djBeatAlignLeadMs is how early the write is issued so the pixels change ON
	// the beat rather than after it.
	//
	// A FIXED CONSTANT, and an EWMA of observed latency was considered and
	// rejected. What it would track is the serial pacer (0 or ~250ms) plus the
	// logical write hold (132-155ms mean, 272ms max) — a BIMODAL quantity, where
	// a moving average either lags a contention episode exactly when it matters
	// or overreacts to a single sample. It would also put wall-clock state into
	// the one part of the DJ that is deliberately pure and table-testable.
	//
	// Be honest about the budget this buys: pacer 0-250ms plus hold 130-280ms is
	// up to ~500ms of landing spread against a 700ms crossfade that absorbs most
	// of it. The win is removing the 500ms TICK QUANTISATION and firing at a
	// defined musical position — not sub-100ms precision.
	djBeatAlignLeadMs = 150

	// djBeatMetricsMaxAge bounds how stale the phase sample may be before the
	// alignment is abandoned and the switch applied immediately.
	//
	// The sample is normally under 10ms old at tick time (the analyzer runs near
	// 100Hz), but it is UNBOUNDED if the Python process stalls — and scheduling a
	// fire off a frozen phase is a silent wrong answer rather than a loud one.
	djBeatMetricsMaxAge = 100 * time.Millisecond
)

// armedSwitch is a decided action deliberately held until a beat instant.
//
// Separate from blockedSwitch on purpose. They are different state machines: a
// blocked action wants to apply AS SOON AS POSSIBLE and is retried every tick,
// while an armed one wants to apply at exactly ONE future instant and must
// REFUSE any earlier attempt. Merging them into one slot means the tick-driven
// retry cannot tell which rule applies, fires the armed action early, and then
// the still-running timer fires again into a slot that was already cleared.
type armedSwitch struct {
	act        *djAction
	rev        uint64
	baseline   djBaseline
	programKey string
	timer      *time.Timer

	// Carried because none of it is recoverable after the fire, and without it
	// the commit diagnostic cannot be emitted at all.
	armedAt       time.Time
	scheduledWait time.Duration
	sampleAgeMs   int64
	armedPhase    uint8
	bpm           uint8
}

// msUntilAlignedFire returns how long to wait so the write LANDS on the next
// beat, and false when there is nothing to align to.
//
// Pure, and separated from the loop for the same reason djDecide is: the
// interesting cases are combinations of (tempo, phase, lead) and driving them
// through a 500ms ticker to reach them would be slow and flaky.
func msUntilAlignedFire(met AudioMetrics, sampleAge time.Duration, leadMs int) (time.Duration, bool) {
	if met.Bpm == 0 {
		return 0, false // no tempo lock — bph is frozen and means nothing
	}
	if sampleAge < 0 || sampleAge > djBeatMetricsMaxAge {
		return 0, false // stale or impossible sample; do not schedule off it
	}
	beat := 60000.0 / float64(met.Bpm)
	remaining := (1.0 - float64(met.BeatPhase)/256.0) * beat
	wait := remaining - float64(leadMs)
	for wait < 0 {
		wait += beat // the next beat is already too close; take the one after
	}
	if wait > beat {
		wait = beat // never defer a switch by more than one beat
	}
	return time.Duration(wait * float64(time.Millisecond)), true
}

// cancelArmed stops an armed switch and counts it.
//
// Always via Stop() on the existing timer and a fresh timer on the next arm —
// never Timer.Reset, whose contract requires a stopped-and-drained timer and
// whose misuse is how a superseded action still fires.
func (m *MusicModeService) cancelArmed(st *autoDJState, why string) {
	if st.beatArmed == nil {
		return
	}
	st.beatArmed.timer.Stop()
	m.djArmedDropped.Add(1)
	log.Printf("[MUSIC-DJ] beat-armed %s → %s cancelled (%s)",
		st.beatArmed.act.reason, st.beatArmed.act.label, why)
	ce := djBaseEvent("cancelled", st.beatArmed.act, st.beatArmed.programKey)
	ce.Why = why
	m.djRec.addEvent(time.Now(), ce)
	st.beatArmed = nil
}

// noteBeatAlignCommit is the diagnostic the hardware check reads.
//
// The claim "switches now land on the beat" is only testable against a
// DISTRIBUTION of commit-time phase: uniform across 0-255 means the alignment is
// doing nothing, clustered near 0 means it is working. One line per phrase
// switch, which is at least djHardFloorSec apart, so it needs no throttle.
func (m *MusicModeService) noteBeatAlignCommit(a *armedSwitch, fireMet, commitMet AudioMetrics, now time.Time) {
	// off_beat is the signed distance from the nearest beat, in phase counts
	// folded to [-128, +128]: negative landed early, positive landed late. That
	// fold is what makes the number readable — a raw phase of 250 is 6 counts
	// BEFORE the beat, not 250 counts after it, and averaging raw phase across
	// the wrap would report the exact opposite of the truth.
	off := int(commitMet.BeatPhase)
	if off > 128 {
		off -= 256
	}
	log.Printf("[MUSIC-DJ-BEAT] %s → %s commit_phase=%d off_beat=%+d "+
		"(armed_phase=%d fire_phase=%d bpm=%d) scheduled=%v elapsed=%v sample_age=%dms",
		a.act.reason, a.act.label, commitMet.BeatPhase, off,
		a.armedPhase, fireMet.BeatPhase, a.bpm,
		a.scheduledWait.Round(time.Millisecond),
		now.Sub(a.armedAt).Round(time.Millisecond), a.sampleAgeMs)
}

// DJBeatAlignStats are the armed-switch counters, process-wide and cumulative
// like the deferral set, and carried with their denominator for the same reason.
type DJBeatAlignStats struct {
	SwitchesArmed uint64 `json:"switches_armed"`
	// The three ways an arming ends. They MUST sum to SwitchesArmed, or an armed
	// switch went somewhere nobody is accounting for:
	//
	//	ArmedFired    the beat came and the write landed — alignment achieved
	//	ArmedDeferred the beat came, the strip was busy, and the action was handed
	//	              to the blocked ledger. Terminal for ALIGNMENT specifically:
	//	              it will land whenever the gate frees, which is not on a beat.
	//	              Its landing is then counted in switches_applied_late.
	//	ArmedDropped  it never landed at all — superseded, retired runtime,
	//	              non-gate failure, or the conductor stopped.
	ArmedFired    uint64 `json:"armed_fired"`
	ArmedDeferred uint64 `json:"armed_deferred"`
	ArmedDropped  uint64 `json:"armed_dropped"`
}

// DJBeatAlignSnapshot returns the counters. Nil-safe, like the others.
func (m *MusicModeService) DJBeatAlignSnapshot() DJBeatAlignStats {
	if m == nil {
		return DJBeatAlignStats{}
	}
	return DJBeatAlignStats{
		SwitchesArmed: m.djSwitchesArmed.Load(),
		ArmedFired:    m.djArmedFired.Load(),
		ArmedDeferred: m.djArmedDeferred.Load(),
		ArmedDropped:  m.djArmedDropped.Load(),
	}
}
