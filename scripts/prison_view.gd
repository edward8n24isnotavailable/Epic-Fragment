extends Node2D

var game
var wall: Texture2D = preload("res://assets/materials/stone_wall_64x64.png")
var floor_tile: Texture2D = preload("res://assets/materials/stone_floor_64x64.png")
var wet: Texture2D = preload("res://assets/materials/wet_stone_64x64.png")

func _draw() -> void:
	var data = FragmentData.load_catalog()
	var colors = {"blue": Color(0.20, 0.27, 0.34), "amber": Color(0.36, 0.29, 0.23), "red": Color(0.32, 0.21, 0.24)}
	for room in data.rooms:
		if FragmentData.room_at((room.minX + room.maxX) / 2, room.floorY, game.zone).id != room.id:
			continue
		var width = (room.maxX - room.minX) * FragmentData.UNIT
		var start = FragmentData.point(room.minX, room.floorY)
		var height = 245.0 if room.id == "SecondFloor" else 300.0
		draw_texture_rect(wall, Rect2(start - Vector2(0, height), Vector2(width, height)), true, colors[room.accent])
		draw_rect(Rect2(start - Vector2(0, height), Vector2(width, height)), Color(0.015, 0.02, 0.03, 0.38))
		for x in range(int(room.minX) + 1, int(room.maxX), 3):
			var p = FragmentData.point(x, room.floorY)
			draw_rect(Rect2(p - Vector2(14, height), Vector2(28, height)), Color(0.09, 0.10, 0.13, 0.55))
			draw_line(p - Vector2(14, height), p - Vector2(14, 0), Color(0.3, 0.28, 0.25, 0.35), 2)
		draw_string(game.font, start + Vector2(18, -height + 28), room.label, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(0.6, 0.57, 0.51))
	for surface in data.surfaces[game.zone]:
		var width = (surface.maxX - surface.minX) * FragmentData.UNIT
		var p = FragmentData.point(surface.minX, surface.y)
		var height = 18 if surface.get("oneWay", false) else 240
		draw_texture_rect(wet if surface.id == "sewer" else floor_tile, Rect2(p, Vector2(width, height)), true, Color(0.36, 0.38, 0.4))
		draw_line(p, p + Vector2(width, 0), Color(0.61, 0.57, 0.47), 4)
	if game.zone == "prison":
		for x in [-84, -82]:
			for n in range(5):
				var p = FragmentData.point(x + n * 0.17, 0)
				draw_line(p, p - Vector2(0, 165), Color(0.14, 0.19, 0.24), 4)

