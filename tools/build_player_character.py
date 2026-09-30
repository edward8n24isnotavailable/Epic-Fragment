"""Blender Python: extract the user poster and bake an editable 2D puppet rig.

Run: blender --background --factory-startup --disable-autoexec --python this_file
Use -- --extract-only for inspecting the non-destructive cutouts first.
"""
from collections import deque
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "ArtSources/ProductionBrief/charactrers.png"
WORK = ROOT / "ArtSources/Generated/player_character"
OUT = ROOT / "assets/characters/player"
WORK.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
dependency_path = ROOT.parent / ".tools/character-bake-python"
if dependency_path.is_dir(): sys.path.insert(0, str(dependency_path))
try:
    import cv2
except ImportError:
    cv2 = None

source_image = bpy.data.images.load(str(SOURCE), check_existing=False)
W, H = source_image.size
raw = np.empty(W * H * 4, dtype=np.float32)
source_image.pixels.foreach_get(raw)
poster = raw.reshape(H, W, 4)[::-1].copy()

SKINS = {
    "prisoner": (10, 259, 123), "knight": (261, 510, 124),
    "assassin": (513, 767, 126), "mage": (770, 1021, 128),
    "cleric": (1025, 1277, 124), "wretch": (1280, 1526, 129),
}

# Hand reviewed silhouettes in each poster cell (local x/y). Color keying alone
# deletes the gray clothes and hair because they resemble the painted background.
SILHOUETTES = {
    "prisoner": [(127,6),(140,4),(148,10),(148,18),(142,24),(144,30),(139,36),(139,44),(135,49),(139,65),(137,77),(143,90),(149,106),(147,116),(140,112),(136,98),(130,91),(135,115),(145,130),(152,132),(153,143),(149,158),(145,176),(144,185),(160,190),(163,196),(138,196),(133,193),(133,180),(137,161),(130,148),(120,134),(111,149),(100,163),(94,177),(81,188),(79,192),(87,197),(85,200),(64,199),(62,195),(65,188),(68,179),(76,164),(82,150),(90,136),(88,127),(82,137),(79,129),(83,114),(83,105),(78,107),(73,116),(67,112),(66,101),(70,93),(71,80),(73,70),(76,58),(77,49),(81,40),(90,34),(103,31),(112,25),(115,18),(120,13)],
    "knight": [(127,7),(141,5),(150,12),(149,20),(143,27),(146,31),(140,38),(137,48),(145,58),(152,40),(164,48),(181,61),(184,79),(181,98),(175,119),(160,137),(163,144),(184,162),(193,181),(151,161),(151,175),(150,186),(166,190),(176,196),(148,197),(140,195),(138,184),(139,172),(134,155),(127,150),(110,168),(96,179),(85,190),(86,194),(94,197),(86,199),(67,198),(67,189),(75,175),(83,157),(87,150),(77,159),(65,167),(52,174),(51,166),(41,173),(37,167),(24,160),(27,154),(18,151),(20,145),(16,146),(31,125),(50,105),(65,88),(77,75),(80,60),(85,49),(91,43),(102,34),(115,32),(119,22)],
    "assassin": [(126,6),(141,5),(152,10),(155,18),(148,25),(151,31),(144,37),(143,46),(151,63),(164,73),(178,77),(183,91),(182,107),(174,116),(163,117),(152,111),(145,110),(151,126),(164,137),(166,149),(162,163),(162,178),(164,188),(180,193),(181,198),(158,198),(150,196),(149,183),(149,170),(144,155),(135,145),(125,136),(111,147),(103,160),(91,172),(84,184),(83,194),(85,199),(66,199),(67,190),(73,177),(78,161),(87,146),(100,132),(102,121),(94,127),(90,124),(87,114),(81,108),(79,111),(72,109),(68,103),(71,98),(70,92),(78,82),(83,67),(89,57),(96,50),(94,46),(103,40),(118,35),(122,22)],
    "mage": [(130,6),(145,3),(158,9),(151,16),(152,25),(146,36),(149,48),(156,69),(158,88),(165,92),(176,81),(185,68),(194,54),(198,44),(193,42),(199,35),(203,30),(212,25),(219,24),(224,29),(220,38),(209,49),(205,49),(198,58),(188,77),(179,89),(172,98),(167,101),(157,108),(166,116),(173,126),(178,143),(177,160),(166,155),(172,176),(179,186),(189,193),(193,198),(163,198),(157,194),(155,183),(155,170),(150,162),(142,166),(140,171),(132,168),(124,174),(114,165),(112,169),(109,165),(104,177),(94,186),(92,193),(88,199),(73,199),(70,194),(76,183),(81,169),(77,174),(72,168),(64,174),(59,168),(53,173),(49,166),(47,158),(43,162),(41,157),(44,143),(49,135),(62,117),(69,111),(80,89),(85,81),(84,72),(88,60),(91,59),(83,59),(89,48),(99,43),(104,36),(118,29),(126,24),(124,16)],
    "cleric": [(127,4),(141,3),(154,9),(159,17),(152,25),(154,35),(148,43),(155,52),(157,68),(165,79),(181,62),(194,60),(202,73),(209,83),(189,103),(177,111),(165,108),(154,102),(159,120),(161,130),(168,130),(176,132),(180,148),(185,170),(174,168),(178,182),(186,190),(198,195),(198,199),(169,199),(164,195),(158,180),(155,174),(148,178),(143,174),(140,180),(134,177),(130,185),(124,183),(117,178),(110,181),(106,175),(103,179),(94,176),(89,185),(90,192),(93,197),(87,199),(74,198),(74,192),(80,178),(86,169),(80,171),(76,165),(78,154),(90,132),(99,120),(98,114),(88,115),(79,111),(69,107),(70,102),(80,105),(81,98),(83,86),(87,77),(90,69),(86,70),(83,65),(91,58),(99,49),(99,45),(109,40),(119,29),(121,19)],
    "wretch": [(128,6),(140,4),(149,10),(150,18),(145,25),(147,30),(141,38),(139,49),(143,71),(154,72),(166,70),(180,70),(189,75),(199,87),(205,101),(205,117),(199,133),(187,141),(173,143),(163,137),(165,149),(162,165),(158,182),(160,190),(171,194),(176,199),(149,200),(142,197),(141,185),(145,165),(137,150),(130,143),(119,152),(109,166),(97,175),(85,188),(83,193),(84,199),(65,200),(65,194),(70,184),(78,168),(88,151),(93,137),(91,125),(85,120),(76,115),(67,111),(53,106),(54,100),(68,103),(73,94),(77,89),(81,76),(84,63),(87,58),(91,45),(103,34),(115,28),(120,17)],
}

