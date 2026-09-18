#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把这个目录打成 Claude 桌面 App 能双击安装的 .mcpb（就是个 zip，标准库搞定）。

    python3 pack_mcpb.py            # 产出 drink-with-xiaoji-<版本>.mcpb

版本号取 manifest.json 里的 version。只收游戏本体，不收存档与 .git。
"""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
OUT = ROOT / f"{MANIFEST['name']}-{MANIFEST['version']}.mcpb"
SKIP_DIRS = {"data", ".git", "__pycache__", "docs", ".github"}


def main():
    n = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(ROOT.glob("*")):
            if p.is_file() and p.suffix in (".py", ".json", ".md", ".png") or p.name in ("LICENSE",):
                if p.name != "pack_mcpb.py":
                    z.write(p, p.name); n += 1
        for top in ("content", "web"):
            for p in sorted((ROOT / top).rglob("*")):
                if p.is_file() and not any(d in p.parts for d in SKIP_DIRS) and p.name != ".DS_Store":
                    z.write(p, str(p.relative_to(ROOT))); n += 1
    print(f"✓ {OUT.name}（{n} 个文件，{OUT.stat().st_size / 1048576:.1f} MB）")
    print("  Claude 桌面 App 里双击它就能装；装完浏览器打开 http://127.0.0.1:8766")


if __name__ == "__main__":
    main()
