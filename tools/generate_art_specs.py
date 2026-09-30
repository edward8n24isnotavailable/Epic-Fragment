"""Generate art layout guides from the real Godot room/surface/interaction data."""
import html
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "ArtSources" / "ProductionBrief"
GUIDES = OUT / "layout_guides"
GUIDES.mkdir(parents=True, exist_ok=True)
data = json.loads((ROOT / "data/game_data.json").read_text(encoding="utf-8"))
world = (ROOT / "scripts/world.gd").read_text(encoding="utf-8")
entries = re.findall(r'^\s*\["([^"]+)", "([^"]+)", ([\d.-]+), ([\d.-]+), "([^"]+)", "([^"]*)"\],', world, re.M)
interactions = [dict(id=e[0], zone=e[1], x=float(e[2]), y=float(e[3]), label=e[4], asset=e[5]) for e in entries]
manifest = {"status": "proposed production specification; runtime still uses existing assets",
    "world_pixels_per_unit": 64, "author_pixels_per_unit": 128, "runtime_sprite_scale": 0.5,
    "padding_pixels": 64, "rooms": [], "interactions": interactions,
    "encounters": [{"id": k, "name": v["name"], "x": v["enemy"]["spawnX"], "y": v["floorY"]} for k, v in data["encounters"].items()],
    "surfaces": data["surfaces"], "weapons": list(data["weapons"]), "offhands": list(data["offhands"])}
themes = {
    "Cell": "囚笼、潮湿石墙、睡铺、铁栏；左端封闭，右端连走廊",
    "PrisonCorridor": "没收架、守卫岗位、牢房 D 短刀；左右连接牢房与下水道",
    "Sewer": "低洼湿石、暗渠、水痕、石桥下戒指；现有地面连续，水主要是装饰",
    "Vent": "四段向右升高的 4 米平台、通风管、假墙和羽毛；保持真实跳台轮廓",
    "MiddleCorridor": "巡逻士兵长廊、支柱、破栏、通往二楼的捷径梯",
    "Archive": "档案柜、散落卷宗、F01；保留 x=-17 的调查空间",
    "KnightCorridor": "腐化骑士战场、盾痕、破旗、高台戒指；战斗区域保持清楚",
    "MainHall": "祭坛、F03、F07 公告板、公文通道、后楼梯与二段跳高台；区分交互对象",
    "InquisitorRoom": "责难官刑具、锁链、烙铁、拘押档案门；留出战斗空地",
    "SecondFloor": "长巡逻廊桥、四狱卒、左端典狱长战场；与下层共享同一空间",
    "CityStreet": "城门、封锁栅栏、冷色街道、返回监狱入口；先做当前入口范围",
    "PalaceFoyer": "禁卫队长战场、宫廷柱廊、尸体与 F10 文书；现有占位范围",
    "Armory": "兵器架、木箱、甲胄、通往大厅与档案夹层的通道",
    "DetentionArchive": "拘押名册、档案架、夹层通道与责难官房锁门回路",
}
rows = []
for index, room in enumerate(data["rooms"]):
    zone = "prison" if index < 10 else "city" if index < 12 else "armory" if index == 12 else "detention"
    top = 17.0 if zone == "prison" else room["floorY"] + 10.0
    bottom = -5.5 if zone == "prison" else room["floorY"] - 4.0
    width = round((room["maxX"] - room["minX"]) * 128)
    height = round((top - bottom) * 128)
    spec = {**room, "zone": zone, "top_y": top, "bottom_y": bottom,
        "core_size": [width, height], "delivery_size": [width + 128, height + 128],
        "baseline_core_px": round((top - room["floorY"]) * 128),
        "baseline_delivery_px": round((top - room["floorY"]) * 128) + 64,
        "godot_origin": [room["minX"] * 64 - 32, -top * 64 - 32], "theme": themes[room["id"]], "segments": []}
    count = math.ceil((room["maxX"] - room["minX"]) / 16)
    for segment in range(count):
        left = room["minX"] + segment * 16
        right = min(room["maxX"], left + 16)
        seg_width = round((right - left) * 128) + 128
        segment_id = room["id"] if count == 1 else f'{room["id"]}_{segment + 1:02d}'
        actor_x = (left + right) / 2
        supporting = [s for s in data["surfaces"][zone] if s["minX"] <= actor_x < s["maxX"] and (not s.get("oneWay") or room["id"] == "SecondFloor")]
        actor_y = max(s["y"] for s in supporting) if supporting else room["floorY"]
        spec["segments"].append({"id": segment_id, "minX": left, "maxX": right, "size": [seg_width, height + 128], "godot_origin": [left * 64 - 32, -top * 64 - 32], "reference_character": [actor_x, actor_y]})
        def px(x): return round((x - left) * 128 + 64, 2)
        def py(y): return round((top - y) * 128 + 64, 2)
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{seg_width}" height="{height + 128}" viewBox="0 0 {seg_width} {height + 128}">', '<rect width="100%" height="100%" fill="#18232d"/>']
        svg.append(f'<rect x="64" y="64" width="{seg_width - 128}" height="{height}" fill="none" stroke="#ffffff" stroke-width="2"/>')
        for x in range(math.floor(left), math.ceil(right) + 1):
            svg.append(f'<line x1="{px(x)}" y1="64" x2="{px(x)}" y2="{height+64}" stroke="#334553" stroke-width="1"/>')
        for y in range(math.ceil(bottom), math.floor(top) + 1):
            svg.append(f'<line x1="64" y1="{py(y)}" x2="{seg_width-64}" y2="{py(y)}" stroke="#334553" stroke-width="1"/>')
        for surface in data["surfaces"][zone]:
            a, b = max(left - 0.5, surface["minX"]), min(right + 0.5, surface["maxX"])
            if a >= b: continue
            color = "#ffc857" if surface.get("oneWay") else "#56e39f"
            svg.append(f'<line x1="{px(a)}" y1="{py(surface["y"])}" x2="{px(b)}" y2="{py(surface["y"])}" stroke="{color}" stroke-width="6"/>')
            svg.append(f'<text x="{px(a)+6}" y="{py(surface["y"])-12}" fill="{color}" font-size="18">{html.escape(surface["id"])}</text>')
        for entry in interactions:
            if entry["zone"] != zone or not left <= entry["x"] <= right: continue
            svg.append(f'<circle cx="{px(entry["x"])}" cy="{py(entry["y"])}" r="10" fill="#69c9ff"/>')
            svg.append(f'<text x="{px(entry["x"])+14}" y="{py(entry["y"])-14}" fill="#69c9ff" font-size="20">{html.escape(entry["id"])}</text>')
        foot_y = py(actor_y)
        svg.append(f'<rect x="{px((left+right)/2)-40}" y="{foot_y-216}" width="80" height="216" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-width="3"/>')
        svg.append(f'<text x="76" y="40" fill="#ffffff" font-size="24">{segment_id} | 128 px/unit | green=solid, gold=one-way, blue=interaction</text></svg>')
        (GUIDES / (segment_id + ".svg")).write_text("\n".join(svg), encoding="utf-8")
    manifest["rooms"].append(spec)
    rows.append(f'| {room["id"]} / {room["label"]} | {zone} | {room["minX"]}～{room["maxX"]} | {room["floorY"]} | {round((room["maxX"]-room["minX"])*64)} | {width}×{height} | {spec["baseline_core_px"]} | {count} |')
