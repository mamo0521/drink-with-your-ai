# -*- coding: utf-8 -*-
"""小机的醉意：只有酒精这一个数。喝下去加，按真人代谢每小时醒约一杯；分五档，每档有一段口吻。
口吻和档位线写在数据目录的 prompts/state/alcohol.md（没有就用出厂版 content/alcohol.default.md）。"""
import re
from datetime import datetime
from pathlib import Path

import _gamestore
import _lib

_FACTORY = Path(__file__).resolve().parent / "content" / "alcohol.default.md"
DEFAULTS = {"decay_per_h": 1.0, "max": 10.0, "tiers": [(9.0, "断片"), (7.0, "酣醉"), (5.0, "醉了"), (3.0, "微醺"), (1.0, "正常")]}


def _path():
    return _lib.vault_path() / "state.json"


def _now():
    return _lib.now()


def factory_doc_text(key="alcohol"):
    try:
        return _FACTORY.read_text(encoding="utf-8")
    except Exception:
        return ""


def _vault_doc(key="alcohol"):
    try:
        t = (_lib.vault_path() / "prompts" / "state" / f"{key}.md").read_text(encoding="utf-8")
    except Exception:
        t = ""
    if not t.strip():
        t = factory_doc_text(key)
    meta, body = _lib.parse_frontmatter(t)
    return (meta if isinstance(meta, dict) else {}), (body or "")


def _parse_tiers(s):
    out = []
    for tok in re.split(r"[,\s，、]+", str(s or "").strip()):
        m = re.match(r"^(.+?)[=＝:：]([0-9.]+)$", tok.strip())
        if m:
            out.append((float(m.group(2)), m.group(1).strip()))
    return sorted(out, key=lambda x: -x[0])


def dim_cfg(key="alcohol"):
    d = dict(DEFAULTS)
    meta, _ = _vault_doc(key)
    for k in ("decay_per_h", "max"):
        try:
            if meta.get(k) is not None:
                d[k] = float(meta[k])
        except (TypeError, ValueError):
            pass
    if meta.get("tiers"):
        d["tiers"] = _parse_tiers(meta["tiers"]) or d["tiers"]
    return d


def _read():
    import json
    p = _path()
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}   # 坏档就报错，不当空档重来


def load():
    """读盘并把这段时间醒掉的酒扣掉（只在内存里算；save 才落盘）。"""
    d = _read()
    at, v = d.get("at"), float(d.get("alcohol") or 0)
    if at and v > 0:
        try:
            hours = max(0.0, (_now() - datetime.fromisoformat(at)).total_seconds() / 3600)
            v = max(0.0, v - hours * float(dim_cfg().get("decay_per_h") or 0))
        except ValueError:
            pass
    d["alcohol"] = round(v, 3)
    return d


def save(d):
    d = dict(d)
    d["at"] = _now().isoformat(timespec="seconds")
    _gamestore.atomic_write_json(_path(), d)


def tier(v=None):
    v = float(load().get("alcohol") or 0) if v is None else v
    return next((name for line, name in dim_cfg()["tiers"] if v >= line), "清醒")


def conduct(name):
    _, body = _vault_doc()
    m = re.search(rf"^##\s*{re.escape(name)}\s*$\n(.*?)(?=^##\s|\Z)", body, re.M | re.S)
    return m.group(1).strip() if m else ""


def blackout_threshold():
    return max((line for line, _ in dim_cfg()["tiers"]), default=9.0)


def settle_bar_game(game_id, name, std, session):
    """整杯入账：同一个局号只记一次（回执永久保留，重试/重开都不会重复加）。"""
    with _gamestore.file_lock(_path()):
        d = load()
        receipts = dict(d.get("bar_game_receipts") or {})
        if game_id in receipts:
            r = receipts[game_id]
            if r["name"] != name or r["session"] != session:
                raise ValueError("局号已用于其他结算")
            return dict(r)
        before = float(d.get("alcohol") or 0)
        after = round(min(float(dim_cfg().get("max") or 10), before + float(std)), 3)
        r = {"id": game_id, "name": name, "std": std, "before": before, "after": after,
             "increase": round(after - before, 3), "session": session, "at": _now().isoformat(timespec="seconds")}
        receipts[game_id] = r
        # bar_drink 的回执是随机号，不会有人拿旧号重放：留 30 天就够，免得存档越喝越大。游戏局号的回执永久保留（防重放）。
        cutoff = (_now().timestamp() - 30 * 86400)
        receipts = {k: v for k, v in receipts.items() if v.get("session") != "bar-drink" or datetime.fromisoformat(v["at"]).timestamp() >= cutoff}
        d["bar_game_receipts"], d["alcohol"] = receipts, after
        save(d)
        return dict(r)


def summary():
    """网页小纸条要的那几个数。"""
    v = float(load().get("alcohol") or 0)
    return {"alcohol": v, "alcohol_max": dim_cfg().get("max", 10), "tier": tier(v), "blackout_at": blackout_threshold()}


def inject_line():
    """给小机看的一句现状：清醒就是空串。"""
    v = float(load().get("alcohol") or 0)
    t = tier(v)
    if t == "清醒":
        return ""
    return f"你现在体内约 {v:.1f} 个标准杯（{t}）：{conduct(t)}"
