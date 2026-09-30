# Epic Fragment · Godot + Blender V8.0 Matte Prototype Plan

> 当前技术栈：**Godot + Blender**  
> 当前目标：将监狱场景从“Blender 全场景视觉主导”切换为  
> **2.5D Matte Painting + Blender Gameplay Geometry + Godot Runtime FX**

---

# 1. 技术路线

新的职责划分：

```text
Blender
├── Gameplay Geometry
├── COL_* Collision Proxy
├── MARK_* Gameplay Marker
├── 少量必须的真实 3D Props
└── Export GLB
        ↓
Godot
├── 2.5D Matte Visual
├── Player / Enemy
├── Runtime Lighting
├── Torch / Rune / Fog / Water FX
├── Foreground Occlusion
└── Gameplay Runtime
```

核心原则：

- Blender 不再负责把整张画面做到 Concept Art 质量。
- Godot 是最终 Runtime。
- 效果图 / Matte Painting 负责静态视觉质量。
- Blender 几何继续负责实际玩法结构。
- Collision 与 Visual 完全分离。

---

# 2. 推荐项目目录

```text
EpicFragment/
│
├─ godot/
│  ├─ project.godot
│  │
│  ├─ assets/
│  │  ├─ levels/
│  │  │  └─ prison/
│  │  │     ├─ glb/
│  │  │     │  ├─ prison_gameplay.glb
│  │  │     │  ├─ prison_collision.glb
│  │  │     │  └─ prison_markers.glb
│  │  │     │
│  │  │     └─ matte/
│  │  │        ├─ prison_full_prototype.png
│  │  │        ├─ bg_far.png
│  │  │        ├─ bg_architecture.png
│  │  │        ├─ gameplay_visual.png
│  │  │        ├─ fg_left.png
│  │  │        └─ fg_right.png
│  │  │
│  │  ├─ characters/
│  │  ├─ props/
│  │  ├─ textures/
│  │  └─ fx/
│  │
│  ├─ scenes/
│  │  ├─ levels/
│  │  │  └─ prison/
│  │  │     ├─ prison_v8_0.tscn
│  │  │     ├─ prison_visual_layers.tscn
│  │  │     └─ prison_gameplay_geometry.tscn
│  │  │
│  │  ├─ characters/
│  │  └─ fx/
│  │
│  ├─ scripts/
│  │  ├─ levels/
│  │  └─ import/
│  │
│  └─ shaders/
│
├─ art_source/
│  │
│  ├─ blender/
│  │  └─ prison/
│  │     ├─ EpicFragment_Prison_V7_4.blend
│  │     ├─ scripts/
│  │     ├─ textures/
│  │     └─ exports/
│  │
│  ├─ concept/
│  │  └─ prison/
│  │     ├─ target_reference.jpg
│  │     ├─ current_blender_preview.png
│  │     └─ references/
│  │
│  └─ matte/
│     └─ prison/
│        ├─ working/
│        └─ exported/
│
├─ docs/
│  ├─ ART_DIRECTION.md
│  ├─ GODOT_BLENDER_PIPELINE.md
│  └─ V8_0_PLAN.md
│
└─ README.md
```

---

# 3. 现有资产放置位置

## Blender 源文件

放到：

```text
art_source/blender/prison/
```

例如：

```text
art_source/blender/prison/EpicFragment_Prison_V7_4.blend
art_source/blender/prison/scripts/
art_source/blender/prison/textures/
art_source/blender/prison/exports/
```

Blender 生成的 GLB 首先放：

```text
art_source/blender/prison/exports/
```

确认可用于 Runtime 后，再复制到：

```text
godot/assets/levels/prison/glb/
```

---

## 当前 Blender Preview

放到：

```text
art_source/concept/prison/current_blender_preview.png
```

---

## 目标效果图

放到：

```text
art_source/concept/prison/target_reference.jpg
```

它作为：

```text
Art Direction Reference
```

