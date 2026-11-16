"""The Director's edits win over this folder's generators (S31, 2026-11-15).

From Nov 15 2026 Vico edits this cut himself in the Director (people, their paths and pose keys, cameras, the room).
The Director import (tools/experience/build-round8-director.py) marks a chapter it really changed:

    shot['directorEdited'] = {'at': '<UTC ISO>', 'fields': ['people', 'cameraPlan', ...]}

review-cut.json is then the source of truth for those fields. A generator here (build-cine-cut.py,
build-oilers-story.py, build-screens.py) that would change such a field stops without writing anything, unless it is
run with --overwrite-director-edits (which throws his edit of that field away: only on his word).
A field the Director did not touch (say `screens` on a chapter where he moved a person) is still the generator's.
"""
import sys

FLAG = '--overwrite-director-edits'


def clashes(before, after):
    """[(chapter id, [fields])]: the fields a run would change that the Director edited. before/after: cut dicts."""
    old = {s['id']: s for s in before.get('shots', [])}
    out = []
    for shot in after.get('shots', []):
        was = old.get(shot['id'])
        mark = (was or {}).get('directorEdited')
        if not isinstance(mark, dict): continue
        fields = mark.get('fields')
        changed = [k for k in sorted(set(was) | set(shot)) if k != 'directorEdited' and was.get(k) != shot.get(k)]
        hit = changed if not isinstance(fields, list) else [k for k in changed if k in fields]   # (no list: the whole chapter is his)
        if hit: out.append((shot['id'], hit))
    return out


def guard(before, after, argv=None, who='this generator'):
    """Call before writing. Exits with a message when the run would overwrite a Director edit and FLAG is not given."""
    argv = sys.argv if argv is None else argv
    found = clashes(before, after)
    if not found or FLAG in argv: return found
    lines = ['%s: %s' % (cid, ', '.join(fields)) for cid, fields in found]
    sys.exit('%s would overwrite what was edited in the Director:\n  %s\nNothing was written. review-cut.json is the source of truth '
             'for these fields; change the generator to match it, or run again with %s (that discards the Director edit).'
             % (who, '\n  '.join(lines), FLAG))
