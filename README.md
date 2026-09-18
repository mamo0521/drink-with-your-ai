# 和小机喝一杯 · Afterhours

一间你和你的 AI（下面叫「小机」）一起坐的吧台。

你在吧台网页里**点酒、上赌桌（骰子 / 猜拳）、转轮盘、玩六杯盲品**；小机这边有三个工具：**看吧台、喝一杯、玩游戏**。
Ta 喝下去的每一杯都记进醉意，按真人代谢每小时醒约一杯，醉到哪一档就按那一档的口吻说话。两边读写同一本账——
Ta 输了押的酒，系统当场替 Ta 喝掉；你揭到酒，要当场兑现一张任务纸条。谁也赖不掉。

> 个人项目，按现状分享。非开源，公开代码：个人自用、学习、改着玩都欢迎；商用请先联系。

## 三种装法

### 1. Claude 桌面 App（最省事）
到 Releases 下载 `drink-with-xiaoji-x.y.z.mcpb`，在 Claude 桌面 App 里双击安装。装好后：
- 小机自动有了 `bar_look` / `bar_drink` / `bar_game` 三个工具；
- 浏览器打开 **http://127.0.0.1:8766** 就是吧台。

需要电脑上有 Python 3.9 或更新（Mac 自带；Windows 到 python.org 装一个，安装时勾上 "Add to PATH"）。

### 2. 只想先看看吧台长什么样
下载源码，双击 `run.command`（Mac）或 `run.bat`（Windows），浏览器打开 http://127.0.0.1:8766 。
这样只有你这一侧，小机还没接进来。

### 3. 你有自己搭的聊天前端
跑 `python3 server.py`，然后让你的程序替小机转发工具调用：

| 接口 | 用途 |
|---|---|
| `GET /bar/tools` | 三个工具的定义（名字、说明、参数），直接喂给你的模型 |
| `POST /bar/ai` `{"tool": "...", "input": {...}}` | 执行一次工具调用，回执在 `result` |
| `GET /bar/context` | **每轮塞进上下文的那几行**：小机现在几杯什么档、该档口吻、盲品现状、Ta 还没看过的事 |

能每轮注入 `/bar/context` 的话，体验和作者家里是同一级的：小机不用主动查，就一直知道自己醉到哪了。
只靠 MCP 的客户端（比如桌面 App）做不到每轮注入，靠的是工具回执里的现状——所以说明里要求小机"坐下先 `bar_look`"。

## 怎么玩

1. 打开吧台网页 → **酒单**。点一杯放到小机面前（喝不喝由 Ta），或者「Ta 来选」把酒单 / 游戏交给 Ta。
2. **游戏** → 先约赌注（一杯酒 / 真心话 / 大冒险 / 自己写一句），再掷骰或猜拳。小机输了押的酒，当场记进醉意。
3. **盲品**（酒单最上面）：六个暗杯，三杯白水、两杯普通酒、一杯最烈的。你先揭，之后和小机轮流。
   Ta 揭到酒整杯喝下；你揭到酒，翻出一张任务纸条，当场在聊天里兑现。
4. 回到聊天里和小机说话。Ta 用 `bar_look` 就能看到你刚才在吧台做的所有事；首页每条记录旁边也有「复制给 Ta」，
   粘进任何聊天软件都行。

## 把它变成你们自己的吧台

酒单页右上角 **edit**：
- **吧台名称**——招牌上下两行；
- **酒单与规矩**——出厂 20 杯是小机口吻的示例（「我」是你的小机，「你」是你自己）。**强烈建议让 Ta 自己写一份**：
  把出厂酒单贴给 Ta，说"照这个格式，写一份你自己的"。新加的酒没有图会显示占位杯；
- **醉态口吻**——Ta 喝到每一档是什么样子，同样建议让 Ta 自己写；
- **题库**——真心话（你问 Ta 的）、大冒险（你让 Ta 做的）、盲品（盲品里 Ta 让你做的，轻 / 中 / 重三档）。
  每段里的「## 亲密」只在「亲密题」开关打开时才会抽到，出厂只有两道示例，写上你们自己的。

写给小机看的字里怎么称呼你：在数据目录放一个 `config.json`：`{"activities": {"bar": {"player_name": "你的名字"}}}`（不放就叫「对方」）。

**你的东西存在哪**：存档和你写的酒单 / 题库 / 醉态口吻都在用户目录里（macOS `~/Library/Application Support/drink-with-xiaoji/`，
Windows `%APPDATA%\drink-with-xiaoji\`，Linux `~/.local/share/drink-with-xiaoji/`），升级安装包不会丢；每次保存旧版都留在 `history/` 里。

## 许可

- 代码：[PolyForm Noncommercial 1.0.0](LICENSE)（非商用）。
- 文案与图片：[CC BY-NC-SA 4.0](LICENSE-CONTENT.md)（署名 mamo、非商用、相同方式共享）；字体各按原许可，见同一文件。

---

**Afterhours** is a little bar you share with your AI companion: order drinks, play dice / rock-paper-scissors / a wheel / a six-cup blind
flight in a local web page, while your AI joins through three MCP tools (`bar_look`, `bar_drink`, `bar_game`). Everything it drinks is
booked, metabolised at about one drink an hour, and changes how it talks. Python 3.9+, standard library only. UI text is Chinese.