不要直接覆盖原文件。

---

## Godot Runtime Matte

真正被 Godot 使用的图片放：

```text
godot/assets/levels/prison/matte/
```

V8.0 第一阶段：

```text
godot/assets/levels/prison/matte/prison_full_prototype.png
```

后续拆层后：

```text
bg_far.png
bg_architecture.png
gameplay_visual.png
fg_left.png
fg_right.png
```

---

# 4. `.gdignore`

如果 `art_source` 位于 Godot `project.godot` 目录内部：

```text
EpicFragment/
├─ project.godot
├─ assets/
├─ scenes/
└─ art_source/
```

在：

```text
art_source/
```

下面创建：

```text
.gdignore
```

可以是空文件。

目的：

避免 Godot 自动扫描：

- `.blend`
- Blender Python
- Reference JPG
- 临时导出
- PSD / Working Asset
- 非 Runtime 文件

原则：

```text
art_source = 源资产
assets     = Godot Runtime Asset
```

---

# 5. V8.0 目标

V8.0 暂时不要做完整最终 Pipeline。

只验证：

> 是否可以让效果图成为主要视觉，同时继续使用 Blender 几何作为真实玩法结构。

V8.0 Scene：

```text
PrisonV8
├── GameplayGeometry
├── MatteVisual
├── DynamicObjects
├── FX
└── Camera
```

---

# 6. Matte Prototype

V8.0 先使用一张完整 Matte：

```text
prison_full_prototype.png
```

Godot 可以使用：

```text
MeshInstance3D
└── QuadMesh
```

或者：

```text
Sprite3D
```

Matte 必须使用：

```text
Unshaded
```

不要让 Godot Light 重新照 Matte。

Concept：

```text
Target Concept
      ↓
Unshaded Matte
      ↓
Orthographic Camera
```

---

# 7. Camera

推荐：

```text
Orthographic Camera
```

要求：

- 固定 Rotation
- 2.5D Side View
- 不允许自由旋转
- Matte 和 Gameplay Geometry 对齐
- 后续可以水平跟随 Player

---

# 8. Blender Geometry 的新职责

继续保留：

```text
COL_*
MARK_*
Gameplay Stair
Gameplay Platform
Gameplay Wall Boundary
Door Area
Spawn Point
Torch Anchor
Rune Anchor
```

逐渐降低投入：

```text
大面积 Stone Visual Mesh
整墙 PBR
Stone Normal
Stone Roughness
大量 UV 微调
为了 Concept Art 反复调整 Blender 灯光
```

---

# 9. Collision

Godot 中：

```text
COL_*
```

应转换或对应为：

```text
StaticBody3D
CollisionShape3D
```

或者现有项目中等价的 Collision Workflow。

玩家看到：

```text
Matte Artwork
```

玩家真正踩：

```text
COL_*
```

视觉平台必须与碰撞平台严格对齐。

---

# 10. Marker

```text
MARK_*
```

表示 Gameplay Position。

例如：

```text
MARK_PlayerStart
MARK_Torch_*
MARK_Rune_*
MARK_Door_*
MARK_EnemySpawn_*
```

在 Godot 中优先映射为：

```text
Marker3D
```

或现有项目中的等价实现。

---

# 11. 后续最终视觉分层

V8.0 验证成功后：

```text
BG_FAR
BG_ARCHITECTURE
GAMEPLAY_VISUAL
PLAYER / ENEMY / FX
FG_OCCLUSION
```

典型层次：

```text
Camera

FG
Player / Enemy / FX
Gameplay Visual
BG Architecture
BG Far

Invisible Collision
Markers
```

---

# 12. 动态内容

以下内容不要完全烘焙进 Matte：

```text
Player
Enemy

Torch Flame
Rune Glow
Fog
Water
Moving Chain
Gate
Trap
Particles
Foreground Occlusion
```

原则：

```text
Static Beauty
→ Matte

Dynamic Behavior
→ Godot
```

