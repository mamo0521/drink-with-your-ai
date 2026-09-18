# -*- coding: utf-8 -*-
"""给小机的三个工具，功能只写这一份：MCP 服务器和 POST /bar/ai 都调这里。
bar_game = 玩游戏；bar_drink = 喝一杯；bar_look = 看吧台（坐下先看一眼）。"""
import math
import re
import uuid

import _lib
import bar_flight
import bar_games
import bar_tool
import barlog
import menu
import state

TOOLS = [
    bar_tool.SCHEMA,
    {"name": "bar_drink",
     "description": "在吧台喝下一整杯，记进你的醉意。name 填酒单上的真实酒名；自己调的、酒单上没有的，另填 std（标准杯数，啤酒约 0.5、威士忌约 1、长岛约 2.5）。"
                    "你有不喝的权利：决定喝了才调用；推回去、换一杯回敬，在对话里说就行。回执会告诉你现在几杯、到了哪一档、这一档你会怎么说话。茶水不加醉意。",
     "input_schema": {"type": "object", "properties": {
         "name": {"type": "string", "description": "酒名"},
         "std": {"type": "number", "minimum": 0, "maximum": 5, "description": "只有酒单上没有的酒才填"}},
         "required": ["name"]}},
    {"name": "bar_look",
     "description": "看一眼吧台现在什么情况：对方刚在吧台网页上点了什么、玩出了什么结果、盲品揭到哪了、你现在几杯什么档。"
                    "你看不见对方在网页上的动作，所以每次坐进吧台、或者对方说「我点了 / 我掷了 / 我揭了」的时候，先调一次。need_menu=true 时把酒单也带上。",
     "input_schema": {"type": "object", "properties": {"need_menu": {"type": "boolean"}}}},
]


def _now_line():
    s = state.summary()
    t = s["tier"]
    line = f"你现在 {s['alcohol']:.1f} 个标准杯（{t}）。"
    voice = state.conduct(t)
    return line + (f"这一档的你：{voice}" if voice else "")


def drink(inp):
    name = str((inp or {}).get("name") or "").strip()
    if not name or len(name) > 80:
        return "没有喝：请写清楚喝的是哪一杯。"
    item = next((d for d in menu._bar_menu() if d["name"] == name), None)
    std = float(item["std"]) if item else (inp or {}).get("std")
    if std is None:
        return f"没有喝：酒单上没有「{name}」。是自己调的话，把 std（标准杯数）一起填上。"
    try:
        std = float(std)
    except (TypeError, ValueError):
        return "没有喝：std 要是数字。"
    if not math.isfinite(std) or not 0 <= std <= 5:
        return "没有喝：std 要在 0–5 之间。"
    if std == 0:
        barlog.add("ta", f"你喝了一杯{name}（不含酒精）。", "drink")
        return f"你喝了一杯{name}，不加醉意。" + _now_line()
    r = state.settle_bar_game(str(uuid.uuid4()), name, std, "bar-drink")
    barlog.add("ta", f"你喝下一杯{name}，{std:g} 标准杯。", "drink")
    return f"你喝下一杯{name}（{std:g} 标准杯），醉意增加 {r['increase']:g}。" + _now_line()


def look(inp):
    me = bar_games.player_name()
    parts = []
    fresh = barlog.unseen_for_ta()
    if fresh:
        parts.append("你上次看过之后，吧台里发生的事：\n" + "\n".join("· " + r["text"] for r in fresh))
    else:
        parts.append(f"{me} 这边没有新动静。")
    flight = bar_flight.lens_line()
    if flight:
        parts.append(flight)
        view = bar_flight.view()
        if view and view.get("owed"):
            bar_flight.mark_sent(view["id"], view["owed"]["cup"])   # 你已经看到这张题了
    parts.append(_now_line())
    if (inp or {}).get("need_menu"):
        # 整份酒单原文：每一杯的讲究和吧台规矩都在里面，是小机自己的口吻（只靠工具的客户端没有别的地方能看到它）
        parts.append("你的酒单与吧台规矩（「我」是你，「你」是对方）：\n\n" + re.sub(r"(?m)^>.*\n?", "", _lib.parse_frontmatter(menu._bar_text())[1]).strip())   # `>` 行是写给玩家的说明
    return "\n\n".join(parts)


def run(name, inp):
    name = str(name or "").split("__")[-1]
    if name == "bar_game":
        out = bar_tool.run(inp)
        if not out.startswith("Bar 未开局"):
            barlog.add("ta", out.replace("Bar · ", "", 1), "game")
        return out
    if name == "bar_drink":
        return drink(inp)
    if name == "bar_look":
        return look(inp)
    return "吧台里没有这个工具。"


def context():
    """自建前端每轮塞进上下文的那几行：醉意 + 盲品现状 + 还没看过的事（不标记已读）。"""
    lines = [state.inject_line(), bar_flight.lens_line()]
    fresh = barlog.unseen_for_ta(mark=False)
    if fresh:
        lines.append("吧台里刚发生的事：" + "；".join(r["text"] for r in fresh[-5:]))
    return "\n".join(x for x in lines if x)
