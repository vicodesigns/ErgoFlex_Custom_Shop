#!/usr/bin/env python3
"""Build the Rise evening Director export. Capture and install the new portrait clip before importing."""

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOLS = HERE.parents[1]


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def build(cut, output):
    clip_module = (TOOLS / "screens" / "clips.mjs").as_uri()
    cue = json.loads(subprocess.check_output(
        ["node", "--input-type=module", "-e",
         "const {RISE_EVENING} = await import(process.argv[1]); console.log(JSON.stringify(RISE_EVENING));",
         clip_module], text=True))
    cut_data = cut / "review-cut.json"
    shot = next(item for item in read(cut_data)["shots"] if item["id"] == "rise")
    if shot["seconds"] != 28.5:
        raise ValueError("This cue is for the 28.5-second seated Rise chapter")

    screens = shot["screens"]
    portrait = next(screen for screen in screens if screen["target"] == "main-portrait")
    src = Path(portrait["src"])
    if src.stem not in ("cine3b-rise-portrait", cue["clip"]):
        raise ValueError(f"Unexpected Rise portrait source {src}")
    portrait["src"] = src.with_name(cue["clip"] + ".mp4").as_posix()
    if portrait.get("offset", 0) != 0 or portrait.get("editList"):
        raise ValueError("Rise portrait timing has changed. Recheck the LED cue against the screen edit.")

    neutral = shot["ledNeutral"]
    if neutral[0][0] != 0 or neutral[0][1] != "#929292":
        raise ValueError("Rise daytime LED keys have changed. Recheck the transition before replacing them.")
    if neutral[-2:] not in ([[19.9, "#929292"], [21.5, "#52483c"]],
                            [[cue["from"], "#929292"], [cue["to"], cue["color"]]]):
        raise ValueError("Rise evening LED keys have changed. Recheck the transition before replacing them.")
    new_neutral = [neutral[0], [cue["from"], neutral[0][1]], [cue["to"], cue["color"]]]

    with tempfile.TemporaryDirectory() as scratch:
        base = Path(scratch) / "rise.json"
        subprocess.run([sys.executable, str(TOOLS / "director-bridge.py"), "link", str(cut_data),
                        "--shot", "rise", "--json", str(base)], check=True, stdout=subprocess.DEVNULL)
        draft = read(base)
    draft["id"] = f'film-{read(cut / "cut.json")["id"]}-rise'
    draft["name"] = "Rise · warm-white evening cue after the stretch"
    export = draft["shots"][0]
    for field, value in read(cut / "director-camera-rise.json").get("lighting", {}).items():
        if field in ("screens", "ledStatus", "ledNeutral", "ledColor", "lights", "lightEdits", "timeOfDay", "statusLight"):
            export[field] = value
        else:
            export.setdefault("sceneGlobals", {})[field] = value
    export.update(screens=screens, ledNeutral=new_neutral)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(draft, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{output}: LED cue {cue['from']}–{cue['to']} s, needs {portrait['src']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cut", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.cut, args.output)