def silhouette_mask(points, width, height):
    yy, xx = np.mgrid[0:height*2, 0:width*2] / 2 + 0.25
    inside = np.zeros(xx.shape, dtype=bool)
    for a, b in zip(points, points[1:] + points[:1]):
        x1, y1 = a; x2, y2 = b
        crossing = ((y1 > yy) != (y2 > yy)) & (xx < (x2-x1)*(yy-y1)/(y2-y1 if y2 != y1 else 1e-9) + x1)
        inside ^= crossing
    return inside.reshape(height, 2, width, 2).mean(axis=(1,3)).astype(np.float32)

def save_image(name, rgba, path):
    h, w = rgba.shape[:2]
    image = bpy.data.images.new(name, width=w, height=h, alpha=True)
    image.colorspace_settings.name = "sRGB"
    image.pixels.foreach_set(np.ascontiguousarray(rgba[::-1]).ravel())
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    return image

def extract(name, region):
    left, right, center = region
    # Header and grid lines stay outside the crop; floor shadows below feet are excluded.
    crop = poster[73:273, left:right].copy()
    save_image(name + "_reference", crop, WORK / (name + "_reference.png"))
    rgb = crop[:, :, :3]
    h, w = rgb.shape[:2]
    edge_left = np.median(rgb[:, 2:16], axis=1)
    edge_right = np.median(rgb[:, -16:-2], axis=1)
    t = np.linspace(0, 1, w)[None, :, None]
    background = edge_left[:, None, :] * (1-t) + edge_right[:, None, :] * t
    residual = np.max(np.abs(rgb - background), axis=2)
    allowed = residual < 0.045
    reached = np.zeros((h, w), dtype=bool)
    queue = deque()
    for y in range(h):
        for x in (0, w-1):
            if allowed[y, x]: reached[y, x] = True; queue.append((y, x))
    for x in range(w):
        for y in (0, h-1):
            if allowed[y, x] and not reached[y, x]: reached[y, x] = True; queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for yy, xx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if 0 <= yy < h and 0 <= xx < w and allowed[yy, xx] and not reached[yy, xx]:
                reached[yy, xx] = True
                queue.append((yy, xx))
    mask = ~reached
    # Remove isolated poster noise, while retaining cape, book and weapon components.
    seen = np.zeros_like(mask)
    retained = np.zeros_like(mask)
    for y, x in zip(*np.where(mask)):
        if seen[y, x]: continue
        component = [(y, x)]
        seen[y, x] = True
        q = deque(component)
        while q:
            yy, xx = q.popleft()
            for sy, sx in ((yy-1,xx),(yy+1,xx),(yy,xx-1),(yy,xx+1)):
                if 0 <= sy < h and 0 <= sx < w and mask[sy,sx] and not seen[sy,sx]:
                    seen[sy,sx] = True; q.append((sy,sx)); component.append((sy,sx))
        if len(component) >= 10:
            for yy, xx in component: retained[yy,xx] = True
    interior = retained.copy()
    interior[1:] &= retained[:-1]
    interior[:-1] &= retained[1:]
    interior[:,1:] &= retained[:,:-1]
    interior[:,:-1] &= retained[:,1:]
    alpha = silhouette_mask(SILHOUETTES[name], w, h)
    if cv2 is not None:
        # Refine the hand reviewed outline with a foreground/background graph.
        # Interior seeds keep low-contrast clothing; outside seeds remove gray halos.
        foreground = (alpha > 0.5).astype(np.uint8)
        sure_fg = cv2.erode(foreground, np.ones((7,7),np.uint8))
        possible = cv2.dilate(foreground, np.ones((5,5),np.uint8))
        labels = np.full((h,w),cv2.GC_BGD,dtype=np.uint8)
        labels[possible != 0] = cv2.GC_PR_BGD
        labels[foreground != 0] = cv2.GC_PR_FGD
        labels[sure_fg != 0] = cv2.GC_FGD
        if name == "mage":
            cv2.line(labels,(168,94),(218,29),int(cv2.GC_FGD),2)
        cv2.setRNGSeed(7)
        cv2.grabCut(np.uint8(np.clip(rgb,0,1)*255), labels, None,
            np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),5,cv2.GC_INIT_WITH_MASK)
        alpha = np.isin(labels,[cv2.GC_FGD,cv2.GC_PR_FGD]).astype(np.float32)
        # Keep original boundary coverage only at edges accepted by the graph.
        alpha = cv2.GaussianBlur(alpha,(3,3),0.45)
        print("CHARACTER_MATTE_REFINED",name,flush=True)
    edge = (alpha > 0) & (alpha < 1)
    clean = rgb.copy()
    clean[edge] = np.clip((rgb[edge] - (1-alpha[edge,None])*background[edge]) / np.maximum(alpha[edge,None], 0.3), 0, 1)
    crop[:, :, :3] = clean
    crop[:, :, 3] = alpha
    crop[alpha == 0, :3] = 0
    image = save_image(name, crop, WORK / (name + "_cutout.png"))
    print("CHARACTER_EXTRACT", name, "foreground_pixels", int(retained.sum()), flush=True)
    return image, crop, center, left

