#!/usr/bin/env python3
"""
微信朋友圈截图 OCR 脚本（MVP）

读取最新 capture session 中的截图，使用 PaddleOCR 进行中文 OCR，
输出 JSON 结果到 session 的 ocr/ 目录。

依赖安装（PaddleOCR 推荐 GPU）：
    pip install paddlepaddle paddleocr
    或 CPU only:
    pip install paddlepaddle paddleocr --upgrade

如果 PaddleOCR 安装困难，备选方案：
    pip install easyocr

用法：
    python scripts/ocr-wechat-moments.py
    python scripts/ocr-wechat-moments.py --session session-20260709-123456
    python scripts/ocr-wechat-moments.py --skip-ocr   # 仅合并已有 OCR 结果
"""

import argparse
import json
import os
import sys
import glob
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent.resolve()
ROOT = SCRIPT_DIR.parent
RAW_DIR = ROOT / "data" / "wechat-moments" / "raw"


def find_latest_session():
    """Find the most recent capture session directory."""
    if not RAW_DIR.exists():
        print(f"  ✗ 目录不存在: {RAW_DIR}")
        sys.exit(1)

    sessions = sorted(
        [d for d in RAW_DIR.iterdir() if d.is_dir() and d.name.startswith("session-")],
        reverse=True,
    )
    if not sessions:
        print(f"  ✗ 未找到 session 目录（{RAW_DIR}/session-*）")
        print(f"    请先运行 npm run capture:wechat-moments")
        sys.exit(1)

    return sessions[0]


def find_screenshots(session_dir):
    """Find all PNG screenshots in the session."""
    ss_dir = session_dir / "screenshots"
    if not ss_dir.exists():
        print(f"  ✗ 截图目录不存在: {ss_dir}")
        sys.exit(1)

    files = sorted(ss_dir.glob("screenshot-*.png"))
    if not files:
        print(f"  ✗ 未找到截图文件（{ss_dir}/screenshot-*.png）")
        sys.exit(1)

    return files


def load_session_ocr(session_dir):
    """Load existing OCR results, return dict of {filename: data}."""
    ocr_dir = session_dir / "ocr"
    results = {}
    if ocr_dir.exists():
        for f in sorted(ocr_dir.glob("screenshot-*.json")):
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    results[f.name] = json.load(fh)
            except Exception as e:
                print(f"  ! 读取 OCR 结果失败: {f.name} — {e}")
    return results


def run_paddleocr(screenshots, session_dir, existing):
    """Run PaddleOCR on screenshots that don't have existing results."""
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        print("\n  PaddleOCR 未安装。请运行：")
        print("    pip install paddlepaddle paddleocr")
        print("\n  备选方案（easyocr）：")
        print("    修改本脚本顶部 USE_ENGINE = 'easyocr'")
        print("    并运行: pip install easyocr")
        print("\n  或者跳过 OCR 步骤手动标注：")
        print("    python scripts/ocr-wechat-moments.py --skip-ocr")
        sys.exit(1)

    print("  PaddleOCR 初始化（首次加载较慢）...")
    ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False, use_gpu=False)

    ocr_dir = session_dir / "ocr"
    ocr_dir.mkdir(parents=True, exist_ok=True)

    for fp in screenshots:
        fname = fp.name
        json_path = ocr_dir / (fname.replace(".png", ".json"))

        if fname in existing:
            print(f"  ✓ {fname} — 已有 OCR 结果，跳过")
            continue

        print(f"  OCR: {fname} ...", end=" ", flush=True)
        try:
            result = ocr.ocr(str(fp), cls=True)
            lines = []
            if result and result[0]:
                for line in result[0]:
                    bbox = line[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
                    text, confidence = line[1]
                    lines.append({
                        "text": text,
                        "confidence": round(confidence, 4),
                        "bbox": [[round(p[0], 1), round(p[1], 1)] for p in bbox],
                    })

            output = {
                "source": fname,
                "imageWidth": None,
                "imageHeight": None,
                "lines": lines,
                "lineCount": len(lines),
            }

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False, indent=2)

            print(f"{len(lines)} 行文字 (avg conf: {_avg_conf(lines):.3f})")

        except Exception as e:
            print(f"失败: {e}")


