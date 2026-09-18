# -*- coding: utf-8 -*-
"""存档的并发保护：网页和小机的工具可能同时写同一个文件。
- 跨进程锁：读→改→写整段串行（锁一个单独的 .lock 文件，不锁存档本身——存档被原子替换会换 inode，锁就丢了）；
- 原子写：写临时文件再 os.replace，读的人永远看到完整的旧档或完整的新档，不会读到写了一半的。"""
import contextlib
import json
import os
import tempfile
from pathlib import Path

try:
    import fcntl
except ImportError:          # Windows
    fcntl = None
    import msvcrt


@contextlib.contextmanager
def file_lock(target):
    lock_path = str(target) + ".lock"
    Path(lock_path).parent.mkdir(parents=True, exist_ok=True)
    f = open(lock_path, "a+")
    try:
        if fcntl:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        else:
            f.seek(0)
            msvcrt.locking(f.fileno(), msvcrt.LK_LOCK, 1)
        yield
    finally:
        try:
            if fcntl:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            else:
                f.seek(0)
                msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
        finally:
            f.close()


def atomic_write_json(path, obj, indent=None):
    path = str(path)
    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=indent)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
