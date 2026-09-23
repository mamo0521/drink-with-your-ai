# 文案与图片许可 · Content License

这间吧台里的全部创作内容——`content/` 里的出厂酒单、吧台规矩、醉态口吻，题库（`bar_games.py` 里的 `DEFAULT_QUESTIONS`），
界面文案，以及 `web/assets/bar/` 下的酒图与界面图——由 **mamo** 创作，采用
**[知识共享 署名-非商业性使用-相同方式共享 4.0 国际许可协议 (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)** 授权。

你可以：分享、改编、加新酒、加新题、翻译。条件是：
- **署名**：注明来自 mamo 的「和小机喝一杯」，附本仓库链接；
- **非商业**：不得用于商业目的；
- **相同方式共享**：改编作品须以同一许可发布。

你自己在吧台里写的酒单、题库和醉态口吻是你自己的，存在你电脑的用户目录里，不在这个仓库里，也不受本许可约束。

All creative text (the factory menu, house rules, tipsy-voice tiers, question banks, in-app copy) and the artwork under
`web/assets/bar/` are © 2026 mamo, licensed under **[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)**.
Program code is under the PolyForm Noncommercial License 1.0.0 (see LICENSE).

## 字体 · Fonts

`web/assets/fonts/` 里的字体不是 mamo 的作品，各自按原许可随包分发（子集化只保留常用字）：

| 文件 | 原字体 | 许可 |
|---|---|---|
| `PlayfairDisplay-*.woff2` | Playfair Display | SIL Open Font License 1.1 |
| `Caveat-latin.woff2` | Caveat | SIL Open Font License 1.1 |
| `MamoWenKai-sub.woff2` | 霞鹜文楷 LXGW WenKai | SIL Open Font License 1.1 |
| `MamoSongti-sub.woff2` | 思源宋体 Source Han Serif | SIL Open Font License 1.1 |
| `LXGWNeoXiHei.ttf` | 霞鹜新晰黑 LXGW Neo XiHei | IPA Font License 1.0 |
| `MamoKai-sub.woff2` | 文鼎PL简中楷 AR PL KaitiM GB | Arphic Public License |

3D 骰子用的 three.js 是 MIT 许可。

### 随包许可全文

- [Source Han Serif / 思源宋体 SIL OFL 1.1（含 Adobe 版权声明）](web/assets/fonts/LICENSE-Source-Han-Serif-OFL.txt)：来源：https://github.com/adobe-fonts/source-han-serif/blob/release/LICENSE.txt

- [Arphic Public License（1999 原文）](web/assets/fonts/LICENSE-Arphic.txt)：对应 AR PL KaitiM GB。来源：https://ftp.gnu.org/gnu/non-gnu/chinese-fonts-truetype/LICENSE
- [IPA Font License 1.0（日文 / 英文原文）](web/assets/fonts/LICENSE-LXGW-NeoXiHei-IPA.txt)：对应 LXGW Neo XiHei。来源：https://github.com/lxgw/LxgwNeoXiHei/blob/main/LICENSE.md

上述原文未经改写，字体按各自许可分发，不受本项目文案与图片许可替代。

## 吧台音效

`web/assets/bar/audio/bar-sfx-v21.json` 是本应用使用的音效合辑，包含 Cute & Cozy UI Audio Pack 的已购音效及 reasanka 的 CC0 倒酒声，按各自许可使用，不属于上述文案与图片授权。购买音效允许随应用分发，不允许单独提取后作为音效素材发布。来源和许可见 [音效许可](web/assets/bar/audio/LICENSE.txt)。

鸡尾酒音效含 Debsound 的 [Ice Cube In The Glass 08.wav](https://freesound.org/people/Debsound/sounds/278202/)（[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)）及 nikerk 的 [pouring water](https://freesound.org/people/nikerk/sounds/764760/)（CC0）。混音调整了首尾留白、声道、音量和淡入淡出，并按冰块→倒水顺序拼接。使用时保留 Debsound 署名及许可说明；商用须另获该作者授权或替换音效，项目作者的授权不能代替第三方授权。

气泡饮料音效（资源 v3）使用 megashroom 的 [Beer Pouring Into Glass 170427_1449.wav](https://freesound.org/people/megashroom/sounds/390164/)（CC0 1.0）；取前五秒，末半秒淡出并转换为应用音频格式。

资源v20：可乐与气泡水使用 Taira Komori 的 [Pouring_coke.mp3](https://freesound.org/people/Taira%20Komori/sounds/212735/)（CC BY 4.0），取0.5–4.0秒，末半秒淡出；啤酒保留原声。红茶和十全大补酒分别将 nikerk 的 [teacup set down](https://freesound.org/people/nikerk/sounds/764772/)（CC0）及 Vrymaa 的[瓷盒声](https://freesound.org/people/Vrymaa/sounds/734625/)（CC0，03片段提高5dB），与 paul_sutyrin 的 [pouring tea](https://freesound.org/people/paul_sutyrin/sounds/262322/)（CC BY 4.0）合成。均修剪静音、80ms间隔、轻微边缘淡化、单声道44.1kHz；[CC BY 4.0许可](https://creativecommons.org/licenses/by/4.0/)。

资源v21将上述Taira Komori片段延长为原音频0.5–5.0秒，4.0–5.0秒淡出（成品4.5秒），来源与许可不变。
