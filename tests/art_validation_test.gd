extends SceneTree

var game
var failures: Array = []
var checks = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, description: String) -> void:
	checks += 1
	print("ART_CHECK %s %s" % ["PASS" if ok else "FAIL", description])
	if not ok:
		failures.append(description)

func frames(count: int) -> void:
	for i in range(count):
		await physics_frame

func place(x: float, y: float) -> void:
	game.player.clear_transients()
	game.player.position = FragmentData.point(x, y)
	await frames(5)

func run() -> void:
	game = load("res://scenes/art_validation.tscn").instantiate()
	root.add_child(game)
	await frames(10)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
	check(game.metadata.restored_textures.size() == 9, "nine source textures restored")
	check(game.terrain.get_node("COL_Upper_Left").get_child(0).one_way_collision, "upper deck permits jumping through from below")
	check(game.terrain.get_node_or_null("COL_Stair_Left_Upper") == null, "depth stair does not create a solid 2D wall")
	check(game.player.is_on_floor() and game.player.position.y < -100, "invalid source spawn resolved onto ramp")
	await place(-8, 0)
	check(game.player.is_on_floor() and absf(game.player.position.y) < 1, "feet align to rendered lower floor")
	Input.action_press("move_left")
	await frames(95)
	Input.action_release("move_left")
	await frames(5)
	print("RAMP_POSITION ", game.player.position)
	check(game.player.position.y < -160 and game.player.is_on_floor(), "walk up adapted slope without jumping")
	await place(-15.55, 3.06)
	Input.action_press("jump")
	await frames(1)
	Input.action_release("jump")
	await frames(75)
	print("UPPER_POSITION ", game.player.position)
	check(game.player.is_on_floor() and absf(game.player.position.y + 4.7 * 64) < 2, "single jump connects turn landing to upper deck")
	await place(8, 4.7)
	check(game.player.is_on_floor() and absf(game.player.position.y + 4.7 * 64) < 2, "feet align to rendered upper deck within two pixels")
	await place(-1, 0)
	var resets = game.respawns
	await frames(80)
	check(game.respawns == resets + 1 and game.player.position.x < -300, "pit fall resets onto safe lower floor")
	await place(-4.5, 0)
	Input.action_press("move_right")
	Input.action_press("sprint")
	await frames(20)
	Input.action_press("jump")
	await frames(1)
	Input.action_release("jump")
	await frames(50)
	Input.action_release("move_right")
	Input.action_release("sprint")
	await frames(10)
	print("PIT_JUMP_POSITION ", game.player.position)
	check(game.player.position.x > 160 and game.player.is_on_floor(), "running single jump crosses lower water pit")
	await place(3.2, 0)
	check(game.player.is_on_floor(), "right lower floor supports player")
	game.enemies[0].position = FragmentData.point(4.2, 0)
	game.player.facing = 1
	var old_health = game.enemies[0].health
	game.player.start_attack("light")
	await frames(30)
	check(game.enemies[0].health < old_health, "original 2D melee damages native enemy")
	await place(15, 0)
	Input.action_press("move_right")
	await frames(25)
	Input.action_release("move_right")
	check(game.player.position.x < 1010, "closed door blocks 2D movement")
	check(game.interact(), "nearby interaction opens door")
	await frames(60)
	check(game.door_body.get_child(0).disabled and game.door.position.y < -1000, "door art and collision open together")
	Input.action_press("move_right")
	await frames(30)
	Input.action_release("move_right")
	check(game.player.position.x > 1080, "player crosses opened door")
	check(game.foreground.z_index > game.player.z_index, "foreground cage and chains occlude player")
	check(game.state.checkpoint_active == false and game.state.discovered == ["Cell"], "prototype progression remains isolated")
	game.reset_room()
	await frames(3)
	check(not game.door_open and not game.door_body.get_child(0).disabled and game.enemies[0].health == game.enemies[0].max_health, "room reset restores door and enemy")
	if "--screenshots" in OS.get_cmdline_user_args():
		game.overview = true
		await place(-8, 0)
		await frames(35)
		await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://.godot/art-review/validation-overview.png")
		game.overview = false
		game.debug_collision = true
		await place(-14, 2.4)
		await frames(35)
		await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://.godot/art-review/validation-collision.png")
		game.debug_collision = false
		await frames(5)
		await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("res://.godot/art-review/validation-follow.png")
	print("ART_VALIDATION: %d checks, %d failures" % [checks, failures.size()])
	quit(0 if failures.is_empty() else 1)
