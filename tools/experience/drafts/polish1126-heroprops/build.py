#!/usr/bin/env python3
"""Build a Director import for the approved Hero prop layout from the current cut."""

import argparse
import json
import runpy
import subprocess
from pathlib import Path


def load(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def build(cut, output, changes):
    shot = next(shot for shot in load(cut / "review-cut.json")["shots"] if shot["id"] == "hero")
    stored = load(cut / "director-camera-hero.json")
    props = [dict(edit) for edit in stored.get("props", [])]
    for ident, (desk, _) in changes["CHANGE"].items():
        if not any(edit.get("desk") == desk and edit.get("add") and
                   ident in (edit.get("id"), f'{edit.get("id")}:{edit["add"]["asset"]}')
                   for edit in props):
            raise ValueError(f"Hero: current Director props are missing {ident} on {desk}")
    log = []
    changes["walk"](props, "propEdits", log)

    output.parent.mkdir(parents=True, exist_ok=True)
    bridge = Path(__file__).resolve().parents[2] / "director-bridge.py"
    # Build from the current film plan. A previously downloaded export can carry stale camera and motion.
    subprocess.run(["python3", str(bridge), "link", str(cut / "review-cut.json"), "--shot", "hero",
                    "--json", str(output)], check=True, stdout=subprocess.DEVNULL)
    draft = load(output)
    draft["id"] = f'film-{load(cut / "cut.json")["id"]}-hero'
    draft["name"] = "Hero · approved architect and office props"
    client_shot = draft["shots"][0]
    client_shot["propEdits"] = props
    # The importer keeps only lighting fields present in the export.
    lighting = stored.get("lighting", {})
    for field, value in lighting.items():
        if field in ("screens", "ledStatus", "ledNeutral", "ledColor", "lights", "lightEdits", "timeOfDay", "statusLight"):
            client_shot[field] = value
        else:
            client_shot.setdefault("sceneGlobals", {})[field] = value
    assert client_shot["seconds"] == shot["seconds"]
    output.write_text(json.dumps(draft, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{output}: {len(props)} Director props, {len(log)} approved changes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cut", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    patch = Path(__file__).with_name("apply-heroprops.py")
    if not patch.is_file():
        parser.error(f"Missing prop layout {patch}")
    build(args.cut, args.output, runpy.run_path(str(patch)))
