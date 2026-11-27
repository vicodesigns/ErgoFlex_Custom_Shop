#!/usr/bin/env python3
"""Build the Create prop export and optionally apply its two film-only edits to a scratch cut."""

import argparse
import json
import runpy
import subprocess
import sys
import tempfile
from pathlib import Path


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cut", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--stage-film-edits", action="store_true",
                        help="Hide the set square and add the level cup in the staged review-cut.json.")
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    root = here.parents[2]
    patch = runpy.run_path(str(here / "apply-createprops.py"))
    review_path = args.cut / "review-cut.json"
    review = read(review_path)
    shot = next(s for s in review["shots"] if s["id"] == "create")
    edited = [dict(e) for e in shot["sceneEdits"]]
    old_square = [e for e in edited if e.get("materialColor") == patch["SQUARE_COLOR"]]
    if len(old_square) != 1 or not any(e.get("id") == patch["ANCHOR"] for e in edited):
        parser.error("Create set square or right holder has changed. No files written.")
    patch["walk"](edited, "sceneEdits", [])
    added = {e.get("id") for e in edited}
    if not {"cr26shfR", "cr26plant", "cr26drink"} <= added:
        parser.error("Create prop patch did not produce every expected prop.")
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp) / "create.json"
        bridge = root / "tools" / "experience" / "director-bridge.py"
        subprocess.run([sys.executable, str(bridge), "link", str(review_path),
                        "--shot", "create", "--json", str(base)], check=True, stdout=subprocess.DEVNULL)
        draft = read(base)
    draft["id"] = f'film-{read(args.cut / "cut.json")["id"]}-create'
    draft["name"] = "Create · drafting cup, shelf plant and hidden set square"
    export = draft["shots"][0]
    stored = read(args.cut / "director-camera-create.json")
    for field, value in stored.get("lighting", {}).items():
        if field in ("screens", "ledStatus", "ledNeutral", "ledColor", "lights", "lightEdits", "timeOfDay", "statusLight"):
            export[field] = value
        else:
            export.setdefault("sceneGlobals", {})[field] = value
    export["propEdits"] = [e for e in edited if e.get("director")]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    write(args.output, draft)
    if args.stage_film_edits:
        # The material selector and level mount are film-only fields. The standard import preserves them.
        shot["sceneEdits"] = [e for e in edited if not e.get("director")] + [
            e for e in shot["sceneEdits"] if e.get("director")]
        write(review_path, review)
    print(f"{args.output}: {len(export['propEdits'])} Director props, with two film-only edits")


if __name__ == "__main__":
    main()
