"""吧台酒图：玩家在 edit 里给一杯酒传的图。家里网关和独立包共用这一份（只用标准库）。
图跟着酒名走：一杯酒一张，文件名 = 酒名.png。只收 180×220 的 PNG。"""
import re
import struct
from pathlib import Path

WIDTH, HEIGHT = 180, 220
MAX_BYTES = 200_000      # 出厂酒图 20–35 KB，留足余量；网上版门口的请求上限是 256 KB
MAX_IMAGES = 40
_PNG = b"\x89PNG\r\n\x1a\n"


def safe_name(name):
    """酒名 → 文件名主干。和前端取图同一条替换规则；空名 / 纯点号回空串。"""
    s = re.sub(r'[:/\\?*"<>|\x00-\x1f]', "-", str(name or "")).strip()[:60]
    return "" if not s.strip(". ") else s


def check_png(data):
    """不合格就抛 ValueError，话是给玩家看的。"""
    if not isinstance(data, (bytes, bytearray)) or len(data) < 33 or data[:8] != _PNG or data[12:16] != b"IHDR":
        raise ValueError("要 PNG 图片")
    if len(data) > MAX_BYTES:
        raise ValueError(f"图片太大了（{len(data) // 1000} KB），请压到 {MAX_BYTES // 1000} KB 以内")
    w, h = struct.unpack(">II", data[16:24])
    if (w, h) != (WIDTH, HEIGHT):
        raise ValueError(f"图片要 {WIDTH}×{HEIGHT}，这张是 {w}×{h}")


def path(folder, name):
    stem = safe_name(name)
    if not stem:
        return None
    f = (Path(folder) / (stem + ".png")).resolve()
    return f if f.parent == Path(folder).resolve() else None


def versions(folder):
    """{酒名: 版本号}。版本号 = 修改时间，换图后地址跟着变，浏览器不会拿旧图。"""
    d = Path(folder)
    if not d.is_dir():
        return {}
    return {f.stem: int(f.stat().st_mtime * 1000) for f in d.glob("*.png") if f.is_file()}


def save(folder, name, data):
    check_png(data)
    f = path(folder, name)
    if f is None:
        raise ValueError("先填酒名")
    if not f.exists() and len(versions(folder)) >= MAX_IMAGES:
        raise ValueError(f"最多放 {MAX_IMAGES} 张酒图，先删掉几张不用的")
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_name(f.name + ".tmp")
    tmp.write_bytes(bytes(data))
    tmp.replace(f)
    return int(f.stat().st_mtime * 1000)


def remove(folder, name):
    f = path(folder, name)
    if f is not None and f.is_file():
        f.unlink()
        return True
    return False


def rename(folder, old, new):
    """酒改名了，图跟过去。新名字已经有图、或旧名字没图，就什么都不做，回 0；成了回新图的版本号。"""
    src, dst = path(folder, old), path(folder, new)
    if src is None or dst is None or src == dst or not src.is_file() or dst.exists():
        return 0
    src.replace(dst)
    return int(dst.stat().st_mtime * 1000)


def attach(items, folder):
    """给酒单条目带上 img 版本号（有自己的图才带），前端凭它决定取哪张。"""
    have = versions(folder)
    if not have:
        return items
    return [dict(i, img=have[safe_name(i.get("name"))]) if safe_name(i.get("name")) in have else i for i in items]