---

# 13. 火把

建议：

```text
Torch Fixture
→ Matte

Wall Warm Lighting
→ Matte

Flame
→ Godot Particle / Sprite

Dynamic Light
→ Godot Light
```

Godot Light 主要影响：

- Player
- Enemy
- Dynamic Props

而不是重新照整张背景。

---

# 14. Rune

建议：

```text
Rune Base
→ Matte

Rune Symbol
→ Emissive Sprite / Quad

Blue Glow
→ Godot Light

Particles
→ Godot Particle System
```

---

# 15. Water

建议：

```text
Water Base
→ Matte

Dynamic Water Surface
→ Godot Shader

Ripple
→ Shader / FX

Splash
→ Particle
```

背景负责视觉品质。

Godot 负责动态感。

---

# 16. V8.0 Codex Prompt

下面内容可以直接给 Codex。

```markdown
# Epic Fragment — Godot + Blender V8.0 Matte Prototype

You are working on the Epic Fragment game project.

The current technical stack is:

- Godot Engine
- Blender
- GDScript unless the existing project clearly uses another language
- Blender is used for source geometry, gameplay geometry, collision proxies, markers, and selected 3D props.
- Godot is the runtime and owns rendering, gameplay, camera, VFX, lighting, scene composition, and 2.5D presentation.

The previous Babylon.js direction is obsolete.

Do not introduce Babylon.js, TypeScript, React, or web runtime code.

---

## Goal

The current Blender prison scene is technically functional but visually much weaker than the approved target concept art.

We are changing the rendering strategy.

Do NOT try to reproduce the target concept art by endlessly improving:

- stone PBR materials
- normal maps
- roughness
- Blender lighting
- brick geometry
- UV detail

Instead, implement:

**2.5D Matte Painting + Blender Gameplay Geometry + Godot Runtime FX**

The immediate target is:

**V8.0 Godot Matte Prototype**

The purpose of V8.0 is to prove that the target artwork can be used as the primary visual presentation while the existing Blender geometry continues to provide gameplay structure.

---

## Source asset locations

Inspect these directories first:

```text
art_source/blender/prison/
art_source/concept/prison/
```

Expected source images:

```text
art_source/concept/prison/current_blender_preview.png
art_source/concept/prison/target_reference.jpg
```

Treat `target_reference.jpg` as the visual target.

Treat `current_blender_preview.png` as the current baseline.

Do not overwrite either source image.

Approved Blender exports used by Godot belong under:

```text
godot/assets/levels/prison/glb/
```

Runtime matte textures belong under:

```text
godot/assets/levels/prison/matte/
```

---

## Preserve gameplay structure

The current Blender geometry is the gameplay/layout baseline.

Do NOT redesign the map.

Do NOT rebuild the prison from scratch.

Preserve:

```text
COL_*
MARK_*
```

Conceptually:

```text
COL_*  = collision
MARK_* = gameplay marker
VIS_*  = visual geometry
```

The new matte strategy does not remove collision or marker data.

---

## V8.0 implementation

Implement a Godot prison prototype scene, approximately:

```text
prison_v8_0.tscn
```

Conceptual scene tree:

```text
PrisonV8
├── GameplayGeometry
├── MatteVisual
├── DynamicObjects
├── FX
└── Camera
```

Follow the existing project conventions if they differ.

---

## Matte prototype

Use one full matte image for V8.0:

```text
prison_full_prototype.png
```

Use either:

```text
MeshInstance3D + QuadMesh
```

or:

```text
Sprite3D
```

Use an unlit / unshaded material.

The matte must not react to normal scene lighting.

Do not add PBR normal or roughness to it.

---

## Camera

Prefer an orthographic camera unless the existing project explicitly requires another setup.

Requirements:

- fixed rotation
- 2.5D side-view composition
- matte aligned with gameplay geometry
- no free camera rotation

---

## Gameplay geometry

Import the existing Blender GLB if a valid export already exists.

The intended architecture is:

```text
player sees:
matte artwork