extracted = {name: extract(name, rect) for name, rect in SKINS.items()}
if "--extract-only" in sys.argv:
    print("CHARACTER_EXTRACTION_COMPLETE", str(WORK), flush=True)
    raise SystemExit(0)

# Source-color refinement is restricted to the traced silhouette boundary.
# Interior gray clothing remains opaque, independent of its background similarity.
for name, (image, rgba, center, left) in extracted.items():
    solid = rgba[:,:,3] > 0.9
    interior = solid.copy()
    for _ in range(3):
        old = interior.copy()
        interior[1:] &= old[:-1]; interior[:-1] &= old[1:]
        interior[:,1:] &= old[:,:-1]; interior[:,:-1] &= old[:,1:]
    band = (rgba[:,:,3] > 0) & ~interior
    rgb = poster[73:273,left:SKINS[name][1],:3]
    bg_l = np.median(rgb[:,2:16], axis=1)[:,None,:]
    bg_r = np.median(rgb[:,-16:-2], axis=1)[:,None,:]
    t = np.linspace(0,1,rgb.shape[1])[None,:,None]
    residual = np.max(np.abs(rgb-(bg_l*(1-t)+bg_r*t)), axis=2)
    rgba[band,3] *= np.clip((residual[band]-0.025)/0.06,0,1)
    image.pixels.foreach_set(np.ascontiguousarray(rgba[::-1]).ravel())
    image.save()

