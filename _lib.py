# -*- coding: utf-8 -*-
"""本地小底座。存档和你写的酒单 / 题库 / 醉态口吻都放在**用户目录**里——
macOS `~/Library/Application Support/drink-with-your-ai/`，Windows `%APPDATA%\\drink-with-your-ai\\`，Linux `~/.local/share/drink-with-your-ai/`；
环境变量 BAR_DATA 可以改。放用户目录是为了：安装包升级不丢存档，同一台电脑上不管谁拉起这份代码都是同一间吧台。时间用本机时区。"""
import json
import os
import re
from datetime import datetime
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent
NAME = "drink-with-your-ai"
OLD_NAMES = ("drink-with-xiaoji",)   # 1.0.4 及之前的存档文件夹名；第一次启动时整个搬到新名字下，什么都不丢


def _data_dir():
    env = os.environ.get("BAR_DATA")
    if env:
        return Path(env)
    import sys
    if sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    elif os.name == "nt":
        base = Path(os.environ.get("APPDATA") or Path.home())
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    new = base / NAME
    if not new.exists():
        for old in OLD_NAMES:
            if (base / old).is_dir():
                try:
                    (base / old).rename(new)
                except OSError:
                    return base / old      # 搬不动（被占用等）就先继续用旧的，不让人丢存档
                break
    return new


DATA = _data_dir()


def vault_path():
    """沿用上游的叫法：你的私人内容根目录（见文件头）。"""
    DATA.mkdir(parents=True, exist_ok=True)
    return DATA


def now():
    return datetime.now().astimezone()


def now_iso():
    return now().isoformat(timespec="seconds")


def load_config():
    """数据目录里的 config.json（可没有）。目前只认 activities.bar.player_name = 写给小机看的字里怎么称呼你。"""
    try:
        return json.loads((vault_path() / "config.json").read_text(encoding="utf-8"))
    except Exception:
        return {}


def parse_frontmatter(text):
    """开头 `---` 包着的 `键: 值` 几行 → (meta, 正文)。没有就 ({}, 原文)。"""
    lines = str(text).lstrip("﻿").splitlines()
    i = 0
    while i < len(lines) and not lines[i].strip():
        i += 1
    if i >= len(lines) or lines[i].strip() != "---":
        return {}, text
    meta, i = {}, i + 1
    while i < len(lines) and lines[i].strip() != "---":
        if ":" in lines[i] and not lines[i].strip().startswith("#"):
            k, _, v = lines[i].partition(":")
            v = re.split(r"\s+#", v, maxsplit=1)[0].strip()
            try:
                meta[k.strip()] = float(v) if re.fullmatch(r"-?\d+(\.\d+)?", v) else v
            except ValueError:
                meta[k.strip()] = v
        i += 1
    return meta, "\n".join(lines[i + 1:])
