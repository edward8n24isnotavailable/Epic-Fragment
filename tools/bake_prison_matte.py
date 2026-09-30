"""Run with Blender --background --disable-autoexec <source.blend> --python this_file.

Recovers the original GLB textures, renders aligned layers and projects the source
collision meshes into Godot's 2D plane. Never saves or changes the source .blend.
"""
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "levels" / "prison_matte"
CACHE = ROOT / ".godot" / "art-review" / "textures"
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)

raw = (ROOT / "ArtSources" / "EpicFragment_Prison_V7_4_Complete.glb").read_bytes()
json_length = struct.unpack_from("<I", raw, 12)[0]
gltf = json.loads(raw[20:20 + json_length])
bin_start = 20 + json_length + 8
restored = []
for image in gltf["images"]:
    view = gltf["bufferViews"][image["bufferView"]]
    start = bin_start + view.get("byteOffset", 0)
    path = CACHE / (image["name"] + ".png")
    path.write_bytes(raw[start:start + view["byteLength"]])
    restored.append(image["name"])
for image in bpy.data.images:
    source_name = image.filepath.replace("\\", "/").rsplit("/", 1)[-1].removesuffix(".png")
    if source_name in restored:
        image.filepath = str(CACHE / (source_name + ".png"))
        image.reload()
        assert image.size[0] > 0, image.name
        print("RESTORED", image.name, list(image.size), flush=True)

def hull(points):
    points = sorted(set(points))
    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lower, upper = [], []
    for p in points:
        while len(lower) > 1 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(points):
        while len(upper) > 1 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]

scene = bpy.context.scene
camera = scene.camera
camera.location = (0, -43, 4.5)
camera.rotation_euler = (math.pi / 2, 0, 0)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 40
scene.render.resolution_x = 2560
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = True
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.cycles.use_denoising = True

colliders, markers = [], {}
for obj in bpy.data.objects:
    if obj.name.startswith("COL_"):
        vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
        polygon = hull([(round(v.x * 64, 4), round(-v.z * 64, 4)) for v in vertices])
        playable = polygon
        note = "Source x/z convex projection"
        if obj.name == "COL_Stair_Left_LowerRamp":
            playable = [[-987.2, -195.84], [-644.8, 0], [-644.8, 1.28], [-987.2, 1.28]]
            note = "Source mesh is a box, replaced with a slope following visible steps"
        elif obj.name == "COL_Stair_Left_TurnLanding":
            playable = [[x, -195.84 if y < -195.84 else y] for x, y in polygon]
            note = "Top lowered from 3.25 to the visible landing at 3.06"
        colliders.append({"name": obj.name, "source_polygon": polygon, "polygon": playable,
            "one_way": obj.name.startswith("COL_Upper_") or obj.name == "COL_Stair_Left_TurnLanding",
            "enabled": obj.name != "COL_Stair_Left_Upper",
            "note": "Depth-facing stair: use a 2D jump from turn landing" if obj.name == "COL_Stair_Left_Upper" else note})
    elif obj.name.startswith("MARK_"):
        p = obj.matrix_world.translation
        markers[obj.name] = [round(p.x * 64, 4), round(-p.z * 64, 4)]

meshes = [o for o in bpy.data.objects if o.type == "MESH" and not o.name.startswith("COL_")]
door = [o for o in meshes if o.name.startswith("Door_Right")]
foreground = [o for o in meshes if o.name.startswith(("Chain_", "Cage_"))]
fx = [o for o in meshes if any(slot.material and slot.material.name in ("M_Flame", "M_RuneBlue") for slot in o.material_slots)]
water = [o for o in meshes if "Water" in o.name]
print("BAKE_PARTS", json.dumps({"door": [o.name for o in door], "foreground": [o.name for o in foreground], "fx": [o.name for o in fx], "water": [o.name for o in water]}), flush=True)
metadata = {"unit": 64, "image_size": [2560, 1024], "image_origin": [-1280, -800],
    "camera": {"x": 0, "height": 4.5, "width": 40, "rotation_degrees": [90, 0, 0]},
    "restored_textures": restored, "colliders": colliders, "markers": markers,
    "layers": {"foreground_objects": [o.name for o in foreground], "door_objects": [o.name for o in door], "runtime_fx_objects": [o.name for o in fx]},
    "limitations": ["The depth-facing upper stair needs a 2D jump adapter", "Source spawn intersects the lower ramp; snap to its top", "Lighting and static shadows are baked; player does not cast a baked shadow"]}
(ROOT / "data" / "prison_matte.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

base = [o for o in meshes if o not in door + foreground + fx]
for name, group in (("background", base), ("foreground", foreground), ("door", door)):
    for obj in meshes:
        obj.hide_render = obj not in group
    for obj in bpy.data.objects:
        if obj.name.startswith("COL_"):
            obj.hide_render = True
    scene.render.filepath = str(OUT / (name + ".png"))
    print("BAKE_RENDER", name, flush=True)
    bpy.ops.render.render(write_still=True)
print("BAKE_COMPLETE", str(OUT), flush=True)