CLIPS = {
    "idle": (8, 8, True), "walk": (8, 12, True), "run": (10, 16, True),
    "jump": (4, 20, False), "fall": (4, 12, True), "land": (4, 30, False),
    "light": (13, 13/0.51, False), "heavy": (20, 20/0.84, False),
    "bash": (12, 12/0.69, False), "guard": (4, 6, True),
    "parry": (6, 24, False), "dodge": (8, 40, False),
    "hurt": (4, 20, False), "stagger": (6, 6, False), "death": (10, 12, False),
    "drink": (8, 20, False), "cast": (8, 24, False), "prayer": (8, 8, True),
}
TOTAL = sum(v[0] for v in CLIPS.values())

def pose_parameters(clip, t):
    angles = {}
    lift = 0.0
    def set_angle(bone, degrees): angles[bone] = math.radians(degrees)
    cycle = t * math.tau
    if clip in ("idle", "guard", "prayer"):
        set_angle("spine", math.sin(cycle)*1.3)
        set_angle("head", -math.sin(cycle)*0.8)
        set_angle("upper_near", math.sin(cycle+1)*2)
        set_angle("fore_near", math.sin(cycle)*1.5)
        if clip == "guard":
            set_angle("upper_far", -38); set_angle("fore_far", -30)
        if clip == "prayer":
            set_angle("upper_near", -22); set_angle("fore_near", -65)
            set_angle("head", -10 + math.sin(cycle))
    elif clip in ("walk", "run"):
        amplitude = 24 if clip == "walk" else 39
        set_angle("thigh_near", math.sin(cycle)*amplitude)
        set_angle("thigh_far", -math.sin(cycle)*amplitude)
        set_angle("shin_near", max(0,math.cos(cycle))*28)
        set_angle("shin_far", max(0,-math.cos(cycle))*28)
        set_angle("upper_near", -math.sin(cycle)*16)
        set_angle("upper_far", math.sin(cycle)*14)
        set_angle("fore_near", -10 - max(0,math.sin(cycle))*10)
        set_angle("spine", 5 if clip == "walk" else 12)
        set_angle("head", -3 if clip == "walk" else -7)
        lift = abs(math.cos(cycle))*0.04
    elif clip in ("jump", "fall", "land"):
        bend = math.sin(t*math.pi) if clip != "fall" else 0.6 + math.sin(cycle)*0.08
        set_angle("thigh_near", -18*bend); set_angle("shin_near", 38*bend)
        set_angle("thigh_far", 20*bend); set_angle("shin_far", 24*bend)
        set_angle("upper_near", 14*bend); set_angle("upper_far", -12*bend)
        set_angle("spine", 8*bend)
        if clip == "land": set_angle("spine", 18*(1-t)); lift = -0.05*(1-t)
    elif clip in ("light", "heavy", "bash"):
        startup = 0.11/0.51 if clip == "light" else 0.28/0.84 if clip == "heavy" else 0.18/0.69
        active_end = startup + (0.15/0.51 if clip == "light" else 0.18/0.84 if clip == "heavy" else 0.16/0.69)
        if t < startup:
            motion = -math.sin(t/startup*math.pi/2)
        elif t < active_end:
            motion = -1 + 2*math.sin((t-startup)/(active_end-startup)*math.pi/2)
        else:
            motion = math.cos((t-active_end)/(1-active_end)*math.pi/2)
        power = 1.3 if clip == "heavy" else 1
        set_angle("spine", motion*9*power)
        set_angle("head", -motion*4)
        set_angle("upper_near", motion*36*power)
        set_angle("fore_near", motion*32*power)
        set_angle("upper_far", motion*12)
        set_angle("thigh_far", -motion*6)
        if clip == "bash":
            set_angle("upper_far", -35 + motion*20); set_angle("fore_far", -26)
    elif clip == "parry":
        pulse = math.sin(t*math.pi)
        set_angle("upper_far", -55*pulse); set_angle("fore_far", -25*pulse)
        set_angle("spine", -6*pulse)
    elif clip == "dodge":
        pulse = math.sin(t*math.pi)
        set_angle("spine", 34*pulse); set_angle("head", -20*pulse)
        set_angle("thigh_near", -30*pulse); set_angle("shin_near", 50*pulse)
        set_angle("thigh_far", 30*pulse); set_angle("shin_far", 25*pulse)
        lift = -0.05*pulse
    elif clip in ("hurt", "stagger"):
        pulse = math.sin(t*math.pi) if clip == "hurt" else 0.7+math.sin(cycle)*0.1
        set_angle("spine", -13*pulse); set_angle("head", -12*pulse)
        set_angle("upper_near", 15*pulse); set_angle("fore_near", 18*pulse)
        set_angle("thigh_far", 8*pulse)
    elif clip == "death":
        set_angle("root", -min(1,t*1.5)*82)
        set_angle("spine", 15*math.sin(t*math.pi))
        set_angle("upper_near", 30*t)
        set_angle("thigh_far", -20*t)
        lift = 0.05*t
    elif clip == "drink":
        pulse = math.sin(t*math.pi)
        set_angle("upper_near", -70*pulse); set_angle("fore_near", -85*pulse)
        set_angle("head", 9*pulse)
    elif clip == "cast":
        pulse = math.sin(t*math.pi)
        set_angle("upper_far", -55*pulse); set_angle("fore_far", -16*pulse)
        set_angle("spine", 7*pulse); set_angle("head", -3*pulse)
    return angles, lift

