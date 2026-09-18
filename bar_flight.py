"""盲品（Blind Flight）共享引擎：六个暗杯、严格轮流、Ta 抽到酒整杯入账、玩家抽到酒翻整蛊题。

HTTP（前端）和 bar_game 工具（API / MCP）都只调这里（D17）。未揭晓的杯子内容只存在账本里，
对外一律走 view()，它只给已揭晓的杯。设计见 docs/design-notes/吧台盲品-设计-2026-09-17.md。
"""
import json
import re
import secrets
import uuid
import _gamestore
import _lib
import bar_games
import state

# 配方表：改杯数只改这里。tiers = 这一档的杯子各绑哪一档整蛊题。
RECIPE = [{'kind': 'water', 'count': 3, 'tiers': []},
          {'kind': 'mild', 'count': 2, 'tiers': ['轻', '中']},
          {'kind': 'strong', 'count': 1, 'tiers': ['重']}]
MILD_RANGE = (0.5, 1.2)
TIER_ORDER = ['轻', '中', '重']
def _who(key):
    """写给 Ta 看的称呼：玩家用名字（bar_games.player_name），Ta 自己是「你」。不用他/她。"""
    return bar_games.player_name() if key == 'me' else '你'


SIDES = ('me', 'ta')


def _path():
    return _lib.vault_path() / 'cache' / 'bar_flight.json'


def _menu():
    import menu
    return menu._bar_menu()


def _bank_text():
    f = _lib.vault_path() / 'prompts' / 'activities' / 'bar-questions.md'
    text = f.read_text(encoding='utf-8') if f.exists() else ''
    return text if text.strip() else bar_games.DEFAULT_QUESTIONS


def parse_bank(raw, name):
    """和 web/bar-bank.js 同一套格式：`# 盲品·题库` 开一段，`## 轻/中/重` 是档位，`## 亲密` 挂在开关后面。
    真心话是玩家问 Ta 的题、盲品是玩家自己做的任务，方向相反，所以按 `#` 段名取，只读含 name 的那段。"""
    out, inside, tag = {}, False, ''
    for line in str(raw or '').splitlines():
        m = re.match(r'^#\s+(.+?)\s*$', line)
        if m:
            inside, tag = name in m[1], ''
            continue
        m = re.match(r'^##\s+(.+?)\s*$', line)
        if m:
            tag = m[1]
            continue
        m = re.match(r'^\s*(?:[-*]|\d+[.、])\s+(.+?)\s*$', line)
        if inside and m and tag:
            out.setdefault(tag, []).append(m[1])
    return out


def _tiers(bank, intimate):
    """按关键字归档：轻/中/重；亲密池开关打开时并进「中」和「重」（只并进重的话概率太小）。"""
    tiers = {t: [] for t in TIER_ORDER}
    for name, items in bank.items():
        if '亲密' in name:
            if intimate:
                tiers['中'] += items
                tiers['重'] += items
            continue
        t = next((t for t in TIER_ORDER if t in name), None)
        if t:
            tiers[t] += items
    return tiers


def _pranks(intimate=False):
    """她的题库里一档都没有时用出厂题，不让整局只剩一句兜底。"""
    mine = _tiers(parse_bank(_bank_text(), '盲品'), intimate)
    return mine if any(mine.values()) else _tiers(parse_bank(bar_games.DEFAULT_QUESTIONS, '盲品'), intimate)


def _prank(bank, tier, used=()):
    """按档抽题；同一场不重复（亲密池同时在中、重两档里）。这一档没得抽就往相邻档借，整库空了用一句兜底。"""
    start = TIER_ORDER.index(tier)
    order = sorted(TIER_ORDER, key=lambda x: abs(TIER_ORDER.index(x) - start))
    for avoid in (used, ()):      # 先找没用过的；题库太小才允许重复
        for t in order:
            pool = [q for k, v in bank.items() if t in k for q in v if q not in avoid]
            if pool:
                return pool[secrets.randbelow(len(pool))]
    return '说一句你一直没好意思对 Ta 说的话。'


