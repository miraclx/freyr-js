#!/usr/bin/env python3

import os
import sys
import subprocess
from pathlib import Path

def check_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"],
                       stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL,
                       check=True)
    except Exception:
        print("Error: ffmpeg is not installed")
        sys.exit(1)

def collect_files(src: Path):
    return [p for p in src.rglob("*") if p.is_file() and p.suffix.lower() == ".m4a"]

def convert_file(src_file: Path, src_root: Path, dst_root: Path):
    rel = src_file.relative_to(src_root)
    out = dst_root / rel.with_suffix(".mp3")

    out.parent.mkdir(parents=True, exist_ok=True)

    if out.exists():
        return "skipped"

    cmd = [
        "ffmpeg",
        "-loglevel", "error",
        "-i", str(src_file),
        "-vn",                       # 关键：去掉视频流
        "-map_metadata", "0",
        "-c:a", "libmp3lame",
        "-q:a", "0",
        str(out)
    ]

    try:
        subprocess.run(cmd, check=True)
        return "success"
    except subprocess.CalledProcessError:
        return "failed"

def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input_dir> <output_dir>")
        sys.exit(1)

    src = Path(sys.argv[1]).resolve()
    dst = Path(sys.argv[2]).resolve()

    if not src.is_dir():
        print(f"Error: input directory does not exist: {src}")
        sys.exit(1)

    check_ffmpeg()

    print(f"Input : {src}")
    print(f"Output: {dst}")

    files = collect_files(src)
    total = len(files)

    if total == 0:
        print("No m4a files found.")
        return

    print(f"Total files: {total}")
    print("Start converting...\n")

    success = failed = skipped = 0

    for idx, file in enumerate(files, start=1):
        percent = int(idx * 100 / total)
        rel = file.relative_to(src)

        status = convert_file(file, src, dst)

        if status == "skipped":
            skipped += 1
            print(f"[{percent:3d}%] ({idx}/{total}) Skip: {rel}")
        elif status == "success":
            success += 1
            print(f"[{percent:3d}%] ({idx}/{total}) Done: {rel}")
        else:
            failed += 1
            print(f"[{percent:3d}%] ({idx}/{total}) Failed: {rel}")

    print("\n========== Summary ==========")
    print(f"Total   : {total}")
    print(f"Success : {success}")
    print(f"Skipped : {skipped}")
    print(f"Failed  : {failed}")
    print(f"Output  : {dst}")

if __name__ == "__main__":
    main()