def make_rig(name, image, rgba, center):
    scale = (216/194) / 128
    def point(x,y): return Vector(((x-center)*scale, 0, (200-y)*scale))
    c = center
    bone_specs = {
        "root": ((c,200),(c,180),None),
        "spine": ((c,120),(c+1,76),"root"),
        "chest": ((c+1,76),(c+7,46),"spine"),
        "head": ((c+7,46),(c+15,12),"chest"),
        "upper_near": ((c-23,57),(c-37,87),"chest"),
        "fore_near": ((c-37,87),(c-45,110),"upper_near"),
        "upper_far": ((c+12,56),(c+20,85),"chest"),
        "fore_far": ((c+20,85),(c+27,108),"upper_far"),
        "thigh_near": ((c-5,120),(c-24,158),"root"),
        "shin_near": ((c-24,158),(c-51,195),"thigh_near"),
        "thigh_far": ((c+3,120),(c+24,158),"root"),
        "shin_far": ((c+24,158),(c+31,195),"thigh_far"),
    }
    armature = bpy.data.armatures.new(name + "_Skeleton")
    rig = bpy.data.objects.new(name + "_Rig", armature)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone, (head, tail, parent) in bone_specs.items():
        b = armature.edit_bones.new(bone)
        b.head = point(*head); b.tail = point(*tail)
        b.align_roll(Vector((0,-1,0)))
        if parent: b.parent = armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    rig.show_in_front = True
    h,w = rgba.shape[:2]
    xs = list(range(0,w,3)); ys = list(range(0,h,3))
    if xs[-1] != w: xs.append(w)
    if ys[-1] != h: ys.append(h)
    vertices = [point(x,y) for y in ys for x in xs]
    faces = []
    for y in range(len(ys)-1):
        for x in range(len(xs)-1):
            a = y*len(xs)+x
            if rgba[ys[y]:ys[y+1],xs[x]:xs[x+1],3].max(initial=0) < 0.05: continue
            faces.append((a,a+1,a+len(xs)+1,a+len(xs)))
    mesh = bpy.data.meshes.new(name + "_DeformMesh")
    mesh.from_pydata(vertices, [], faces); mesh.update()
    uv = mesh.uv_layers.new(name="PosterUV")
    for polygon in mesh.polygons:
        for loop in polygon.loop_indices:
            v = mesh.loops[loop].vertex_index
            uv.data[loop].uv = (xs[v%len(xs)]/w, 1-ys[v//len(xs)]/h)
    obj = bpy.data.objects.new(name + "_Puppet", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = rig
    groups = {bone: obj.vertex_groups.new(name=bone) for bone in bone_specs}
    segments = {bone: (point(*head),point(*tail)) for bone,(head,tail,_) in bone_specs.items() if bone != "root"}
    for index, p in enumerate(vertices):
        x = xs[index%len(xs)]; y = ys[index//len(xs)]
        weapon_line = {
            "knight": ((84,110),(191,180)), "assassin": ((79,108),(143,174)),
            "mage": ((89,112),(129,148)), "cleric": ((75,108),(129,145)),
            "wretch": ((55,104),(145,154)),
        }.get(name)
        if weapon_line:
            a,b = weapon_line; dx,dy=b[0]-a[0],b[1]-a[1]
            along = max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
            distance = math.hypot(x-a[0]-along*dx,y-a[1]-along*dy)
            if distance < 7:
                groups["fore_near"].add([index],1,"REPLACE")
                continue
        if name == "mage" and x > center+33 and y < 104:
            groups["fore_far"].add([index],1,"REPLACE")
            continue
        distances = []
        for bone,(a,b) in segments.items():
            if y < 116 and "thigh" in bone or y < 140 and "shin" in bone: continue
            if y > 135 and bone in ("chest","head","upper_near","upper_far","fore_far"): continue
            delta = b-a
            q = a + delta * max(0,min(1,(p-a).dot(delta)/delta.length_squared))
            distances.append(((p-q).length,bone))
        distances.sort()
        near = distances[:3]
        weights = [1/(distance+0.045)**4 for distance,bone in near]
        weight_sum = sum(weights)
        for (_,bone), weight in zip(near,weights): groups[bone].add([index],weight/weight_sum,"REPLACE")
    modifier = obj.modifiers.new("PuppetSkinning","ARMATURE")
    modifier.object = rig
    material = bpy.data.materials.new(name + "_PosterMaterial")
    material.use_nodes = True
    nodes = material.node_tree.nodes; nodes.clear()
    tex = nodes.new("ShaderNodeTexImage"); tex.image = image
    tex.interpolation = "Linear"; tex.extension = "CLIP"
    emission = nodes.new("ShaderNodeEmission")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    output = nodes.new("ShaderNodeOutputMaterial")
    links = material.node_tree.links
    links.new(tex.outputs["Color"],emission.inputs["Color"])
    links.new(tex.outputs["Alpha"],mix.inputs[0])
    links.new(transparent.outputs[0],mix.inputs[1]); links.new(emission.outputs[0],mix.inputs[2])
    links.new(mix.outputs[0],output.inputs["Surface"])
    mesh.materials.append(material)
    image.pack()
    return rig,obj

def apply_pose(rig, clip, t):
    angles,lift = pose_parameters(clip,t)
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0,0,angles.get(bone.name,0))
        bone.location = Vector((0,0,0))
    rig.pose.bones["root"].location.y = lift

# Clean factory geometry, retain source image data.
bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)
rigs = {name: make_rig(name, image, rgba, center) for name,(image,rgba,center,left) in extracted.items()}
scene = bpy.context.scene
scene.render.engine = "CYCLES"; scene.cycles.device = "CPU"
scene.cycles.samples = 1; scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
scene.render.resolution_percentage = 100
scene.render.fps = 24
camera_data = bpy.data.cameras.new("SpriteBakeCamera")
camera = bpy.data.objects.new("SpriteBakeCamera",camera_data)
bpy.context.collection.objects.link(camera)
camera.rotation_euler = (math.pi/2,0,0)
camera_data.type = "ORTHO"; camera_data.sensor_fit = "HORIZONTAL"
scene.camera = camera

for name,(rig,obj) in rigs.items():
    rig.animation_data_create()
    for clip,(count,fps,loop) in CLIPS.items():
        action = bpy.data.actions.new(name + "|" + clip)
        action.use_fake_user = True
        rig.animation_data.action = action
        for i in range(count):
            t = i/count if loop else i/max(1,count-1)
            apply_pose(rig,clip,t)
            frame = 1+i
            for bone in rig.pose.bones:
                bone.keyframe_insert("rotation_euler",frame=frame,group=bone.name)
            rig.pose.bones["root"].keyframe_insert("location",frame=frame,group="root")
    rig.animation_data.action = None
    apply_pose(rig,"idle",0)
    rig["source_kind"] = "textured side-view puppet; not a full volumetric character"
    obj.hide_render = name != "prisoner"
camera.location = (0,-20,1.5); camera_data.ortho_scale = 4
scene.render.resolution_x = 512; scene.render.resolution_y = 512
scene.frame_start = 1; scene.frame_end = 20
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / "player_puppets.blend"))