(OUT / "art_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
(OUT / "ROOM_DIMENSIONS.md").write_text("# 按当前数据生成的房间尺寸\n\n坐标单位采用现有游戏单位。原点上方为正高度；核心图不含外扩。统一采用 128 源像素/单位，接入时缩放 0.5；这是一份制作规格，尚未改变游戏资源。每张图上下左右各外扩 64 源像素，交付宽高在核心尺寸上各加 128。地面线交付坐标在表中核心行号上加 64。相邻房间可共同出图但必须保留各自坐标；二楼与下层使用同一世界坐标。\n\n| 房间 | 区域 | 世界 X | 主地面 Y | 游戏宽/px | 核心源图尺寸/px | 主地面行号/px | ≤16 单位分块数 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n" + "\n".join(rows) + "\n\n具体分块尺寸、放置原点及所有地面和交互坐标见 `art_manifest.json`；蓝图见 `layout_guides/`。通风管四段实际地面、骑士高台、大厅高台、二楼均已画入蓝图，不能只用房间主地面画一条平地。上、下层重叠的图层需要共同设计；禁止将二楼图片的下层区域画成不透明遮挡。\n", encoding="utf-8")
print(f"Generated {len(manifest['rooms'])} rooms, {len(interactions)} interactions, {sum(len(r['segments']) for r in manifest['rooms'])} segment guides")

combat_lines = ["# 当前敌人招式动画需求", "", "所有时间直接来自现有 profiles 配置。蓄力、命中、收招需要分别组织帧段；以24fps制作参考关键帧，实际播放必须保持这些秒数。先制作右向，左向可镜像。四个 upper 遭遇共用 upper1 的动作。相同二阶段动作不重复交付，只制作新增/变化招式。", "", "| 人物 | 阶段 | 招式 | 蓄力/秒 | 命中/秒 | 收招/秒 |", "| --- | --- | --- | --- | --- | --- |"]
for profile_id in ["cellGuard", "soldier", "upper1", "corruptedKnight", "inquisitor", "warden", "palaceGuard"]:
    seen = set()
    for phase, config in data["profiles"][profile_id].items():
        for attack in config["attacks"]:
            signature = (attack["name"], attack["windup"], attack["active"], attack.get("recovery", 0.8))
            if signature in seen: continue
            seen.add(signature)
            combat_lines.append(f'| {data["encounters"][profile_id]["name"]} / {profile_id} | {phase} | {signature[0]} | {signature[1]} | {signature[2]} | {signature[3]} |')
combat_lines += ["", "投射物、刀光、锁链和地震冲击波另交；攻击动作不能把这些效果与角色背景合并。敌人还需要 idle/walk/hurt/exhausted/death；力竭保持可循环，死亡末帧保持。典狱长召唤仍在路线图待制作，暂不扩充召唤小怪清单。", ""]
(OUT / "COMBAT_ANIMATION_REQUIREMENTS.md").write_text("\n".join(combat_lines), encoding="utf-8")
