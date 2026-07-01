"""
Optional helper: download the actual videos referenced in FVC.csv (or
FVC_dup.csv) so that the URL-only dataset you uploaded can be turned into
real training data. Many links from this corpus are old and dead -- this
script logs failures instead of crashing, and writes a manifest of what
actually downloaded successfully with its label, ready to feed into
face_extraction.py or video_model/dataset.py.

Usage:
    python utils/download_fvc_videos.py --csv FVC.csv --output_dir data/raw_videos_fvc
"""
import argparse
import csv
from pathlib import Path

from yt_dlp import YoutubeDL


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True, help="Path to FVC.csv or FVC_dup.csv")
    parser.add_argument("--output_dir", required=True)
    args = parser.parse_args()

    out_root = Path(args.output_dir)
    (out_root / "real").mkdir(parents=True, exist_ok=True)
    (out_root / "fake").mkdir(parents=True, exist_ok=True)

    manifest_rows = []
    ydl_opts_base = {
        "format": "best[ext=mp4]/best",
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": True,
    }

    with open(args.csv, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Found {len(rows)} entries in {args.csv}")
    succeeded, failed = 0, 0

    for row in rows:
        cascade_id = row["cascade_id"]
        url = row["video_url"]
        label = row["label"].strip().lower()
        if label not in ("real", "fake"):
            continue

        out_path = out_root / label / f"{cascade_id}.mp4"
        if out_path.exists():
            succeeded += 1
            manifest_rows.append((str(out_path), label))
            continue

        opts = dict(ydl_opts_base)
        opts["outtmpl"] = str(out_path)
        try:
            with YoutubeDL(opts) as ydl:
                ydl.download([url])
            if out_path.exists():
                succeeded += 1
                manifest_rows.append((str(out_path), label))
            else:
                failed += 1
        except Exception as e:
            failed += 1
            print(f"  [failed] {cascade_id} ({url}): {e}")

    manifest_path = out_root / "manifest.csv"
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["filepath", "label"])
        writer.writerows(manifest_rows)

    print(f"\nDone. Downloaded {succeeded}/{len(rows)} videos. Failed: {failed}.")
    print(f"Manifest written to {manifest_path}")
    print("Note: many links in this corpus are years old and routinely dead -- "
          "a low success rate is expected, not a bug. Treat this as a supplement "
          "to FaceForensics++/DFDC, not a replacement.")


if __name__ == "__main__":
    main()
