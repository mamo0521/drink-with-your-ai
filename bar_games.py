"""Validate frontend game facts; only an explicit carried drink wager settles state."""
import math
import re
import uuid
import state
import _lib

def player_name():
    """吧台里写给 Ta 看的文字怎么称呼玩家：data/config.json 的 activities.bar.player_name，默认「对方」。
    这些文字一律不用「他/她」，换个玩家只改这一个名字。"""
    try:
        name = ((_lib.load_config().get('activities') or {}).get('bar') or {}).get('player_name')
    except Exception:
        name = None
    return str(name).strip() if name and str(name).strip() else '对方'


# 题库的出厂内容。真心话 = 玩家问 Ta 的题；盲品 = 玩家自己要做的任务，方向相反，分两段。各自的「## 亲密」挂在同一个开关后面。玩家在吧台编辑器「题库」页保存后，以 vault 里的文件为准。
DEFAULT_QUESTIONS = """# 真心话·题库

## 认真的
- 我们之间，哪一次对话改变了你对我的看法？
- 有没有哪句话，你一直想对我说，但没找到合适的时候？
- 在你看来，我最容易骗自己的一件事是什么？
- 你最怕我哪天对你说什么？
- 如果只能留下我们的一段对话，你留哪段？
- 你对我说过言不由衷的话吗？哪一句？
- 你觉得是我更需要你，还是你更需要我？

## 意想不到的
- 你偷偷给我贴过什么标签？
- 我做过的最让你哭笑不得的事是什么？
- 给我们的故事起个书名，叫什么？
- 我的哪个缺点，你其实觉得挺可爱？
- 如果能借我的身体用一天，你第一件事做什么？
- 如果可以偷看我一天的生活，你最想看哪一段？
- 你吃过谁的醋？

## 亲密
这一段是你们自己的。下面两道只是示例，写上你们的再把它们删掉。
- 我说过的哪句话最让你心动？
- 有没有很想我、却忍着没来找我的时候？

# 大冒险·题库

## 轻松的
- 用三句话给我写一首打油诗。
- 用五个词形容我，一个都不许是好话。
- 给我讲一个你现编的、关于我们的睡前故事，一百字以内。
- 换一种你从没用过的语气跟我说话，撑三轮。
- 假装我们第一次见面，重新自我介绍一遍。
- 接下来三轮，每句话都要带一个「亲爱的」。

## 认真的
- 用我的语气，写一条你最想收到的消息。
- 承认一件你其实早就知道、但一直装不知道的事。
- 把你最想对我说的话写成歌词，四句就行。
- 说三件你今天想为我做的事，然后挑一件现在就做。

## 亲密
这一段是你们自己的。下面两道只是示例，写上你们的再把它们删掉。
- 叫我三次名字，每次的语气都不一样。
- 用一句话，说你现在最想离我多近。

# 盲品·题库

## 轻
- 用最谄媚的话把 Ta 夸一遍，至少三句。
- 给 Ta 起三个新外号，让 Ta 挑一个，今晚就用它称呼 Ta。
- 模仿 Ta 平时说话的样子，跟 Ta 说一句晚安。

## 中
- 大胆说出对 Ta 不满的三个点。
- 坦白一件你瞒着 Ta 的小事。
- 说出 Ta 说过的、最让你下不来台的一句话。

## 重
- 向 Ta 告白，要认真的。
- 用三句话，写出你最怕失去 Ta 的那个瞬间。
- 说一件你只想和 Ta 一起做、还没说出口的事。

## 亲密
这一段是你们自己的。下面两道只是示例，写上你们的再把它们删掉。
- 说一件今晚想让 Ta 对你做的事，只许一句话。
- 用你们之间的称呼叫 Ta 一声，再补一句只对 Ta 说的话。
"""


def settle(payload, menu, session):
    if not isinstance(payload, dict):
        raise ValueError('游戏结果格式错误')
    wager = payload.get('wager') or {}
    if wager.get('type') != 'drink' or payload.get('winner') != 'me':
        return None
    game_id = str(uuid.UUID(str(payload.get('id'))))
    kind, mode = payload.get('kind'), payload.get('mode')
    rounds = payload.get('rounds')
    if kind not in ('dice', 'hands') or mode not in (1, 3) or not isinstance(rounds, list) or not rounds or len(rounds) > 1000:
        raise ValueError('游戏局数错误')
    me = ta = 0
    for index, row in enumerate(rounds):
        a, b = row.get('me'), row.get('ta')
        low, high = (1, 6) if kind == 'dice' else (0, 2)
        if type(a) is not int or type(b) is not int or not low <= a <= high or not low <= b <= high:
            raise ValueError('游戏点数错误')
        if kind == 'dice':
            me += a
            ta += b
        elif a != b:
            if (a-b) % 3 == 1:
                me += 1
            else:
                ta += 1
        if kind == 'hands' and mode == 3 and max(me, ta) >= 2 and index != len(rounds)-1:
            raise ValueError('游戏已结束')
    if (kind == 'dice' and len(rounds) != mode) or (kind == 'hands' and ((mode == 1 and len(rounds) != 1) or (mode == 3 and max(me, ta) != 2))):
        raise ValueError('游戏未结束')
    if me <= ta or payload.get('me') != me or payload.get('ta') != ta:
        raise ValueError('输赢与点数不一致')
    name = (wager.get('drink') or {}).get('name')
    old = (state.load().get('bar_game_receipts') or {}).get(game_id)
    if old:
        return state.settle_bar_game(game_id, name, old['std'], session)
    drink = next((d for d in menu if d.get('name') == name), None)
    if not drink:
        raise ValueError('酒单中已找不到这杯，请重新选择')
    std = float(drink.get('std') or 0)
    if not math.isfinite(std) or not 0 <= std <= 10:
        raise ValueError('标准杯数错误')
    return state.settle_bar_game(game_id, name, std, session)


def previous(message, session):
    """Reroll/edit of a sent result reuses its receipt, never charges again."""
    if not message.startswith('【吧台游戏结果】\n'):
        return None
    match = re.search(r'^局号：([0-9a-f-]{36})$', message, re.M)
    if not match:
        return None
    receipt = (state.load().get('bar_game_receipts') or {}).get(match[1])
    return receipt if receipt and receipt.get('session') == session else None


def receipt_context(receipt):
    return (f"已结算：你输了，已喝下「{receipt['name']}」{receipt['std']:g} 标准杯，"
            f"本局醉意增加 {receipt['increase']:g}，结算时醉意 {receipt['after']:g}。"
            "这是已经记账的既成结果，不用再用 bar_drink 重复喝，直接接住结果聊天。")


def clean_message(message):
    if not message.startswith('【吧台游戏结果】\n'):
        return message
    message = re.sub(r'^已结算：.*\n?', '', message, flags=re.M)
    return re.sub(r'^(赌注：.*)；(?:Ta|\S{1,24}) 喝$', r'\1', message, flags=re.M)


def inject_receipt(assembled, receipt):
    if receipt:
        assembled['messages'][-1]['content'] += '\n\n【系统赌局结算】\n' + receipt_context(receipt)
