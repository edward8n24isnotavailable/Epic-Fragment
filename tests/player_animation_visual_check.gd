extends SceneTree
## Captures the real GL game and a pose comparison, without touching checkpoints.

class PoseSheet extends Node2D:
	var frames: SpriteFrames
	func _draw() -> void:
		draw_rect(Rect2(0, 0, 1280, 720), Color(0.08, 0.10, 0.13))
		var samples = [["run", 0], ["run", 2], ["run", 5], ["run", 7], ["idle", 0], ["light", 4], ["heavy", 8], ["hurt", 2]]
		for i in range(samples.size()):
			var x = (i % 4) * 300 + 40
			var y = (i / 4) * 330 + 20
			var texture = frames.get_frame_texture(samples[i][0], samples[i][1])
			draw_texture_rect(texture, Rect2(x, y, 280, 280), false)
			draw_string(ThemeDB.fallback_font, Vector2(x+30, y+300), "%s · frame %d" % samples[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.WHITE)

func _initialize() -> void:
	call_deferred("run")

func snapshot(name: String) -> void:
	for i in range(3):
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://.godot/player-preview/" + name + ".png")

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://.godot/player-preview")
	var game = load("res://scenes/main.tscn").instantiate()
	game.auto_load = false
	root.add_child(game)
	for i in range(15):
		await physics_frame
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
	await snapshot("main-prisoner")
	game.queue_free()
	await process_frame
	var room = load("res://scenes/art_validation.tscn").instantiate()
	root.add_child(room)
	for i in range(15):
		await physics_frame
	room.set_physics_process(false)
	room.player.set_physics_process(false)
	for enemy in room.enemies:
		enemy.set_physics_process(false)
	room.player.position = Vector2(0, 0)
	room.room_camera.position = Vector2(80, -120)
	room.room_camera.zoom = Vector2.ONE
	room.player.facing = 1
	room.player.get_node("Sprite").update_from_player(room.player, 0)
	await snapshot("room-knight")
	room.player.start_attack("heavy")
	room.player.attack_phase = "active"
	room.player.attack_time = 0.07
	room.player.get_node("Sprite").update_from_player(room.player, 0)
	room.player.queue_redraw()
	await snapshot("heavy-range")
	room.player.attack_phase = "idle"
	room.player.receive_hit(30, -100)
	room.player.get_node("Sprite").update_from_player(room.player, 0.03)
	room.player.queue_redraw()
	await snapshot("hurt-red")
	room.queue_free()
	await process_frame
	var sheet = PoseSheet.new()
	sheet.frames = load("res://scripts/player_visual.gd").frames_for("prisoner")
	root.add_child(sheet)
	await snapshot("prisoner-poses")
	sheet.frames = load("res://scripts/player_visual.gd").frames_for("knight")
	sheet.queue_redraw()
	await snapshot("knight-poses")
	print("PLAYER_VISUAL_CAPTURE_OK .godot/player-preview")
	quit()
