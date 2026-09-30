extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func snapshot(name: String) -> void:
	for i in range(6):
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://.godot/migration-tests/" + name + ".png")

func run() -> void:
	var game = load("res://scenes/main.tscn").instantiate()
	game.auto_load = false
	root.add_child(game)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.godot/migration-tests"))
	await snapshot("native-cell")
	game.state.flags.equipmentRecovered = true
	for id in ["F01", "F03", "F05", "F07", "F10"]:
		game.state.collect(id)
		game.state.select(FragmentData.fragment(id).timeNodeId, id)
	game.state.confirm()
	game.travel("prison", 16, 2.5)
	game.player.refill()
	game.hud.rebuild_equipment()
	game.hud.refresh()
	await snapshot("native-hall")
	game.state.drops.append({"x": 17, "y": 2.5, "amount": 50, "kind": "enemy", "zone": "prison"})
	game.projectiles.append({"position": FragmentData.point(18, 3.5), "velocity": Vector2.ZERO,
		"damage": 0, "enemy": false, "life": 10, "target": null, "attacker": null})
	await snapshot("native-effects")
	game.projectiles.clear()
	game.state.drops.clear()
	game.hud.toggle_overlay("timeline")
	await snapshot("native-timeline")
	game.hud.close_overlay()
	game.hud.toggle_overlay("catalog")
	await snapshot("native-catalog")
	game.hud.close_overlay()
	game.queue_free()
	await process_frame
	quit()
