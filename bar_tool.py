"""Shared Bar tool: server randomness, durable round IDs, existing drink receipts."""
import json
import re
import secrets
import uuid
import _gamestore
import _lib
import bar_flight
import bar_games
import state

SCHEMA = {
    'name': 'bar_game',
    'description': '玩吧台游戏。一次调用完成一局，程序为双方随机掷骰/出拳，或随机抽轮盘；无须让对方额外确认。仅在对方邀请/双方约定玩时调用，不擅自连续开局。round_id 每个新局用新的唯一字符串，重试/回看同局必须复用，不能为改输赢换号。dice 单掷或三掷累计；hands 一局或三局两胜；平局不兑现赌注。drink 必须填真实酒单名称，只有你输时整杯醉意由系统记一次，不要再用 bar_drink 重复喝；其他赌注只返回结果。wheel 的 entries 仅填双方已约定的格子，不掌握当前自定义盘面时先询问，不假称读到了浏览器预设。flight＝盲品：对方在酒单里点了盲品后，六个暗杯两人轮流各揭一杯，轮到你时填 game="flight" 和 cup 杯号（只需这两项）；揭到酒整杯由系统记一次醉意，回执会报这杯是什么、还剩哪几杯、轮到谁。',
    'input_schema': {'type': 'object', 'properties': {
        'round_id': {'type': 'string', 'description': 'dice/hands/wheel 必填：本局唯一编号，例如日期时间加随机后缀；重试复用'},
        'game': {'type': 'string', 'enum': ['dice', 'hands', 'wheel', 'flight']},
        'cup': {'type': 'integer', 'minimum': 1, 'maximum': 6, 'description': 'flight 必填：你要揭开的杯号'},
        'mode': {'type': 'integer', 'enum': [1, 3]},
        'wager': {'type': 'string', 'enum': ['truth', 'dare', 'drink', 'custom']},
        'drink': {'type': 'string', 'description': '真实酒单名称，仅 drink 使用'},
        'text': {'type': 'string', 'description': '自定义赌注或约定题目'},
        'entries': {'type': 'array', 'items': {'type': 'string'}, 'minItems': 3, 'maxItems': 12, 'description': 'wheel 必填：双方已约定的完整盘面'}
    }, 'required': ['game']}
}

_REFUSED = 'Bar 未开局：参数或存档校验失败，请核对玩法、编号和真实酒单；不要宣称已有结果。'

def _path():
    return _lib.vault_path() / 'cache' / 'bar_tool_rounds.json'

def _menu():
    import menu
    return menu._bar_menu()

def _params(inp):
    if not isinstance(inp,dict):raise ValueError('工具参数须为对象')
    key = inp.get('round_id', '')
    if not isinstance(key, str) or not re.fullmatch(r'[\w.-]{8,100}', key):
        raise ValueError('round_id 需为 8–100 位唯一编号，重试复用原编号')
    game, mode, wager = inp.get('game'), inp.get('mode', 1), inp.get('wager', 'truth')
    if game not in ('dice','hands','wheel') or type(mode) is not int or mode not in (1,3) or wager not in ('truth','dare','drink','custom'):
        raise ValueError('玩法/局数/赌注无效')
    drink, text, entries = inp.get('drink',''), inp.get('text',''), inp.get('entries',[])
    if not isinstance(drink,str) or len(drink)>80 or not isinstance(text,str) or len(text)>300:
        raise ValueError('赌注文字无效')
    if game=='wheel' and (not isinstance(entries,list) or not 3<=len(entries)<=12 or any(not isinstance(x,str) or not x.strip() or len(x)>80 for x in entries)):
        raise ValueError('请提供双方约定的 3–12 格盘面；无法读取浏览器内的自定义预设')
    if wager=='custom' and not text.strip():
        raise ValueError('请先写清自定义赌注')
    return key, {'game':game,'mode':mode,'wager':wager,'drink':drink,'text':text,'entries':entries if game=='wheel' else []}

