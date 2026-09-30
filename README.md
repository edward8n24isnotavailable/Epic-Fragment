# 史诗碎片 · Godot 原生桌面工程

当前主工程使用 **Godot 4.7.2 Standard + GDScript + 原生 2D 场景 + Compatibility 渲染**，发行目标为 **Windows 10/11 x64**。玩家通过桌面程序运行，开发使用 Godot 编辑器。玩法、剧情、Fragment ID 和基础数值继续以《Epic_Fragment_GDD_v0.1.3_5165.docx》及现有监狱地图方案为准。

## 直接游玩

双击 `start-game.cmd` 或 `release/EpicFragment.exe`。Windows 程序内嵌游戏资源，不需要 Node.js、浏览器或本地 HTTP 服务。Compatibility 使用桌面 OpenGL；硬件要求见 [Godot 官方下载页](https://godotengine.org/download/windows/)。

- A / D 移动，W / Space 跳跃；解锁二段跳后空中再按一次。Shift 疾跑。
- J / K 轻重攻击，Q 盾击，L 弹反、举盾或当前装备战技，R 原素瓶，E 调查和通行。
- F 切换单双手；双手攻击提高 20%，副手暂时停用。侧栏切换主副手及初始出身。
- T 时间轴，I 武器图鉴，Esc 暂停。界面打开时暂停战斗。
- 牧师持圣典时按住 L，输入 W→S→W 小回复、W→A→D 光辉武器或 A→D→S 神识，松开 L 施放。
- 基础手柄映射：左摇杆移动、A 跳跃、X/Y 轻重攻击、LB 防御/战技、RB 原素瓶、B 调查、Back 时间轴、Start 暂停。完整手柄菜单导航和祷言输入仍待制作。

## 编辑与验证

### 三维素材与二维玩法验证房

双击 `start-art-validation.cmd` 打开独立验证房。它使用 `ArtSources` 的 Blender 模型烘焙背景、锁链前景和可动门，保留原有 CharacterBody2D 移动与战斗。`Tab` 切换全景，`C` 对照源碰撞与实际二维碰撞，`V` 开关前景，`Backspace` 重置。详细结论与烘焙命令见 [ART_VALIDATION.md](ART_VALIDATION.md)。

按当前流程制作正式美术时，使用 [ART_BRIEF.md](ART_BRIEF.md) 中的完整规格、房间尺寸、动画时间与 PNG 布局蓝图。

在 Godot 4.7.2 标准版中导入根目录 `project.godot`，按 F6/F5 运行。当前工作区的引擎和官方桌面模板放在 `../.tools/godot/`。其他机器可以安装同版本引擎，设置 `GODOT_EXE`，并在导出预设中清空自定义模板路径，使用编辑器安装的官方模板。

```powershell
# 可选：引擎未在 PATH 或工作区时指定位置
$env:GODOT_EXE = 'C:\Godot\Godot_v4.7.2-stable_win64_console.exe'

powershell -NoProfile -ExecutionPolicy Bypass -File tools/godot.ps1 -Mode Editor
powershell -NoProfile -ExecutionPolicy Bypass -File tools/godot.ps1 -Mode Test
powershell -NoProfile -ExecutionPolicy Bypass -File tools/godot.ps1 -Mode Export
```

脚本在导出前导入资源，检查引擎错误及退出状态。导出结果为 `release/EpicFragment.exe`，内嵌 PCK；同目录生成 `THIRD_PARTY_NOTICES.txt`，随程序分发。目标系统为 Windows 10/11 x64，中文界面使用系统自带的微软雅黑。Godot 原生导出机制见 [Windows 导出文档](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_windows.html)。

`tests/migration_test.gd` 在实际 Godot 场景中检查关卡碰撞、二段跳高台、碎片 Gate、敌人战利品、战斗、祷言、投射物、检查点、死亡回魂与界面暂停；测试存档写入 `.godot/migration-tests/`。

## 路线与范围

牢房 → 走廊没收架 → 下水道 → 通风管台阶 → 中层走廊 → 档案室 F01 → 腐化骑士长廊 → 大厅祭坛 F03。

F01/T0 + F03/T1 在祭坛确认后开放王城公文通道。责难官掉落 F05，提交前三节点解锁监狱临时灵力感知；回大厅公告板取得 F07。王城与皇宫前厅仍是取得 F10 的占位区域，须击败禁卫队长并调查尸体。提交 F01+F03+F05+F07+F10 后解锁二段跳，由大厅高台进入二楼，放下通往中层走廊的永久铁梯。典狱长掉落 F12、钥匙串及戒指；钥匙开启责难官身后的拘押档案夹层并接回军械库外廊。

保留五出身、27 件武器和 10 件副手图鉴、取得限制、属性补正、盾击与韧性、主要精英招式和远程弹体。尚未建成的皇宫区域、F04/F08/F09 获取路线、典狱长召唤、完整动画和音效继续列为后续内容。当前表现采用现有像素素材与 Godot 2D Greybox，原型中的 3D 几何已换成原生 2D 地形碰撞。

## 存档

祭坛 E 或时间轴提交会补满资源并写入 `user://checkpoint.json`。Windows 对应 `%APPDATA%\EpicFragment\checkpoint.json`。重开自动载入，暂停菜单支持手动载入和清档新游戏。持久状态包括装备、碎片、解释、魂、拾取物、捷径与精英击败状态；载入回到大厅祭坛，普通敌人和战斗临时状态重置。存档经过格式校验，先写临时文件，再替换检查点文件。

旧浏览器的 `localStorage` 无法由桌面程序直接读取。在旧版页面的开发者控制台取出 `localStorage.getItem('epic-fragment:checkpoint:v1')`，把返回的 JSON 文本保存为 `.json`，再使用原生暂停菜单“导入旧版 JSON 存档”。无效数据会被拒绝。

## 工程结构

| 路径 | 职责 |
| --- | --- |
| `project.godot` / `scenes/` | 原生工程、主场景、CharacterBody2D 玩家及镜头 |
| `scripts/player.gd` | 移动、原生地形碰撞、攻击、精力、防御、职业战技 |
| `scripts/enemy.gd` | 独立敌人招式、韧性、阶段与伤害 |
| `scripts/world.gd` | 关卡构建、调查与区域切换、奖励、投射物、死亡与检查点 |
| `scripts/game_state.gd` | 进度、装备权限、时间轴 Gate 与版本化文件存档 |
| `scripts/hud.gd` | 原生状态栏、时间轴、图鉴、暂停菜单 |
| `data/game_data.json` | 从旧工程提取的关卡、剧情、装备和敌人配置 |
| `assets/` | 运行时像素素材 |
| `assets/levels/prison_matte/` | Blender 烘焙的背景、前景和门，运行时无需 Blender |
| `ArtSources/` | 美术原文件，通过 `.gdignore` 隔离导入和发行 |
| `scenes/art_validation.tscn` | 独立的美术与二维碰撞验证房 |
| `export_presets.cfg` / `tools/godot.ps1` | Windows 10/11 x64 桌面构建 |
| `legacy/web/` | 归档的 Babylon / React / Havok 原型及原文档；由 `.gdignore` 隔离 |

原型不再是根目录运行入口。旧源码和数据转换工具保留于 `legacy/web/`，用于核对规则。

Steam 接入步骤见 [STEAM.md](STEAM.md)，后续内容见 [ROADMAP.md](ROADMAP.md)。

## 版权与许可

Copyright © 2026 edward8n24isnotavailable. **All rights reserved（保留所有权利）。** 本项目原始代码、美术、剧情及文档的使用、修改、复制或分发，须取得版权持有者的书面授权；法律规定的权利除外。完整条款见 [LICENSE](LICENSE)。第三方软件及素材遵循各自许可，GitHub 平台条款授予的公开仓库查看与 Fork 权利不受影响。
