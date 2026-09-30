extends SceneTree

var game
var failures: Array = []
var checks = 0

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, description: String) -> void:
	checks += 1
	if not ok:
		failures.append(description)
		push_error("PLAYER_ANIMATION_FAIL: " + description)

func frames(count: int) -> void:
	for i in range(count):
		await physics_frame

func reset_actor() -> void:
	game.travel("prison", -81, 0)
	game.player.refill()
	for enemy in game.enemies:
		enemy.set_physics_process(false)
	await frames(6)

func run() -> void:
	game = load("res://scenes/main.tscn").instantiate()
	game.auto_load = false
	root.add_child(game)
	await reset_actor()
	var visual = game.player.get_node("Sprite")
	check(visual is AnimatedSprite2D and visual.appearance_id == "prisoner", "new prisoner appears before recovering equipment")
	check(game.player.get_node("Collision").shape.size == Vector2(40,108), "original gameplay collision preserved")
	check(visual.sprite_frames.get_frame_texture("idle",0).get_size() == Vector2(512,512), "trimmed atlas retains fixed animation canvas")
	var initial_frame: int = visual.frame
	await frames(20)
	check(visual.frame != initial_frame, "idle advances while physics runs")
	Input.action_press("move_right")
	await frames(25)
	check(visual.visual_clip == "run" and game.player.position.x > -81*64+80, "real movement selects run animation")
	var run_frames: Dictionary = {}
	for i in range(20):
		await frames(1)
		run_frames[visual.frame] = true
	check(run_frames.size() >= 4, "movement visibly cycles through multiple poses")
	Input.action_release("move_right")
	Input.action_press("move_left")
	await frames(15)
	check(visual.flip_h and visual.offset.x == 0, "left-facing flip preserves contact anchor")
	Input.action_release("move_left")
	await reset_actor()
	Input.action_press("jump")
	await frames(3)
	Input.action_release("jump")
	check(visual.visual_clip == "jump", "jump input selects rising pose")
	await frames(26)
	check(visual.visual_clip == "fall", "descent selects falling pose")
	await frames(35)
	check(game.player.is_on_floor() and visual.visual_clip == "idle", "landing returns to idle on actual floor")
	for origin in ["knight","assassin","mage","cleric","wretch"]:
		game.state.flags.equipmentRecovered = false
		game.state.choose_origin(origin)
		game.state.flags.equipmentRecovered = true
		await frames(2)
		check(visual.appearance_id == origin and visual.sprite_frames.get_animation_names().size() == 18, "equipment appearance and clips: " + origin)
	game.state.flags.equipmentRecovered = false
	game.state.choose_origin("knight")
	game.state.flags.equipmentRecovered = true
	await reset_actor()
	Input.action_press("light")
	await frames(9)
	Input.action_release("light")
	check(game.player.attack_phase == "active" and visual.visual_clip == "light" and visual.frame >= 3 and visual.frame <= 6, "light pose matches live hit window")
	check(visual.modulate == Color.WHITE, "attacking keeps character original color")
	check(is_equal_approx(game.player.attack_visual_extent(), (game.player.attack_reach()+0.8)*64), "visible slash follows live horizontal hit reach")
	await frames(30)
	Input.action_press("heavy")
	await frames(19)
	Input.action_release("heavy")
	check(game.player.attack_phase == "active" and visual.visual_clip == "heavy" and visual.frame >= 7 and visual.frame <= 10, "heavy pose matches live hit window")
	await frames(40)
	# Exercise the combat entry point directly: a coroutine's synthetic input edge
	# can expire before the next physics step under --fixed-fps.
	game.player.activate_skill()
	Input.action_press("skill")
	await frames(2)
	check(visual.visual_clip == "parry", "shield input selects parry")
	await frames(18)
	check(visual.visual_clip == "guard", "held shield transitions to guard")
	Input.action_release("skill")
	await frames(3)
	game.player.receive_hit(30,game.player.position.x-100)
	await frames(2)
	check(visual.visual_clip == "hurt", "damage shows hurt pose")
	check(visual.modulate.r > visual.modulate.g * 2, "receiving damage flashes red")
	await frames(14)
	check(visual.modulate == Color.WHITE, "damage flash expires")
	Input.action_press("flask")
	await frames(2)
	Input.action_release("flask")
	check(visual.visual_clip == "drink", "healing shows drink pose")
	await frames(30)
	game.hud.toggle_overlay("pause")
	var paused_clock: float = visual.visual_clock
	await frames(5)
	check(is_equal_approx(paused_clock,visual.visual_clock), "menu pause freezes character animation")
	game.hud.close_overlay()
	game.set_physics_process(false)
	game.player.health = 0
	await frames(55)
	check(visual.visual_clip == "death" and visual.frame == visual.sprite_frames.get_frame_count("death")-1, "death reaches and holds final pose")
	game.queue_free()
	await process_frame
	print("Player animation checks: %d passed, %d failed" % [checks-failures.size(),failures.size()])
	quit(0 if failures.is_empty() else 1)