def _draw(p, game_id):
    if p['game']=='wheel':
        i=secrets.randbelow(len(p['entries']))
        return {'id':game_id,'kind':'wheel','result':p['entries'][i],'index':i}
    drink = None
    if p['wager']=='drink':
        drink=next((x for x in _menu() if x['name']==p['drink']),None)
        if not drink:raise ValueError('酒单中没有这杯，请用真实名称')
    me=ta=0; rounds=[]
    for _ in range(1000):
        a,b=(secrets.randbelow(6)+1,secrets.randbelow(6)+1) if p['game']=='dice' else (secrets.randbelow(3),secrets.randbelow(3))
        rounds.append({'me':a,'ta':b})
        if p['game']=='dice':me+=a;ta+=b
        elif a!=b:
            if (a-b)%3==1:me+=1
            else:ta+=1
        if p['game']=='dice' and len(rounds)==p['mode']:break
        if p['game']=='hands' and (p['mode']==1 or max(me,ta)==2):break
    else:raise RuntimeError('随机平局次数异常，请保留本局编号重试')
    return {'id':game_id,'kind':p['game'],'mode':p['mode'],'me':me,'ta':ta,'rounds':rounds,
            'winner':'me' if me>ta else 'ta' if ta>me else 'tie',
            'wager':{'type':p['wager'],'drink':drink,'custom':p['text']}}

def play(inp):
    if isinstance(inp,dict) and inp.get('game')=='flight':
        cup=inp.get('cup')
        if isinstance(cup,str) and cup.strip().isdigit():cup=int(cup.strip())   # 有的载体把数字传成字符串
        return 'Bar · '+bar_flight.describe(bar_flight.pick('ta',cup))
    key,p=_params(inp)
    game_id=str(uuid.uuid5(uuid.NAMESPACE_URL,'bar-tool:'+key))
    path=_path()
    with _gamestore.file_lock(path):
        # A corrupt file is an error, never an empty ledger.
        rows=json.loads(path.read_text()) if path.exists() else {}
        row=rows.get(game_id)
        if row and row['params']!=p:raise ValueError('本局编号已用过，不能改赌注或玩法')
        if not row:
            row={'params':p,'payload':_draw(p,game_id),'at':_lib.now_iso()}
            rows[game_id]=row
            _gamestore.atomic_write_json(path,rows)
        payload=row['payload']
        # Save randomness before settlement; crash/retry can never reroll a loss.
        receipt=bar_games.settle(payload, [payload['wager']['drink']] if payload.get('wager',{}).get('drink') else [], 'bar-tool')
        row['receipt']=receipt
        _gamestore.atomic_write_json(path,rows)
    if payload['kind']=='wheel':
        result='轮盘结果：'+payload['result']+'。文字结果不自动执行惩罚或记醉意。'
    else:
        me=bar_games.player_name()
        winner={'me':me+' 赢了','ta':'你赢了','tie':'平局，不兑现赌注'}[payload['winner']]
        result=f"{winner} · {me} {payload['me']} / 你 {payload['ta']}（{'点数' if p['game']=='dice' else '胜局'}）"
        result+='\n赌注：'+({'truth':'真心话','dare':'大冒险','drink':p['drink'],'custom':p['text']}[p['wager']])
        result+='\n双方由程序随机'+('掷骰' if p['game']=='dice' else '出拳')+'：'+json.dumps(payload['rounds'],ensure_ascii=False)
        if receipt:result+='\n'+bar_games.receipt_context(receipt)
    return 'Bar · '+result+'\n局号：'+game_id

def run(inp):
    try:return play(inp or {})
    except ValueError as e:
        if isinstance(inp,dict) and inp.get('game')=='flight':
            flight=bar_flight.view()
            return 'Bar · 盲品这一杯没有揭开：'+str(e)+'。'+(bar_flight._status(flight) if flight else '')
        return _REFUSED
    except (TypeError,KeyError):_REFUSED

def settled_in_tools(used):
    if not any((item.get('name') or '').split('__')[-1]=='bar_game' for item in used):return False
    receipts=state.load().get('bar_game_receipts') or {}
    for item in used:
        if (item.get('name') or '').split('__')[-1]!='bar_game':continue
        if (item.get('input') or {}).get('game')=='flight':
            if bar_flight.ta_booked((item.get('input') or {}).get('cup')):return True
            continue
        key=(item.get('input') or {}).get('round_id')
        if not isinstance(key,str):continue
        receipt=receipts.get(str(uuid.uuid5(uuid.NAMESPACE_URL,'bar-tool:'+key)))
        if receipt and receipt.get('session')=='bar-tool':return True
    return False
