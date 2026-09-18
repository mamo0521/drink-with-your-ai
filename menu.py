# -*- coding: utf-8 -*-
"""酒单：优先读你自己写的 data/prompts/activities/bar.md，没有就用出厂酒单 content/bar.default.md。
（由 mamo-home 的导出脚本从网关源码拼出来，别手改；要改解析去上游改。）"""
import re
from pathlib import Path

import _lib

_BAR_FACTORY = Path(__file__).resolve().parent / "content" / "bar.default.md"
_BAR_MENU_DEFAULT = [{'name': '威士忌', 'std': 1.0, 'emoji': '🥃'}, {'name': '啤酒', 'std': 0.5, 'emoji': '🍺'}, {'name': '清酒', 'std': 0.7, 'emoji': '🍶'}, {'name': '梅子酒', 'std': 0.6, 'emoji': '🍑'}, {'name': '金汤力', 'std': 0.8, 'emoji': '🍸'}, {'name': '长岛冰茶', 'std': 2.5, 'emoji': '🍹'}]


def _bar_factory_text():
    """出厂酒单（分发随包）：新装的玩家还没写自己的酒单时用它；人称统一「我=Ta、你=客人」，不含任何私人内容。"""
    try:
        return _BAR_FACTORY.read_text(encoding="utf-8")
    except Exception:
        return ""


def _bar_text():
    """玩家自己的酒单优先；vault 里还没有（或是空的）就用出厂酒单。"""
    try:
        text = (_lib.vault_path() / "prompts" / "activities" / "bar.md").read_text(encoding="utf-8")
    except Exception:
        text = ""
    return text if text.strip() else _bar_factory_text()


def _bar_title():
    """酒单标题 = bar.md 第一个 `# ` 标题（小机给吧台起的名字）；没有 → 前端用默认。"""
    m = re.search(r"^#\s+(.+?)\s*$", _bar_text(), re.M)
    return m.group(1).strip() if m else ""


def _bar_menu():
    """酒单机制层：**优先解析 vault prompts/activities/bar.md**（小机的酒单；在吧台编辑器里改）。
    v3（mamo 效果图版）：按 `##` 小节分组（group）+ 条目后的散文当简介（desc）——
    `**名字 · X 杯** emoji` = 酒；茶水类小节（标题含 茶水/无酒精/不入醉）里 `**名字** emoji` = 0 杯。
    条目下一行可写 `英文名：Whisky`，返回可选展示字段 name_en；留空/省略不自动补译。
    其他小节里没有杯数的加粗（规矩强调）不当条目。解析不到 → 内置默认单。config 仍可整体覆盖。"""
    text = _bar_text()
    items = []
    if text:
        parts = re.split(r"^##\s*(.+?)\s*$", text, flags=re.M)
        pairs = [("", parts[0])] + [(parts[i], parts[i + 1]) for i in range(1, len(parts) - 1, 2)]
        entry_re = re.compile(r"\*\*[「『\"]?(.+?)[」』\"]?(?:\s*·\s*(?:醉意\s*\+?\s*)?([0-9.]+)\s*(?:杯)?)?\*\*[ \t]*([^\s*]*)")
        for head, body in pairs:
            tea_sec = any(k in head for k in ("茶水", "无酒精", "不入醉"))
            ms = list(entry_re.finditer(body))
            for i, m in enumerate(ms):
                name = m.group(1).strip()
                if m.group(2):
                    try:
                        std = float(m.group(2))
                    except ValueError:
                        continue
                elif tea_sec:
                    if "·" in name or "杯" in name:
                        continue
                    std = 0.0
                else:
                    continue
                desc = body[m.end(): ms[i + 1].start() if i + 1 < len(ms) else len(body)]
                english = re.match(r"\s*英文名[：:][ \t]*([^\r\n]*)(?:\r?\n|$)", desc)
                name_en = english.group(1).strip() if english else ""
                if english:
                    desc = desc[english.end():]
                desc = re.sub(r"[*_`#]+", "", desc)
                desc = re.sub(r"^[ \t>·—-]+", "", desc.strip())
                desc = re.sub(r"\s*\n+\s*", " ", desc).strip()[:200]
                items.append({"name": name, "name_en": name_en, "std": std,
                              "emoji": (m.group(3) or ("🍵" if std == 0 else "🍶")).strip(),
                              "group": head.strip(), "desc": desc})
    return items if items else list(_BAR_MENU_DEFAULT)