def run_easyocr(screenshots, session_dir, existing):
    """Fallback: use EasyOCR instead of PaddleOCR."""
    try:
        import easyocr
    except ImportError:
        print("\n  easyocr 未安装。请运行：")
        print("    pip install easyocr")
        sys.exit(1)

    print("  EasyOCR 初始化（首次加载较慢）...")
    reader = easyocr.Reader(["ch_sim", "en"], gpu=False)

    ocr_dir = session_dir / "ocr"
    ocr_dir.mkdir(parents=True, exist_ok=True)

    for fp in screenshots:
        fname = fp.name
        json_path = ocr_dir / (fname.replace(".png", ".json"))

        if fname in existing:
            print(f"  ✓ {fname} — 已有 OCR 结果，跳过")
            continue

        print(f"  OCR: {fname} ...", end=" ", flush=True)
        try:
            result = reader.readtext(str(fp))
            lines = []
            for bbox, text, confidence in result:
                lines.append({
                    "text": text,
                    "confidence": round(confidence, 4),
                    "bbox": [[round(p[0], 1), round(p[1], 1)] for p in bbox],
                })

            output = {
                "source": fname,
                "imageWidth": None,
                "imageHeight": None,
                "lines": lines,
                "lineCount": len(lines),
            }

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(output, f, ensure_ascii=False, indent=2)

            print(f"{len(lines)} 行文字 (avg conf: {_avg_conf(lines):.3f})")

        except Exception as e:
            print(f"失败: {e}")


def _avg_conf(lines):
    if not lines:
        return 0.0
    return sum(l["confidence"] for l in lines) / len(lines)


# ── Pick engine ────────────────────────────────────────────────────────────
USE_ENGINE = "paddleocr"  # change to "easyocr" for fallback


def main():
    parser = argparse.ArgumentParser(description="微信朋友圈截图 OCR")
    parser.add_argument("--session", help="指定 session 目录名，不填则使用最新的")
    parser.add_argument("--skip-ocr", action="store_true", help="跳过 OCR，仅输出 session 信息")
    parser.add_argument("--engine", choices=["paddleocr", "easyocr"], default=USE_ENGINE,
                        help="OCR 引擎 (默认: paddleocr)")
    args = parser.parse_args()

    print(f"\n{'═' * 50}")
    print(f"  微信朋友圈截图 OCR")
    print(f"{'═' * 50}\n")

    # Find session
    if args.session:
        session_dir = RAW_DIR / args.session
        if not session_dir.exists():
            print(f"  ✗ session 目录不存在: {session_dir}")
            sys.exit(1)
    else:
        session_dir = find_latest_session()

    print(f"  会话目录: {session_dir}")

    # Find screenshots
    screenshots = find_screenshots(session_dir)
    print(f"  截图数量: {len(screenshots)}")

    # Load existing OCR results
    existing = load_session_ocr(session_dir)
    print(f"  已有 OCR: {len(existing)}")

    if args.skip_ocr:
        print(f"\n  --skip-ocr 模式，未执行 OCR。")
        print(f"  OCR 结果目录: {session_dir / 'ocr'}")
        _print_summary(session_dir, screenshots, existing)
        return

    # Run OCR
    engine = args.engine
    print(f"\n  开始 OCR（引擎: {engine}）...\n")

    if engine == "paddleocr":
        run_paddleocr(screenshots, session_dir, existing)
    else:
        run_easyocr(screenshots, session_dir, existing)

    # Summary
    final_ocr = load_session_ocr(session_dir)
    print(f"\n{'─' * 50}")
    print(f"  OCR 完成:")
    print(f"  截图:     {len(screenshots)}")
    print(f"  OCR 结果: {len(final_ocr)}")
    print(f"  目录:     {session_dir / 'ocr'}")
    print(f"\n  下一步: npm run review:wechat-moments")
    print(f"{'─' * 50}\n")


def _print_summary(session_dir, screenshots, existing):
    print(f"\n  OCR 结果汇总:")
    print(f"  截图:     {len(screenshots)}")
    print(f"  OCR 完成: {len(existing)}/{len(screenshots)}")
    print(f"  OCR 目录: {session_dir / 'ocr'}")
    for fname, data in sorted(existing.items()):
        lines = data.get("lines", [])
        texts = [l["text"][:40] for l in lines[:3]]
        print(f"    {fname}: {len(lines)} 行 — {' | '.join(texts)}...")


if __name__ == "__main__":
    main()
