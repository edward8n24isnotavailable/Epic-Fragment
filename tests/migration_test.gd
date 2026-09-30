extends SceneTree

var failures: Array = []
var checks = 0
var game

func _initialize() -> void:
	call_deferred("run")

func check(condition: bool, description: String) -> void:
	checks += 1
	if not condition:
		failures.append(description)
		push_error("FAIL: " + description)

func frames(count: int) -> void:
	for i in range(count):
		await physics_frame

func move_to(zone: String, x: float, y: float = 2.5) -> void:
	game.travel(zone, x, y)
	for enemy in game.enemies:
		enemy.set_physics_process(false)
	await frames(3)

func freeze_enemies() -> void:
	for enemy in game.enemies:
		enemy.set_physics_process(false)

func run() -> void:
	var data = FragmentData.load_catalog()
	check(data.weapons.size() == 27 and data.offhands.size() == 10, "complete authored equipment catalog")
	check(data.fragments.size() == 13 and data.timeNodes.size() == 6, "original fragment IDs and six timeline nodes")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://.godot/migration-tests"))
	game = load("res://scenes/main.tscn").instantiate()
	game.auto_load = false
	game.save_path = "res://.godot/migration-tests/checkpoint.json"
	root.add_child(game)
	await frames(5)
	freeze_enemies()
	check(game.player.is_on_floor() and absf(game.player.position.y) < 1, "native player rests on cell floor")
	check(game.enemies.size() == 10, "all authored encounters instantiated")
	var native_state = FragmentState.new()
	for id in data.origins:
		check(native_state.choose_origin(id) and native_state.max_fp() >= 50, "origin attributes: " + id)
	check(is_equal_approx(FragmentData.weapon_attack("rapier", data.attributes.assassin), 114.0), "original mixed attribute scaling")
	Input.action_press("move_right")
	await frames(35)
	Input.action_release("move_right")
	check(game.player.position.x > -81 * 64 + 130, "native input moves player")
	await move_to("prison", -77.5, 0)
	game.interact()
	check(game.state.flags.equipmentRecovered and game.state.equipment.mainHand == "straightSword", "recover selected origin equipment")
	await move_to("prison", -75, 0)
	game.interact()
	check("dagger" in game.state.owned_weapons(), "cell D dagger is acquired and equippable")
	await move_to("prison", -65, -1.5)
	game.interact()
	check("花木戒指" in game.state.loot, "sewer loot")
	await move_to("prison", -55.5, -0.5)
	game.interact()
	var flask_capacity = game.state.max_flasks
	game.interact()
	check(flask_capacity == 4 and game.state.max_flasks == flask_capacity, "flask pickup cannot duplicate capacity")
	await move_to("prison", -58, -1.5)
	Input.action_press("move_right")
	for i in range(600):
		if i % 44 == 0:
			Input.action_press("jump")
		elif i % 44 == 1:
			Input.action_release("jump")
		await physics_frame
		if game.player.position.x / 64 > -18:
			break
	Input.action_release("move_right")
	Input.action_release("jump")
	check(game.player.position.x / 64 > -18, "native collision permits sewer-to-archive stair route")
	await move_to("prison", -17)
	game.interact()
	check("F01" in game.state.collected, "archive interaction unlocks timeline")
	check(not game.state.select("T1", "F01") and not game.state.select("T1", "F04"), "reject wrong-node and uncollected timeline evidence")
	await move_to("prison", 9)
	game.interact()
	check(game.zone == "prison", "city gate remains closed before altar confirmation")
	await move_to("prison", 16)
	check("F03" in game.state.collected, "F03 is automatically collected on altar approach")
	game.state.select("T0", "F01")
	game.state.select("T1", "F03")
	check(not game.state.flags.exitKnowledge, "selections alone grant no knowledge rewards")
	check(game.confirm_timeline(), "altar writes native checkpoint")
	freeze_enemies()
	check(game.state.flags.exitKnowledge and not game.state.flags.doubleJump, "partial explanation opens city without double jump")
	await move_to("prison", 9)
	game.interact()
	check(game.zone == "city", "confirmed knowledge enables city travel")
	await move_to("city", 75)
	game.interact()
	check("F10" not in game.state.collected, "F10 requires defeated palace guard")
	game.enemy_by_id("palaceGuard").take_hit(1000, 0, false)
	game.interact()
	check("F10" in game.state.collected, "palace corpse investigation gives F10")
	await move_to("prison", 34)
	var inquisitor = game.enemy_by_id("inquisitor")
	inquisitor.take_hit(0, 200, false)
	check(inquisitor.exhausted == 3 and inquisitor.execution_available, "poise break opens three second execution window")
	inquisitor.take_hit(10, 0, true)
	check(inquisitor.health == 380 and not inquisitor.execution_available, "execution is double damage and consumed once")
	inquisitor.take_hit(1000, 0, false)
	check("F05" in game.state.collected and "inquisitor" in game.state.defeated, "inquisitor permanently rewards F05")
	await move_to("prison", 5.5)
	game.interact()
	check("F07" not in game.state.collected, "noticeboard requires perception")
	await move_to("prison", 16)
	game.state.select("T2", "F05")
	game.confirm_timeline()
	freeze_enemies()
	check(game.state.flags.spiritPerception and not game.state.flags.doubleJump, "first three nodes grant prison perception only")
	await move_to("prison", 5.5)
	game.interact()
	check("F07" in game.state.collected, "perception reveals original noticeboard fragment")
	await move_to("prison", 16)
	game.state.select("T3", "F07")
	game.state.select("T4", "F10")
	game.confirm_timeline()
	freeze_enemies()
	check(game.state.flags.doubleJump, "full coup explanation unlocks double jump")
	game.state.select("T4", null)
	game.state.confirm()
	check(game.state.flags.doubleJump, "altar rewards survive timeline revision")
	await move_to("prison", 23.7)
	Input.action_press("jump")
	await frames(1)
	Input.action_release("jump")
	await frames(20)
	Input.action_press("jump")
	await frames(1)
	Input.action_release("jump")
	await frames(65)
	check(-game.player.position.y / 64 > 6.0 and game.player.is_on_floor(), "double jump physically reaches hall upper ledge")
	await move_to("prison", 17.8, 6.1)
	Input.action_press("jump")
	Input.action_press("move_left")
	await frames(1)
	Input.action_release("jump")
	await frames(50)
	Input.action_release("move_left")
	await frames(30)
	check(-game.player.position.y / 64 >= 6.95, "upper ledge connects physically to second floor")
	await move_to("prison", -30, 7)
	game.interact()
	check(game.state.flags.shortcutOpen, "upper interaction permanently lowers shortcut")
	game.interact()
	check(absf(-game.player.position.y / 64 - 2.5) < 0.01, "shortcut permits descent")
	await frames(3)
	game.interact()
	check(absf(-game.player.position.y / 64 - 7) < 0.01, "shortcut permits return ascent")
	game.enemy_by_id("warden").take_hit(1000, 0, false)
	check(game.enemy_by_id("warden").max_poise == 450, "warden phase two poise")
	game.enemy_by_id("warden").take_hit(1000, 0, false)
	check(game.state.flags.wardenKey and "F12" in game.state.collected, "warden yields key and F12")
	await move_to("prison", 42.5)
	game.interact()
	check(game.zone == "detention" and game.state.flags.lockedDoorOpen, "warden key opens detention archive")
	await move_to("detention", 114)
	game.interact()
	check("装备强化材料" in game.state.loot, "detention archive reward")
	await move_to("prison", -32)
	game.player.facing = 1
	var soldier = game.enemy_by_id("soldier")
	var before = soldier.health
	Input.action_press("light")
	await frames(1)
	Input.action_release("light")
	await frames(20)
	check(soldier.health < before and soldier.poise == 42, "J input executes timed native melee and poise damage")
	await frames(20)
	game.player.defense = "guard"
	game.player.stamina = 90
	game.player.health = 350
	check(game.player.receive_hit(40, game.player.position.x + 64) == "blocked" and game.player.health == 343, "kite shield applies original 85 percent reduction and ceil rounding")
	game.player.defense = "parry"
	game.player.defense_time = 0.1
	check(game.player.receive_hit(40, game.player.position.x + 64, soldier) == "parried", "parry timing window")
	game.player.defense = "dodge"
	game.player.defense_time = 0.06
	check(game.player.receive_hit(40, game.player.position.x + 64) == "dodged", "dodge invulnerability window")
	game.player.defense = "idle"
	game.player.health = 200
	game.player.fp = 80
	game.player.prayer_active = true
	game.player.prayer_sequence = "WSW"
	game.player.finish_prayer()
	check(game.player.health == 305 and game.player.fp == 60, "three-key prayer charges FP and heals 30 percent")
	game.player.health = 350
	game.spawn_enemy_projectile(soldier, {"damage": 20, "projectileSpeed": 8})
	for i in range(20):
		game._step_projectiles(1.0 / 60)
	check(game.player.health < 350, "enemy projectiles deal collision damage")
	game.state.equipment.mainHand = "apprenticeStaff"
	game.state.equipment.offHand = null
	game.state.acquired_weapons.append("apprenticeStaff")
	game.player.fp = 80
	game.player.clear_transients()
	var arrow_target_health = soldier.health
	game.player.activate_skill()
	for i in range(20):
		game._step_projectiles(1.0 / 60)
	check(soldier.health < arrow_target_health and game.player.fp == 65, "soul arrow tracks enemy and charges FP")
	await move_to("prison", 16)
	game.state.souls = 321
	game.confirm_timeline()
	freeze_enemies()
	var reloaded = FragmentState.new()
	check(reloaded.load_checkpoint(game.save_path), "native checkpoint roundtrip")
	check(reloaded.souls == 321 and reloaded.flags.doubleJump and reloaded.flags.shortcutOpen and "warden" in reloaded.defeated, "checkpoint retains permanent gameplay state")
	check(game.load_game() and game.enemy_by_id("inquisitor").health == 0 and game.enemy_by_id("soldier").health == 80, "reload retains elite defeats and resets ordinary enemies")
	freeze_enemies()
	var invalid = reloaded.to_save()
	invalid.narrative.selections.T1 = "F01"
	check(not reloaded.apply_save(invalid) and reloaded.souls == 321, "invalid save is rejected without mutating state")
	invalid = reloaded.to_save()
	invalid.progression.drops = [{"x": "invalid", "amount": 1, "kind": "grave"}]
	check(not FragmentState.valid_save(invalid), "malformed soul drops rejected")
	var legacy = reloaded.to_save()
	legacy.erase("engine")
	check(FragmentState.valid_save(legacy), "browser v1 JSON remains importable")
	game.hud.toggle_overlay("timeline")
	check(paused and game.hud.overlay_kind == "timeline", "timeline UI pauses combat")
	game.hud.close_overlay()
	check(not paused, "closing native overlay resumes gameplay")
	await move_to("prison", -17)
	game.player.health = 0
	await frames(100)
	check(game.player.health == 350 and game.state.souls == 0 and game.state.deaths == 1, "death respawns and drops carried souls")
	await frames(4)
	check(game.state.souls == 321 or game.state.drops.any(func(drop): return drop.kind == "grave" and drop.amount == 321), "death souls remain recoverable")
	game.queue_free()
	await process_frame
	print("Godot migration checks: %d passed, %d failed" % [checks - failures.size(), failures.size()])
	quit(0 if failures.is_empty() else 1)
