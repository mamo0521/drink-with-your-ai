#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""和小机喝一杯 · MCP 服务器（给 Claude 桌面 App 等支持 MCP 的客户端用；标准库实现，无依赖）。

装上之后：
- 小机手里有三个工具：bar_look 看吧台、bar_drink 喝一杯、bar_game 玩游戏（骰子 / 猜拳 / 轮盘 / 盲品揭杯）；
- 同一个进程顺带在 http://127.0.0.1:8766 开出吧台网页（你点酒、上赌桌、玩盲品都在那儿）；
- 两边读写同一份存档，谁喝了什么、谁赢了什么都记在同一本账上。

协议：MCP 2025-06-18，stdio 传输。stdout 只放协议消息，日志一律走 stderr。
"""
import json
import os
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bar_ai  # noqa: E402

PROTOCOL = "2025-06-18"
SUPPORTED = {"2025-06-18", "2025-03-26", "2024-11-05"}
NAME, VERSION = "drink-with-xiaoji", "1.0.0"
WEB_URL = None

TOOLS = [{"name": t["name"], "description": t["description"], "inputSchema": t["input_schema"]} for t in bar_ai.TOOLS]
INSTRUCTIONS = ("这是你和对方共用的一间吧台。对方在吧台网页上点酒、掷骰、猜拳、转轮盘、玩盲品；你看不见网页上的动作，也没有钟——"
                "坐进吧台、或者对方提到刚在吧台做了什么的时候，先用 bar_look 看一眼。"
                "你决定喝就用 bar_drink（你有不喝的权利，推回去或换一杯回敬都在对话里说）；"
                "要玩游戏用 bar_game。工具回执会告诉你现在几杯、到了哪一档、这一档你会怎么说话——照那个状态说话。")


def reply(msg):
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle(req):
    mid, method, params = req.get("id"), req.get("method"), req.get("params") or {}
    if method == "initialize":
        want = params.get("protocolVersion")
        return {"jsonrpc": "2.0", "id": mid, "result": {
            "protocolVersion": want if want in SUPPORTED else PROTOCOL,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": NAME, "title": "和小机喝一杯", "version": VERSION},
            "instructions": INSTRUCTIONS}}
    if method in ("notifications/initialized", "notifications/cancelled"):
        return None
    if method == "ping":
        return {"jsonrpc": "2.0", "id": mid, "result": {}}
    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}}
    if method == "tools/call":
        try:
            text, err = bar_ai.run(params.get("name"), params.get("arguments") or {}), False
            if WEB_URL and params.get("name") == "bar_look":
                text += f"\n\n（对方的吧台网页：{WEB_URL}）"
        except Exception as e:                      # 工具出错作为结果回，别把连接搞断
            text, err = f"吧台出岔子了：{type(e).__name__}: {e}", True
        return {"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": text}], "isError": err}}
    if mid is None:
        return None
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"Method not found: {method}"}}


def serve_web():
    global WEB_URL
    try:
        import server
        httpd, port = server.serve()
        WEB_URL = f"http://{server.HOST}:{port}"
        if httpd is None:
            print(f"[bar] 吧台网页已由另一份开着：{WEB_URL}", file=sys.stderr)
            return
        print(f"[bar] 吧台网页 {WEB_URL}", file=sys.stderr)
        httpd.serve_forever()
    except Exception as e:
        print(f"[bar] 吧台网页没开起来：{e}", file=sys.stderr)


def main():
    threading.Thread(target=serve_web, daemon=True).start()
    print("[bar] 吧台已就位。", file=sys.stderr)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue
        out = handle(req)
        if out is not None:
            reply(out)


if __name__ == "__main__":
    main()
