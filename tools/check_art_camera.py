"""Blender background check for the production camera and anchor specifications."""
import math
import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

scene = bpy.context.scene
camera_data = bpy.data.cameras.new("ArtSpecCamera")
camera = bpy.data.objects.new("ArtSpecCamera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
camera.rotation_euler = (math.pi / 2, 0, 0)
camera_data.type = "ORTHO"
scene.render.resolution_percentage = 100

def configure(width, height, scale, fit, location):
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    camera_data.ortho_scale = scale
    camera_data.sensor_fit = fit
    camera.location = location
    bpy.context.view_layer.update()

def pixel(point):
    p = world_to_camera_view(scene, camera, Vector(point))
    return p.x * scene.render.resolution_x, (1-p.y) * scene.render.resolution_y

def check(actual, expected, name):
    assert max(abs(a-b) for a,b in zip(actual, expected)) < 0.01, (name, actual, expected)
    print("ART_CAMERA_PASS", name, actual, flush=True)

configure(512, 512, 4, "HORIZONTAL", (0, -20, 1.5))
check(pixel((0, 0, 0)), (256, 448), "character feet")
check(pixel((0, 0, 1.6875)), (256, 232), "character head")
configure(1024, 512, 8, "HORIZONTAL", (0, -20, 1.5))
check(pixel((0, 0, 0)), (512, 448), "wide attack feet")
configure(2176, 3008, 23.5, "VERTICAL", (11, -43, 5.75))
check(pixel((3, 0, 17)), (64, 64), "room core upper left")
check(pixel((19, 0, -5.5)), (2112, 2944), "room core lower right")
check(pixel((3, 0, 2.5)), (64, 1920), "hall baseline")
