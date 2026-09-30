# 主角动画与 Blender 制作流程

## 已接入游戏

来源为用户提供的 `ArtSources/ProductionBrief/charactrers.png`。Python 提取顶排六种外观，在 Blender 中建立平面蒙皮网格及 12 根骨骼，制作动作并烘焙透明图集。角色未恢复装备时使用囚徒外观，恢复后按五种出身切换。

每种外观包含 18 组动作、145 帧，共 870 帧：待机、行走、跑步、起跳、下落、落地、轻击、重击、盾击、举盾、弹反、闪避、受击、破防、死亡、喝瓶、施法、祷言。攻击帧按实际前摇、命中、后摇阶段取样；菜单暂停时停止推进。

攻击显示金色挥击轨迹，水平末端使用实际武器距离和原有敌人体宽容差。轨迹表达水平范围，纵向高度用于呈现挥击，并非调试碰撞框。攻击不让人物变红；实际受伤时显示 0.2 秒红色反馈、受击姿势和火花。反馈不更改伤害、无敌帧或攻击判定。

画布为 512×512，脚底锚点 `(256,448)`，游戏缩放 0.5。角色碰撞仍为 40×108，角色动画不会驱动地形碰撞。

## 重新制作

在项目根目录运行：

```powershell
& 'E:\blen\blender.exe' --background --factory-startup --disable-autoexec --python tools/build_player_character.py
powershell -NoProfile -ExecutionPolicy Bypass -File tools/godot.ps1 -Mode Test
powershell -NoProfile -ExecutionPolicy Bypass -File tools/godot.ps1 -Mode Export
```

仅检查提取轮廓时，在 Blender 命令末尾添加 `-- --extract-only`；仅烘焙某种外观用 `-- --skins knight`，会保留其他外观的元数据。

当前机器通过 `../.tools/character-bake-python` 的 `opencv-python-headless==5.0.0.93` 优化轮廓；未安装时使用脚本内的手工轮廓。其他机器需要相同细化结果，可运行：

```powershell
python -m pip install opencv-python-headless==5.0.0.93 --no-deps --target ..\.tools\character-bake-python
```

可编辑源文件：`ArtSources/Generated/player_character/player_puppets.blend`，内含六套骨架、打包的图片纹理和 108 个命名 Action。Action 命名如 `knight|run`，每个 Action 从第 1 帧开始；预览时选择对应骨架并在 Action Editor 中选择动作。源文件里的重叠骨架用于相同坐标烘焙，查看某一种外观时隐藏其他模型。

运行时使用 `assets/characters/player/*_atlas.png` 和 `data/player_animations.json`，无需安装 Blender。完整大画布、裁剪参考和 `.blend1` 备份是本地制作缓存，已排除 Git 跟踪。

## 检查

`tests/player_animation_test.gd` 检查外观切换、多帧移动、跳跃、攻击阶段、伤害闪红、喝瓶、暂停与死亡，共 27 项。实际 OpenGL 截图检查可运行：

```powershell
& '..\.tools\godot\Godot_v4.7.2-stable_win64_console.exe' --path . --fixed-fps 60 --script tests/player_animation_visual_check.gd
```

截图保存在 `.godot/player-preview/`，包含主流程、验证房、攻击范围、受击和姿势对照。

## 当前素材限制

这是基于参考表制作的二维骨骼形变动画。参考图中的单个人物约 200 像素高，不能恢复完整三维模型、遮挡部位或背面。肢体交叠和大幅动作仍受单张纹理限制，适合作为现阶段可玩资源；精细正式动画需要分层人物或完整模型。五种出身外观含图中初始装备，尚未覆盖 27 件武器各自的外观。敌人动画、音效和正式房间美术仍可继续制作。