def _pour(menu, bank):
    drinks = [d for d in menu if float(d.get('std') or 0) > 0]
    if not drinks:
        raise ValueError('酒单里还没有带醉意的酒，盲品开不了')
    strong = max(drinks, key=lambda d: (float(d['std']), d['name']))
    mild = [d for d in drinks if d is not strong and MILD_RANGE[0] <= float(d['std']) <= MILD_RANGE[1]] \
        or [d for d in drinks if d is not strong] or [strong]
    water = next((d for d in menu if d.get('name') == '白水'), None) \
        or next((d for d in menu if not float(d.get('std') or 0)), None) or {'name': '白水', 'std': 0}
    cups, used = [], []
    for row in RECIPE:
        pool = list(mild)
        for i in range(row['count']):
            if row['kind'] == 'water':
                d = water
            elif row['kind'] == 'strong':
                d = strong
            else:
                pool = pool or list(mild)
                d = pool.pop(secrets.randbelow(len(pool)))
            tier = row['tiers'][i % len(row['tiers'])] if row['tiers'] else ''
            prank = _prank(bank, tier, used) if tier else ''
            used.append(prank)
            cups.append({'name': d['name'], 'std': float(d.get('std') or 0), 'kind': row['kind'],
                         'tier': tier, 'prank': prank})
    for i in range(len(cups) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        cups[i], cups[j] = cups[j], cups[i]
    return cups


def _load(path):
    # 账本损坏就是错误，不当成空账本重开。
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def _public(flight):
    if not flight:
        return None
    picked = {p['cup']: p for p in flight['picks']}
    cups = []
    for n, cup in enumerate(flight['cups'], 1):
        p = picked.get(n)
        row = {'n': n, 'revealed': bool(p)}
        if p:
            row.update(who=p['who'], name=cup['name'], std=cup['std'], kind=cup['kind'])
            if p['who'] == 'me' and cup['prank']:
                row.update(tier=cup['tier'], prank=cup['prank'])
        cups.append(row)
    out = {'id': flight['id'], 'turn': None if flight['done'] else flight['turn'], 'done': flight['done'],
           'left': [c['n'] for c in cups if not c['revealed']], 'cups': cups, 'started': flight['started']}
    # 她揭了但还没随消息交给 Ta 的那一杯：前端据此把小卡放回待发送区（关弹窗、刷新都甩不掉）。
    # 只看她最近揭的那一杯；更早的杯子已经过去了，不回头翻旧账。
    owed = next((p for p in reversed(flight['picks']) if p['who'] == 'me'), None)
    if owed and not owed.get('sent'):
        c = flight['cups'][owed['cup'] - 1]
        out['owed'] = {'cup': owed['cup'], 'name': c['name'], 'std': c['std'], 'tier': c['tier'], 'prank': c['prank']}
    return out


def view():
    path = _path()
    with _gamestore.file_lock(path):
        book = _load(path)
        if book.get('active'):
            return _public(book['active'])
        # 六杯揭完了，但她最后那一杯还没随消息交出去：继续挂着，直到发出（不然 Ta 后手揭完最后一杯，这张就丢了）。
        last = _public(book.get('last'))
        return last if last and last.get('owed') and not book['last'].get('abandoned') else None


def start(intimate=False):
    """开一场。已有进行中的就原样返回（重复点确定不会重新洗牌）。intimate=亲密池开关（前端每台设备自己记）。"""
    path = _path()
    with _gamestore.file_lock(path):
        book = _load(path)
        if not book.get('active'):
            book['active'] = {'id': str(uuid.uuid4()), 'cups': _pour(_menu(), _pranks(bool(intimate))),
                              'picks': [], 'turn': 'me', 'done': False, 'started': _lib.now_iso()}
            _gamestore.atomic_write_json(path, book)
        return _public(book['active'])


def pick(who, cup, flight_id=None):
    """揭一杯。同一个人重复揭同一杯 = 重试，回同一个结果，醉意只记一次。"""
    if who not in SIDES:
        raise ValueError('谁在选杯不明')
    path = _path()
    with _gamestore.file_lock(path):
        book = _load(path)
        flight = book.get('active')
        if not flight or (flight_id and flight['id'] != flight_id):
            last = book.get('last')
            if last and (not flight_id or last['id'] == flight_id):
                flight = last      # 最后一杯的重试落在这里
            else:
                raise ValueError('现在没有进行中的盲品')
        if type(cup) is not int or not 1 <= cup <= len(flight['cups']):
            raise ValueError(f"杯号要在 1–{len(flight['cups'])} 之间")
        old = next((p for p in flight['picks'] if p['cup'] == cup), None)
        if old and old['who'] != who:
            raise ValueError(f'{cup} 号杯已经被{_who(old["who"])}揭开了')
        if not old:
            if flight['done']:
                raise ValueError('这场盲品已经喝完了')
            if flight['turn'] != who:
                raise ValueError(f'现在轮到{_who(flight["turn"])}选杯')
            flight['picks'].append({'cup': cup, 'who': who, 'at': _lib.now_iso()})
            flight['done'] = len(flight['picks']) == len(flight['cups'])
            flight['turn'] = 'ta' if who == 'me' else 'me'
            if flight['done']:
                book['last'], book['active'] = flight, None
            # 先把这一揭落盘，再记醉意：中途崩了重试也换不了杯。
            _gamestore.atomic_write_json(path, book)
        content = flight['cups'][cup - 1]
        receipt = None
        if who == 'ta' and content['std'] > 0:
            receipt = state.settle_bar_game(str(uuid.uuid5(uuid.UUID(flight['id']), f'cup-{cup}')),
                                            content['name'], content['std'], 'bar-flight')
        return {'flight': _public(flight), 'cup': cup, 'who': who, 'name': content['name'], 'std': content['std'],
                'kind': content['kind'], 'tier': content['tier'] if who == 'me' else '',
                'prank': content['prank'] if who == 'me' else '', 'receipt': receipt}


def mark_sent(flight_id, cup):
    """这一杯已经随她的消息交到 Ta 手上了。"""
    path = _path()
    with _gamestore.file_lock(path):
        book = _load(path)
        for flight in (book.get('active'), book.get('last')):
            if flight and flight['id'] == flight_id:
                for p in flight['picks']:
                    if p['cup'] == cup and p['who'] == 'me':
                        p['sent'] = True
                _gamestore.atomic_write_json(path, book)


def ta_booked(cup):
    """这一轮 Ta 用工具揭的这杯是否已整杯记账。"""
    path = _path()
    with _gamestore.file_lock(path):
        book = _load(path)
    # 订阅载体的 proxy 可能把 cup 过滤掉：那就看 Ta 最近揭的那一杯。
    mine = [(p['at'], flight['cups'][p['cup'] - 1]['std']) for flight in (book.get('active'), book.get('last')) if flight
            for p in flight['picks'] if p['who'] == 'ta' and (type(cup) is not int or p['cup'] == cup)]
    return bool(mine) and max(mine)[1] > 0


def abandon():
    """散场：没揭的杯子作废，不记任何东西。"""
    path = _path()
    with _gamestore.file_lock(path):
        book = _load(path)
        if book.get('active'):
            book['active']['done'] = True
            book['active']['abandoned'] = True
            book['last'], book['active'] = book['active'], None
            _gamestore.atomic_write_json(path, book)


def _status(flight):
    if flight['done']:
        return '六杯都揭完了，这场盲品结束。'
    return f"还没揭的杯：{'、'.join(str(n) for n in flight['left'])} 号。现在轮到{_who(flight['turn'])}选。"


def describe(result):
    """一次揭杯的完整文字：进工具回执，也进玩家那条消息。每次都把现状报全——
    只靠 MCP 的载体看不见玩家动作，也没有钟。"""
    who, name, std = _who(result['who']), result['name'], result['std']
    if not std:
        line = f"{who}揭开 {result['cup']} 号杯：{name}，没事。"
    elif result['who'] == 'ta':
        r = result['receipt']
        line = (f"你揭开 {result['cup']} 号杯：{name}，{std:g} 标准杯，已喝下。本杯醉意增加 {r['increase']:g}，"
                f"现在 {r['after']:g}。已经记进你的醉意了，不用再用 bar_drink 重复喝。")
    else:
        line = (f"{who}揭开 {result['cup']} 号杯：{name}（{std:g} 标准杯）。这杯不用喝，换成{result['tier']}档整蛊题，"
                f"要当场在聊天里做：「{result['prank']}」")
    return '盲品 · ' + line + '\n' + _status(result['flight'])


START, END = '【盲品】', '【盲品结束】'


def message_block(result):
    """玩家带回的这一杯写进她那条消息的样子。web/bar-flight.js 的 decode 按这个格式还原成小卡。"""
    head = f"{result['cup']} 号杯 · {result['name']}" + (f" · {result['std']:g} 标准杯" if result['std'] else '')
    if result['std']:
        body = f"{_who('me')} 揭的，这杯不用喝，换成{result['tier']}档整蛊题，当场在聊天里兑现：\n「{result['prank']}」"
    else:
        body = f"{_who('me')} 揭的，白水，这一杯没事。"
    return '\n'.join([START, head, body, _status(result['flight']), END])


def lens_line():
    """给当前轮的一行现状（不进缓存前缀）。进行中 = 已揭的杯、剩哪几号、轮到谁；
    六杯揭完但玩家最后那张整蛊题还没随消息交出来 = 只提醒这一张。都没有 = 空串。"""
    flight = view()
    if not flight:
        return ''
    me = _who('me')
    if flight['done']:
        owed = flight.get('owed') or {}
        return (f"🥃 盲品刚揭完。{me} 最后揭到的 {owed['cup']} 号杯是{owed['name']}，抽到的整蛊题还没兑现：「{owed['prank']}」"
                if owed.get('prank') else '')
    seen = '；'.join(f"{c['n']} 号 {c['name']}（{_who(c['who'])}" + (f"，抽到的整蛊题：「{c['prank']}」" if c.get('prank') else '') + '）'
                    for c in flight['cups'] if c['revealed'])
    return (f'🥃 盲品进行中：六个暗杯里有白水也有酒，两人轮流各揭一杯；你揭到酒就整杯喝下，{me} 揭到酒换整蛊题。'
            + (f'已揭：{seen}。' if seen else '') + _status(flight)
            + '轮到你时用 bar_game 工具 game="flight" 加 cup 杯号来揭。')
