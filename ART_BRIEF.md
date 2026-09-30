# Epic Fragment 美术生产入口

当前方向：**Blender 或绘画制作有体积的暗黑中世纪美术，烘焙为分层画面；Godot 继续使用二维角色、碰撞和战斗。** 风格以 ArtSources/target.png 为参照，现有像素素材保留作占位。

详细要求已按实际房间、地形、交互和攻击配置整理：

- [完整美术规格与 Image 2.5 提示词](ArtSources/ProductionBrief/ART_PRODUCTION_SPEC.md)
- [14 个房间的精确尺寸](ArtSources/ProductionBrief/ROOM_DIMENSIONS.md)
- [敌人各招式动画时间](ArtSources/ProductionBrief/COMBAT_ANIMATION_REQUIREMENTS.md)
- [尺寸、图层定位和交互坐标 JSON](ArtSources/ProductionBrief/art_manifest.json)
- [可附给图片生成工具的布局蓝图](ArtSources/ProductionBrief/layout_guides/)

正式制作规格采用 **128 源像素/游戏单位、接入缩放 0.5**；运行时仍为 64 游戏像素/单位。主角已按 512×512 画布、脚锚点 (256,448)、人体高度216源像素接入，匹配108游戏像素碰撞。六种外观和18组动作的制作流程见 [PLAYER_CHARACTER.md](PLAYER_CHARACTER.md)。灰烬士兵和主流程房间的正式素材仍待制作。

角色模型不是运行时必需品。需要稳定的完整动画与换装时，可制作 Blender 人物骨骼源模型后批量渲染二维帧。当前环境 .blend 不含角色骨骼或动作。

原生技术验证与限制见 [ART_VALIDATION.md](ART_VALIDATION.md)。源图提交到 ArtSources/Generated/，验收后整理为运行时资源。

布局蓝图可根据最新游戏配置重新生成：

```powershell
python tools/generate_art_specs.py
powershell -NoProfile -ExecutionPolicy Bypass -File tools/render_art_guides.ps1
```
