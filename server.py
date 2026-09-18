#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""和小机喝一杯 · 本地吧台。只用 Python 标准库：python3 server.py [端口]，然后浏览器开 http://127.0.0.1:8766
只监听本机；存档、你写的酒单 / 题库 / 醉态口吻都在用户目录里（见 _lib.py）。"""
import json
import os
import shutil
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import _lib          # noqa: E402
import bar_ai        # noqa: E402
import bar_flight    # noqa: E402
import bar_games     # noqa: E402
import barlog        # noqa: E402
import menu          # noqa: E402
import state         # noqa: E402

WEB = ROOT / "web"
FILES = {"bar": ("prompts", "activities", "bar.md"), "alcohol": ("prompts", "state", "alcohol.md"),
         "questions": ("prompts", "activities", "bar-questions.md")}
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2",
         ".ttf": "font/ttf", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8"}


def factory(which):
    return {"bar": menu._bar_factory_text(), "alcohol": state.factory_doc_text("alcohol"),
            "questions": bar_games.DEFAULT_QUESTIONS}[which]


def _check_rounds(p):
    """不押酒的局也要像样：点数在范围内、总分对得上、赢家没写反。"""
    kind, rounds = p.get("kind"), p.get("rounds")
    if kind not in ("dice", "hands") or not isinstance(rounds, list) or not 0 < len(rounds) <= 1000:
        raise ValueError("游戏局数错误")
    lo, hi = (1, 6) if kind == "dice" else (0, 2)
    me = ta = 0
    for r in rounds:
        a, b = r.get("me"), r.get("ta")
        if type(a) is not int or type(b) is not int or not lo <= a <= hi or not lo <= b <= hi:
            raise ValueError("游戏点数错误")
        if kind == "dice":
            me, ta = me + a, ta + b
        elif a != b:
            me, ta = (me + 1, ta) if (a - b) % 3 == 1 else (me, ta + 1)
    if (me, ta) != (p.get("me"), p.get("ta")) or p.get("winner") != ("me" if me > ta else "ta" if ta > me else "tie") or me == ta:
        raise ValueError("输赢与点数不一致")


def player_result(payload):
    """你在网页上玩出的一局：校验点数 → 小机输了押酒就整杯记账 → 写进今晚的记录。"""
    me = bar_games.player_name()
    if payload.get("kind") == "wheel":
        text = f"{me} 转了轮盘，结果：{str(payload.get('result') or '')[:200]}。"
        return {"text": barlog.add("me", text, "game", key=str(payload.get("id") or "") or None)["text"], "receipt": None}
    _check_rounds(payload)
    receipt = bar_games.settle(payload, menu._bar_menu(), "bar-page")
    w = payload.get("wager") or {}
    kind = "骰子" if payload.get("kind") == "dice" else "猜拳"
    unit = "点" if payload.get("kind") == "dice" else "胜"
    winner = me if payload.get("winner") == "me" else "你"
    stake = {"drink": "押一杯" + str((w.get("drink") or {}).get("name") or ""), "truth": "押真心话", "dare": "押大冒险",
             "custom": "赌注：" + str(w.get("custom") or "")}.get(w.get("type"), "")
    text = f"{me} 和你在网页上玩了一局{kind}（{stake}）：{me} {payload.get('me')} {unit}，你 {payload.get('ta')} {unit}，{winner}赢了。"
    if payload.get("question"):
        text += f"{me} 出的题：「{str(payload['question'])[:500]}」"
    elif payload.get("winner") == "ta" and w.get("type") in ("truth", "dare"):
        text += "轮到你出题。"
    if receipt:
        text += bar_games.receipt_context(receipt)
    elif w.get("type") == "drink" and payload.get("winner") == "ta":
        text += f"这杯该 {me} 喝。"
    return {"text": barlog.add("me", text, "game", key=str(payload.get("id")))["text"], "receipt": receipt}


class Handler(BaseHTTPRequestHandler):
    server_version = "AfterhoursBar/1"

    def log_message(self, *a):
        pass

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass   # 页面关掉 / 刷新时把连接掐了，正常现象，不往日志里刷一屏报错

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        try:
            n = int(self.headers.get("content-length") or 0)
            return json.loads(self.rfile.read(n) or b"{}") if 0 < n <= 200_000 else {}
        except Exception:
            return {}

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        try:
            if u.path == "/activities":
                return self.send_json({"activities": [{"id": "bar", "name": "吧台", "menu": menu._bar_menu(),
                                                       "menu_title": menu._bar_title(), "player_name": bar_games.player_name()}],
                                       "data_dir": str(_lib.vault_path())})
            if u.path == "/state":
                return self.send_json(state.summary())
            if u.path == "/barfile":
                which = (q.get("which") or ["bar"])[0]
                if which not in FILES:
                    return self.send_json({"ok": False, "error": "未知文件"}, 404)
                f = _lib.vault_path().joinpath(*FILES[which])
                text = f.read_text(encoding="utf-8") if f.exists() else ""
                out = {"ok": True, "which": which, "text": text if text.strip() else factory(which), "exists": f.exists()}
                if which == "questions":
                    out["factory"] = factory(which)
                return self.send_json(out)
            if u.path == "/barflight":
                return self.send_json({"ok": True, "flight": bar_flight.view()})
            if u.path == "/bar/log":
                return self.send_json({"ok": True, "log": barlog.recent(), "context": bar_ai.context()})
            if u.path == "/bar/context":
                return self.send_json({"ok": True, "text": bar_ai.context()})
            if u.path == "/bar/tools":
                return self.send_json({"ok": True, "tools": bar_ai.TOOLS})
        except Exception as e:
            return self.send_json({"ok": False, "error": f"{type(e).__name__}: {e}"}, 500)
        return self.static(u.path)

    def do_POST(self):
        u = urlparse(self.path)
        b = self.body()
        try:
            if u.path == "/barfile/save":
                which, text = b.get("which"), b.get("text")
                if which not in FILES or not isinstance(text, str):
                    return self.send_json({"ok": False, "error": "缺 which/text"}, 400)
                f = _lib.vault_path().joinpath(*FILES[which])
                f.parent.mkdir(parents=True, exist_ok=True)
                if f.exists():   # 旧版不删：进 history/
                    h = f.parent / "history"
                    h.mkdir(exist_ok=True)
                    shutil.copy2(f, h / f"{f.stem}-{_lib.now().strftime('%Y%m%d-%H%M%S')}{f.suffix}")
                f.write_text(text, encoding="utf-8")
                return self.send_json({"ok": True, "msgs": ["已保存（旧版进 history/）"]})
            if u.path.startswith("/barflight/"):
                action = u.path.rsplit("/", 1)[1]
                try:
                    if action == "start":
                        flight = bar_flight.start(intimate=bool(b.get("intimate")))
                        barlog.add("me", f"{bar_games.player_name()} 点了一份盲品：六个暗杯，两人轮流各揭一杯，{bar_games.player_name()} 先揭。", "flight")
                        return self.send_json({"ok": True, "flight": flight})
                    if action == "pick":
                        pick = bar_flight.pick("me", b.get("cup"), b.get("id"))
                        barlog.add("me", bar_flight.describe(pick).replace("盲品 · ", "", 1).split("\n")[0], "flight")
                        return self.send_json({"ok": True, "pick": pick})
                    if action == "end":
                        bar_flight.abandon()
                        return self.send_json({"ok": True, "flight": None})
                except ValueError as e:
                    return self.send_json({"ok": False, "error": str(e), "flight": bar_flight.view()}, 409)
                return self.send_json({"ok": False, "error": "未知操作"}, 404)
            if u.path == "/bar/result":
                try:
                    return self.send_json({"ok": True, **player_result(b.get("result") or {})})
                except (ValueError, TypeError, KeyError, AttributeError) as e:
                    return self.send_json({"ok": False, "error": "这一局没有记上：" + str(e)}, 400)
            if u.path == "/bar/serve":   # 你给小机点了一杯：喝不喝由 Ta 决定
                name = str(b.get("name") or "")[:80]
                extra = ""
                if isinstance(b.get("std"), (int, float)) and b.get("desc"):   # 今日特调：酒单上没有，把配方和杯数一起交给小机
                    extra = f"（{str(b['desc'])[:200]} 喝的话 bar_drink 里填 std={float(b['std']):g}）"
                row = barlog.add("me", f"{bar_games.player_name()} 把一杯{name}放到你面前。{extra}喝不喝由你：喝就用 bar_drink。", "serve")
                return self.send_json({"ok": True, "text": row["text"]})
            if u.path == "/bar/note":    # 把酒单递给小机 / 请小机挑游戏
                me = bar_games.player_name()
                text = {"menu": f"{me} 把酒单推到你面前：今晚喝不喝、喝什么，你说了算——酒单上的、自己调的、或者不喝都行。用 bar_look 带上 need_menu 看酒单。",
                        "invite": f"{me} 把吧台游戏交给你选：骰子比大小、猜拳，或者轮盘，你想玩哪个？也可以提这一轮的赌注，商量好再用 bar_game 开局。"}.get(b.get("kind"))
                if not text:
                    return self.send_json({"ok": False, "error": "未知便条"}, 400)
                return self.send_json({"ok": True, "text": barlog.add("me", text, "note")["text"]})
            if u.path == "/bar/close":   # 结束营业：今晚的记录收进历史
                return self.send_json({"ok": True, "archived": barlog.close_night()})
            if u.path == "/bar/ai":      # 没有 MCP 的接法：你的程序替小机转发工具调用
                return self.send_json({"ok": True, "result": bar_ai.run(b.get("tool"), b.get("input") or {})})
        except Exception as e:
            return self.send_json({"ok": False, "error": f"{type(e).__name__}: {e}"}, 500)
        return self.send_json({"ok": False, "error": "没有这个接口"}, 404)

    def send_file(self, f):
        """发静态文件。带 Last-Modified：浏览器下次带 If-Modified-Since 来问，文件没变就回 304，
        不再每刷新一次页面就把 20 MB 的字体和大图重下一遍。"""
        from email.utils import formatdate, parsedate_to_datetime
        mtime = int(f.stat().st_mtime)
        since = self.headers.get("If-Modified-Since")
        if since:
            try:
                if int(parsedate_to_datetime(since).timestamp()) >= mtime:
                    self.send_response(304)
                    self.send_header("cache-control", "no-cache")
                    self.end_headers()
                    return
            except (TypeError, ValueError):
                pass
        data = f.read_bytes()
        self.send_response(200)
        self.send_header("content-type", TYPES.get(f.suffix.lower(), "application/octet-stream"))
        self.send_header("content-length", str(len(data)))
        self.send_header("last-modified", formatdate(mtime, usegmt=True))
        self.send_header("cache-control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def static(self, path):
        path = unquote(path)   # 酒图是中文文件名
        if path.startswith("/assets/bar/") and path.count("/") == 3:   # 玩家自己配的酒图优先：存档文件夹/images/酒名.png
            mine = (_lib.vault_path() / "images" / path.rsplit("/", 1)[1]).resolve()
            if mine.is_file() and (_lib.vault_path() / "images").resolve() in mine.parents:
                return self.send_file(mine)
        rel = "index.html" if path in ("", "/") else path.lstrip("/")
        f = (WEB / rel).resolve()
        if WEB.resolve() not in f.parents and f != WEB.resolve() or not f.is_file():
            self.send_response(404)
            self.end_headers()
            return
        self.send_file(f)


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
            return
        super().handle_error(request, client_address)


HOST, PORT, PORT_TRIES = "127.0.0.1", int(os.environ.get("BAR_PORT") or 8766), 10


def bar_already_at(port):
    """这个端口上是不是已经有我们自己的吧台开着（同一台电脑同一份存档）。"""
    try:
        import urllib.request
        with urllib.request.urlopen(f"http://{HOST}:{port}/bar/tools", timeout=1.5) as r:
            return any(t.get("name") == "bar_look" for t in json.loads(r.read()).get("tools", []))
    except Exception:
        return False


def serve(port=None):
    """占一个能用的端口，返回 (httpd, 端口)；(None, 端口) = 那里已经有一间我们的吧台开着，直接用它。
    端口被别的程序占了就往后挪——装死会让你在别人的页面上玩，小机读的却是自己这本账。"""
    first = PORT if port is None else int(port)
    last = None
    for p in range(first, first + PORT_TRIES):
        try:
            return Server((HOST, p), Handler), p
        except OSError as e:
            last = e
            if bar_already_at(p):
                return None, p
    raise OSError(f"{first}~{first + PORT_TRIES - 1} 全被占了：{last}")


def main():
    httpd, port = serve(sys.argv[1] if len(sys.argv) > 1 else None)
    if httpd is None:
        print(f"吧台已经在 http://{HOST}:{port} 开着了（同一本账），这边不再开第二个门。")
        return
    print(f"吧台开了：http://{HOST}:{port}   （Ctrl+C 打烊）")
    print(f"存档和你写的酒单在：{_lib.vault_path()}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n打烊。")


if __name__ == "__main__":
    main()
