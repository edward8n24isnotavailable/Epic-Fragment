# 三维美术 + 二维碰撞验证

## 结论

这条路线可行。Blender 提供模型、材质和静态光影；烘焙成二维透明图层后，Godot 的 CharacterBody2D、碰撞、近战和交互照常运行。运行时仍是原生二维工程，使用现有 Compatibility 渲染。

本次是一个独立房间的技术验证。源模型烘焙后的视觉仍有明显的模块化结构，尚未达到 `ArtSources/target.png` 的手绘细节、完整背景和氛围。可以继续采用该流程，但需要继续制作美术；换引擎或导入模型不会自动得到目标图的效果。

## 运行

双击根目录 `start-art-validation.cmd`。它启动导出的 `release/EpicFragment.exe -- --art-validation`；没有导出程序时，通过本地 Godot 运行验证场景。

开发运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/godot.ps1 -Mode ArtValidation
```

控制：A/D 移动，空格跳跃，Shift 冲刺，J/K 轻重攻击，L 盾技。向左沿楼梯上行，在转角跳上二楼；下层水坑需要在边缘起跳。右侧门前 E 开门。Tab 全景/跟随，C 碰撞对照，V 前景开关，B 临时切换二段跳，Backspace 重置门、角色和敌人，Esc 暂停。

验证房使用独立内存状态，不读取或写入正式检查点，不改变正式地图和进度。上层中央缺口保留源模型尺寸，不保证单跳可跨越；B 仅供验证，正式能力解锁规则仍在原游戏中。

## 实际完成

- 从 GLB 中恢复 9 张原始纹理，在 Blender 内存中重连 `.blend` 的材质。
- 用正交侧视镜头烘焙三层：静态背景、前景锁链/吊笼、右侧门。原 `.blend`、GLB 和目标图保持原样。
- 统一比例为 1 米 = 64 像素；2560×1024 渲染覆盖 40×16 米，像素原点对应 Godot `(-1280, -800)`。
- 将源 `COL_*` 的 x/z 顶点投影到二维；`MARK_*` 定位火把、符文及交互。
- 火焰、符文脉动、水面线条和门运动由 Godot 绘制/驱动；前景层覆盖角色。
- 复用正式角色控制器和士兵 AI。房间中的碰撞全部由 StaticBody2D / CollisionPolygon2D 处理。

## 源素材冲突与处理

| 问题 | 验证处理 |
| --- | --- |
| `.blend` 引用的外部纹理缺失 | 从 GLB 的内嵌 PNG 恢复；缓存放在 `.godot/art-review/textures/` |
| `COL_Stair_Left_LowerRamp` 是方盒，不是真斜坡 | 补上跟随可见台阶走势的二维斜坡；C 显示紫色源方盒与绿色实际斜坡 |
| 上段楼梯沿景深转弯 | 不将其投影盒子当作实体墙；在转角用原有单跳上高台 |
| 转角碰撞顶面 3.25 米，可见平台 3.06 米 | 按可见高度校正，并使用单向平台避免其侧面阻挡上楼 |
| 二楼平台覆盖下方楼梯 | 二楼使用单向碰撞，允许从下方穿过后落在平台上 |
| `MARK_PlayerStart` 位于源斜坡盒内部 | 初始角色提升到校正斜坡表面 |
| 目标图、源模型与正式地图不是同一布局 | 使用独立场景验证；正式地图需要按已有通路逐房间制作美术 |

楼梯使用平滑斜坡近似台阶，脚部会有局部误差，需在正式美术中统一踏步轮廓与碰撞走势。下层平地与二楼平面落地误差实测小于 2 个游戏像素。

## 验证证据

`tests/art_validation_test.gd` 的 19 项检查通过：出生修正、平地下落、无跳跃上楼、转角单跳上高台、上下层落地、落水重置、冲刺单跳过水坑、近战伤害、关门阻挡、开门同步、开门后通过、前景层次及房间重置等。

原有 `tests/migration_test.gd` 的 60 项检查通过。`tools/godot.ps1 -Mode Test` 现包含两组检查。

Windows 导出程序已重新生成，并使用 `--art-validation` 启动入口完成 120 帧无窗口加载检查，退出码 0，没有脚本或资源错误。发行包只增加了烘焙图层与房间资源，原始 Blender/GLB 不参与打包。

实际 OpenGL 渲染验证使用 Intel UHD Graphics 770。截图位于：

- `.godot/art-review/validation-overview.png`：房间全景。
- `.godot/art-review/validation-follow.png`：跟随视角与角色落脚。
- `.godot/art-review/validation-collision.png`：实际与源碰撞对照。

本次在当前 Windows 开发机验证；未在另一台 Windows 10 或 Windows 11 机器分别测试。

## 还需要继续制作的内容

背景和阴影已烘焙，角色不会改变背景照明，也不会向烘焙墙面投射动态阴影。接触阴影和火把光晕是二维近似。右门使用上移开门作为交互占位；水面是简单动画，不包含真实反射/浮力。这些足够验证图层与玩法衔接，最终表现需要进一步制作。

建议按现有二维关卡的碰撞轮廓做一间正式房间的美术：先统一镜头、角色比例、楼梯轮廓和行走面，再补齐连续背景、材质细节与前景碎石。角色的像素画风也需与环境统一。目标图可作为美术参照，但不能直接替代缺失的图层和精确碰撞。

## 重新烘焙

```powershell
& 'E:\blen\blender.exe' --background --factory-startup --disable-autoexec `
  'ArtSources/EpicFragment_Prison_V7_4.blend' --python 'tools/bake_prison_matte.py'
powershell -NoProfile -ExecutionPolicy Bypass -File tools/godot.ps1 -Mode Test
powershell -NoProfile -ExecutionPolicy Bypass -File tools/godot.ps1 -Mode Export
```

烘焙工具不保存源 Blender 文件。材质贴图来自原 GLB；源文件命名或楼梯布局改变后，应检查脚本中的图层选择与楼梯修正参数。运行时只打包生成的 PNG 和碰撞 JSON；`ArtSources/.gdignore` 排除原始工程。