requested = list(rigs)
if "--skins" in sys.argv:
    requested = sys.argv[sys.argv.index("--skins")+1].split(",")

manifest = {"source": "ArtSources/ProductionBrief/charactrers.png", "frame_size": [512,512],
    "anchor": [256,448], "scale": 0.5, "kind": "Blender skinned 2D puppet animation",
    "skins": {}, "limitations": ["Source art is a 1536x1024 poster; detail cannot exceed its source resolution", "Puppet deformation does not reveal hidden body surfaces", "Origin skins contain the pictured starting equipment, not all 27 weapon appearances"]}
if "--skins" in sys.argv and (ROOT/"data/player_animations.json").exists():
    manifest["skins"] = json.loads((ROOT/"data/player_animations.json").read_text(encoding="utf-8"))["skins"]
for name in requested:
    rig,obj = rigs[name]
    for other,(other_rig,other_obj) in rigs.items(): other_obj.hide_render = True
    atlas_collection = bpy.data.collections.new("Bake_"+name); scene.collection.children.link(atlas_collection)
    samples = []
    print("CHARACTER_BAKE_START",name,TOTAL,"frames",flush=True)
    for clip,(count,fps,loop) in CLIPS.items():
        for index in range(count):
            t = index/count if loop else index/max(1,count-1)
            apply_pose(rig,clip,t)
            bpy.context.view_layer.update()
            evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=bpy.context.evaluated_depsgraph_get())
            pose_obj = bpy.data.objects.new(clip+f"_{index:03d}",mesh)
            atlas_collection.objects.link(pose_obj)
            slot = len(samples); col = slot%8; row = slot//8
            pose_obj.location = (col*4,0,-row*4)
            pose_obj.hide_render = False
            samples.append({"clip":clip,"index":index,"slot":slot})
    rows = math.ceil(TOTAL/8)
    scene.render.resolution_x = 4096; scene.render.resolution_y = rows*512
    camera_data.ortho_scale = 32
    camera.location = (14,-20,3.5-rows*2)
    bpy.ops.render.render()
    # RenderResult API availability differs by Blender version; saving/reloading
    # also makes the output color-managed exactly like the shipped PNG.
    temp_path = WORK / (name+"_full_bake.png")
    bpy.data.images["Render Result"].save_render(str(temp_path),scene=scene)
    render = bpy.data.images.load(str(temp_path),check_existing=False)
    pixels = np.empty(render.size[0]*render.size[1]*4,dtype=np.float32)
    render.pixels.foreach_get(pixels)
    pixels = pixels.reshape(render.size[1],render.size[0],4)[::-1]
    packed = []; cursor_x=2; cursor_y=2; row_h=0
    skin = {"atlas":f"res://assets/characters/player/{name}_atlas.png","clips":{}}
    for sample in samples:
        slot = sample["slot"]; sy=(slot//8)*512; sx=(slot%8)*512
        frame = pixels[sy:sy+512,sx:sx+512].copy()
        yy,xx = np.where(frame[:,:,3]>0.02)
        assert len(xx)>50,(name,sample,"empty frame")
        x0,x1=max(0,int(xx.min())-2),min(512,int(xx.max())+3)
        y0,y1=max(0,int(yy.min())-2),min(512,int(yy.max())+3)
        # Grounded clips use a common contact baseline; jump/fall retain tuck poses.
        shift = 0
        if sample["clip"] not in ("jump","fall"):
            shift = 448-(int(yy.max())+1)
        crop = frame[y0:y1,x0:x1]
        h,w = crop.shape[:2]
        if cursor_x+w+2>2048: cursor_x=2; cursor_y+=row_h+4; row_h=0
        region=[cursor_x,cursor_y,w,h]
        packed.append((region,crop))
        clip_meta = skin["clips"].setdefault(sample["clip"],{"fps":CLIPS[sample["clip"]][1],"loop":CLIPS[sample["clip"]][2],"frames":[]})
        clip_meta["frames"].append({"region":region,"margin":[x0,y0+shift,512-w,512-h]})
        if sample["clip"] in ("idle","run","heavy") and sample["index"] == 0:
            save_image(name+"_"+sample["clip"]+"_preview",frame,WORK/(name+"_"+sample["clip"]+"_preview.png"))
        cursor_x+=w+4; row_h=max(row_h,h)
    atlas_h = cursor_y+row_h+2
    atlas = np.zeros((atlas_h,2048,4),dtype=np.float32)
    for (x,y,w,h),crop in packed: atlas[y:y+h,x:x+w]=crop
    save_image(name+"_Atlas",atlas,OUT/(name+"_atlas.png"))
    manifest["skins"][name] = skin
    bpy.data.images.remove(render)
    for pose_obj in list(atlas_collection.objects):
        mesh=pose_obj.data; bpy.data.objects.remove(pose_obj,do_unlink=True); bpy.data.meshes.remove(mesh)
    bpy.data.collections.remove(atlas_collection)
    print("CHARACTER_BAKE_COMPLETE",name,2048,atlas_h,flush=True)
    del pixels,atlas,packed
(ROOT/"data/player_animations.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
print("CHARACTER_PIPELINE_COMPLETE",str(OUT),flush=True)
