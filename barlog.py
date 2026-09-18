# -*- coding: utf-8 -*-
"""今晚的记录：网页上玩出的结果、小机用工具做的事，都记一行。网页拿来显示，小机用「看吧台」读。"""
import json

import _gamestore
import _lib

KEEP = 200


def _path():
    return _lib.vault_path() / "bar_log.json"


def _read():
    p = _path()
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def to_player(text):
    """记录是写给小机看的（小机是「你」、玩家用名字）。给玩家自己看时把视角换过来：名字→你，你→Ta。
    「……」里引的题目和赌注是原话，不动；纯机器用的行（随机明细、局号）不显示。"""
    import re
    import bar_games
    me = bar_games.player_name()
    lines = [l for l in str(text).split("\n") if not l.startswith(("双方由程序随机", "局号："))]
    out = []
    for part in re.split(r"(「[^」]*」)", "\n".join(lines)):
        if part.startswith("「"):
            out.append(part)
        else:
            part = part.replace("你", "\0").replace(me, "你").replace("\0", "Ta")
            part = re.sub(r"(?<=[\u4e00-\u9fff]) 你", "你", re.sub(r"你 (?=[\u4e00-\u9fff])", "你", part))
            out.append(part.replace("喝不喝由Ta：喝就用 bar_drink。", "喝不喝由 Ta。").replace("用 bar_look 带上 need_menu 看酒单。", "").replace("商量好再用 bar_game 开局。", "商量好再开局。")
                       .replace("已经记进Ta的醉意了，不用再用 bar_drink 重复喝。", "已经记进 Ta 的醉意。"))
    text = re.sub(r"Ta(?=[\u4e00-\u9fff])", "Ta ", "".join(out))
    return re.sub(r"(?<=[\u4e00-\u9fff])Ta", " Ta", text).strip()


def add(who, text, kind="note", key=None):
    """who: me（你）/ ta（小机）/ bar（吧台）。text 是写给小机看的完整一句（玩家用名字、小机是「你」）。"""
    with _gamestore.file_lock(_path()):
        rows = _read()
        if key:   # 同一局重复提交（刷新、重试）只记一行
            old = next((r for r in rows if r.get("key") == key), None)
            if old:
                return old
        row = {"key": key, "n": (rows[-1]["n"] + 1 if rows else 1), "at": _lib.now_iso(), "who": who, "kind": kind, "text": str(text), "seen": who == "ta"}
        rows.append(row)
        _gamestore.atomic_write_json(_path(), rows[-KEEP:])
        return row


def recent(limit=30):
    with _gamestore.file_lock(_path()):
        rows = _read()[-limit:]
    return [dict(r, show=to_player(r["text"])) for r in rows]


def close_night():
    """结束营业：把今晚的记录整份挪进 bar_log_history/，首页清空。小机还没看过的那几条先留着——看过才算交到。"""
    with _gamestore.file_lock(_path()):
        rows = _read()
        if not rows:
            return 0
        keep = [r for r in rows if not r.get("seen")]
        done = [r for r in rows if r.get("seen")]
        if done:
            h = _path().parent / "bar_log_history"
            h.mkdir(parents=True, exist_ok=True)
            _gamestore.atomic_write_json(h / (_lib.now().strftime("%Y%m%d-%H%M%S") + ".json"), done)
        _gamestore.atomic_write_json(_path(), keep)
        return len(done)


def unseen_for_ta(mark=True):
    """小机还没看过的、不是它自己做的那些事。看过就标记。"""
    with _gamestore.file_lock(_path()):
        rows = _read()
        fresh = [r for r in rows if not r.get("seen")]
        if mark and fresh:
            for r in rows:
                r["seen"] = True
            _gamestore.atomic_write_json(_path(), rows)
        return fresh