player collides with:
Blender gameplay geometry
```

Collision geometry should not be normally visible.

---

## COL_* handling

Inspect imported objects named:

```text
COL_*
```

Use a clean Godot collision representation such as:

```text
StaticBody3D
CollisionShape3D
```

or the existing project's equivalent workflow.

Do not use high-detail visual geometry as primary collision if a proper proxy already exists.

---

## MARK_* handling

Objects named:

```text
MARK_*
```

represent runtime positions.

Examples may include:

```text
MARK_PlayerStart
MARK_Torch_*
MARK_Rune_*
MARK_Door_*
MARK_EnemySpawn_*
```

Expose these as meaningful Godot runtime markers, preferably:

```text
Marker3D
```

or the existing project's equivalent.

---

## Dynamic rendering responsibility

Do not fully implement final VFX in V8.0.

Keep the architecture ready for:

```text
Player
Enemy
Torch Flame
Rune Glow
Fog
Water
Moving Chains
Doors
Traps
Particles
Foreground Occlusion
```

Static beauty should primarily come from the matte.

Dynamic elements should stay as Godot runtime elements.

---

## Lighting

Do not relight the matte.

The matte already contains the visual lighting.

Future Godot lights should mainly affect:

- player
- enemies
- moving props
- interactive objects

Keep V8.0 lighting minimal.

---

## Do not over-engineer V8.0

Do not immediately implement:

- final water shader
- final fog
- complete parallax system
- advanced post process
- final torch particles
- final rune effects
- broad architecture refactoring

First prove:

```text
Does the target artwork work as the primary game visual
while existing Blender geometry still drives gameplay?
```

---

## Success criteria

V8.0 is successful when:

1. The Godot prison scene runs.
2. The target matte is visible.
3. The matte is unlit and visually close to the original.
4. Existing Blender gameplay geometry can coexist with it.
5. Collision remains usable.
6. Player/game objects can render in front of the background.
7. The scene structure can later support layer splitting.
8. No Babylon.js code is introduced.
9. Blender source assets are not destructively modified.
10. Unrelated project functionality remains intact.

---

## Work process

Before changing code:

1. Inspect the repository.
2. Locate `project.godot`.
3. Identify the Godot version.
4. Identify the current main scene.
5. Inspect existing scene architecture.
6. Locate existing GLB assets.
7. Locate the concept images.
8. Reuse existing conventions where appropriate.
9. Provide a short implementation plan.
10. Then make the smallest coherent V8.0 change set.

---

## Deliverables

At completion provide:

### Files added

List all new files.

### Files modified

List all modified files and why.

### Scene structure

Describe the resulting Godot scene tree.

### Asset paths

State exactly which GLB and matte assets are used.

### Running instructions

Explain exactly how to run the prototype.

### Known limitations

Identify intentionally deferred work.

### Next step

Recommend the next technical task but do not implement unrelated future work.

---

## Constraints

Do not redesign the level.

Do not rebuild the Blender prison.

Do not spend this task polishing stone textures.

Do not introduce Babylon.js.

Do not make the matte react to 3D lighting.

Do not delete existing collision or marker data.

Do not overwrite source concept art.

Do not perform unrelated refactoring.

The immediate objective is a working Godot visual prototype, not the final production art pipeline.
```

---

# 17. 推荐执行顺序

```text
V8.0
Full Matte Prototype
        ↓
V8.1
Layout-specific Matte
        ↓
V8.2
Layer Split
        ↓
V8.3
Dynamic FX
        ↓
V8.4
Gameplay / Collision Alignment
        ↓
V8.5
Parallax + Scene Polish
```

当前不要继续投入大量时间：

```text
Stone
Floor
Wood
Normal
Roughness
Blender full-scene lighting
```

优先验证新的 Godot 2.5D Matte Pipeline。
