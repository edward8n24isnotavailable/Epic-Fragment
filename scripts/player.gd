class_name FragmentPlayer
extends CharacterBody2D

const ATTACKS = {
	"light": {"cost": 14, "startup": 0.11, "active": 0.15, "recovery": 0.25, "damage": 25, "reach": 1.35, "poise": 8},
	"heavy": {"cost": 24, "startup": 0.28, "active": 0.18, "recovery": 0.38, "damage": 40, "reach": 1.55, "poise": 20},
	"shieldBash": {"cost": 16, "startup": 0.18, "active": 0.16, "recovery": 0.35, "damage": 12, "reach": 1.05, "poise": 12},
}
var game
var health = 350.0
var stamina = 90.0
var fp = 50.0
var flasks = 3
var facing = 1
var coyote = 0.0
var jump_buffer = 0.0
var air_jumps = 0
var stamina_delay = 0.0
var attack_phase = "idle"
var attack_kind = "light"
var attack_time = 0.0
var attack_airborne = false
var attack_multiplier = 1.0
var hit_targets: Array = []
var defense = "idle"
var defense_time = 0.0
var defense_cooldown = 0.0
var dodge_direction = 1
var counter_remaining = 0.0
var dodge_attack_remaining = 0.0
var radiant_remaining = 0.0
var sight_remaining = 0.0
var magic_guard_remaining = 0.0
var skill_cooldown = 0.0
var prayer_active = false
var prayer_sequence = ""
var effect_remaining = 0.0

func refill() -> void:
	health = 350
	stamina = 90
	fp = game.state.max_fp()
	flasks = game.state.max_flasks
	clear_transients()

func clear_transients() -> void:
	velocity = Vector2.ZERO
	attack_phase = "idle"
	defense = "idle"
	defense_time = 0
	defense_cooldown = 0
	stamina_delay = 0
	air_jumps = 0
	jump_buffer = 0
	coyote = 0
	counter_remaining = 0
	dodge_attack_remaining = 0
	radiant_remaining = 0
	sight_remaining = 0
	magic_guard_remaining = 0
	skill_cooldown = 0
	prayer_active = false
	prayer_sequence = ""
	$Sprite.reset_visual()

func _unhandled_input(event: InputEvent) -> void:
	if not prayer_active or not event is InputEventKey or not event.pressed or event.echo:
		return
	var key = {KEY_W: "W", KEY_A: "A", KEY_S: "S", KEY_D: "D"}.get(event.physical_keycode, "")
	if key != "" and prayer_sequence.length() < 4:
		prayer_sequence += key
		game.message = "祷言：%s；松开 L 施放。" % prayer_sequence
		get_viewport().set_input_as_handled()

func _physics_process(dt: float) -> void:
	if health <= 0:
		velocity = Vector2.ZERO
		$Sprite.update_from_player(self, dt)
		queue_redraw()
		return
	var direction = Input.get_axis("move_left", "move_right")
	var sprinting = absf(direction) > 0.1 and Input.is_action_pressed("sprint") and stamina > 0 and is_on_floor()
	for timer in ["counter_remaining", "dodge_attack_remaining", "radiant_remaining", "sight_remaining", "magic_guard_remaining", "skill_cooldown", "effect_remaining", "defense_cooldown"]:
		set(timer, maxf(0, float(get(timer)) - dt))
	_step_defense(dt)
	if Input.is_action_just_pressed("skill") and can_act():
		if sprinting and stamina >= 20:
			stamina -= 20
			stamina_delay = 0.4
			_start_dodge(int(signf(direction)))
		else:
			activate_skill()
	if prayer_active and Input.is_action_just_released("skill"):
		finish_prayer()
	if Input.is_action_just_pressed("flask") and flasks > 0 and health < 350 and game.state.flags.equipmentRecovered:
		flasks -= 1
		health = minf(350, health + 140)
		game.message = "原素瓶回复 40% 生命。"
		$Sprite.trigger_action("drink", 0.4)
	if Input.is_action_just_pressed("grip") and can_act() and game.state.flags.equipmentRecovered:
		game.state.equipment.twoHanded = not game.state.equipment.twoHanded
		magic_guard_remaining = 0
		game.hud.rebuild_equipment()
	if not prayer_active:
		if Input.is_action_just_pressed("shield_bash") and game.state.active_skill() == "shield":
			start_attack("shieldBash")
		elif Input.is_action_just_pressed("heavy"):
			start_attack("heavy")
		elif Input.is_action_just_pressed("light"):
			start_attack("light")
	if prayer_active or defense == "stagger":
		direction = 0
	if direction != 0 and defense != "dodge":
		facing = int(signf(direction))
	coyote = 0.1 if is_on_floor() else maxf(0, coyote - dt)
	jump_buffer = 0.12 if Input.is_action_just_pressed("jump") and not prayer_active else maxf(0, jump_buffer - dt)
	if is_on_floor():
		air_jumps = 1 if game.state.flags.doubleJump else 0
	if defense not in ["dodge", "stagger"] and not prayer_active:
		if jump_buffer > 0 and coyote > 0:
			velocity.y = -10.5 * FragmentData.UNIT
			coyote = 0
			jump_buffer = 0
		elif Input.is_action_just_pressed("jump") and not is_on_floor() and air_jumps > 0:
			velocity.y = -10.5 * FragmentData.UNIT
			air_jumps -= 1
			jump_buffer = 0
	velocity.y += 27 * FragmentData.UNIT * dt
	var target_speed = direction * 6 * FragmentData.UNIT * (1.5 if sprinting else 1.0)
	if defense == "dodge":
		velocity.x = dodge_direction * (14 if game.state.flags.dash else 10) * FragmentData.UNIT
	else:
		var acceleration = 38 if direction == 0 else 42 if is_on_floor() else 23
		velocity.x = move_toward(velocity.x, target_speed, acceleration * FragmentData.UNIT * dt)
	move_and_slide()
	var surfaces: Array = FragmentData.load_catalog().surfaces[game.zone]
	var bounds_min: float = surfaces.map(func(surface): return float(surface.minX)).min()
	var bounds_max: float = surfaces.map(func(surface): return float(surface.maxX)).max()
	position.x = clampf(position.x, (bounds_min + 0.32) * FragmentData.UNIT,
		(bounds_max - 0.32) * FragmentData.UNIT)
	_step_attack(dt)
	if sprinting and not prayer_active:
		stamina = maxf(0, stamina - 10 * dt)
		stamina_delay = 0.4
	else:
		stamina_delay = maxf(0, stamina_delay - dt)
	if stamina_delay == 0:
		stamina = minf(90, stamina + 45 * dt)
	$Sprite.flip_h = facing < 0
	$Sprite.update_from_player(self, dt)
	queue_redraw()

func can_act() -> bool:
	return health > 0 and attack_phase == "idle" and defense == "idle" and not prayer_active

func start_attack(kind: String) -> bool:
	if health <= 0 or prayer_active or attack_phase != "idle" or defense in ["parry", "dodge", "stagger"] or stamina < ATTACKS[kind].cost:
		return false
	attack_kind = kind
	attack_phase = "startup"
	attack_time = 0
	attack_airborne = not is_on_floor()
	attack_multiplier = (0.8 if counter_remaining > 0 else 0.9 if dodge_attack_remaining > 0 else 1.0) if kind == "light" else 1.0
	counter_remaining = 0
	dodge_attack_remaining = 0
	hit_targets.clear()
	defense = "idle"
	stamina -= ATTACKS[kind].cost
	stamina_delay = 0.4
	return true

func _step_attack(dt: float) -> void:
	if attack_phase == "idle":
		return
	attack_time += dt
	var definition: Dictionary = ATTACKS[attack_kind]
	if attack_time >= definition[attack_phase]:
		attack_time -= definition[attack_phase]
		attack_phase = "active" if attack_phase == "startup" else "recovery" if attack_phase == "active" else "idle"
	if attack_phase == "active":
		var reach = attack_reach()
		var damage = float(definition.damage) * attack_multiplier
		if attack_kind != "shieldBash":
			damage *= game.state.power() * (1.2 if radiant_remaining > 0 else 1.0)
		for enemy in game.enemies:
			if not enemy.visible or enemy.health <= 0 or enemy.id in hit_targets:
				continue
			var distance = facing * (enemy.position.x - position.x) / FragmentData.UNIT
			var vertical = (enemy.position.y - position.y) / FragmentData.UNIT
			if distance >= -0.1 and distance <= reach + 0.8 and vertical > -1.7 and vertical < 1.3:
				hit_targets.append(enemy.id)
				var poise = 15 if attack_kind == "heavy" and attack_airborne else definition.poise
				enemy.take_hit(damage * (1 if enemy.id == "soldier" else 2), poise, attack_kind != "shieldBash")

func attack_reach() -> float:
	var weapon_reach = float(FragmentData.load_catalog().weapons[game.state.equipment.mainHand].reach) if game.state.flags.equipmentRecovered else 1.0
	return weapon_reach * float(ATTACKS[attack_kind].reach) / 1.35

func attack_visual_extent() -> float:
	# Same horizontal extent as the enemy-origin hit test, including its body allowance.
	return (attack_reach() + 0.8) * FragmentData.UNIT

func _start_dodge(direction: int) -> void:
	defense = "dodge"
	defense_time = 0
	defense_cooldown = 0.5
	dodge_direction = direction

func _step_defense(dt: float) -> void:
	defense_time += dt
	if defense == "stagger" and defense_time >= 1:
		defense = "idle"
	elif defense == "dodge" and defense_time >= 0.2:
		defense = "idle"
		dodge_attack_remaining = 0.2
	elif defense == "parry" and defense_time >= 0.25:
		defense = "guard" if Input.is_action_pressed("skill") else "idle"
		defense_time = 0
	elif defense == "guard" and (not Input.is_action_pressed("skill") or (game.state.active_skill() != "shield" and magic_guard_remaining <= 0)):
		defense = "idle"
	if defense == "idle" and attack_phase == "idle" and Input.is_action_pressed("skill") and not Input.is_action_just_pressed("skill") and game.state.active_skill() == "shield":
		defense = "guard"

func receive_hit(damage: float, attacker_x: float, attacker = null) -> String:
	if health <= 0:
		return "dead"
	var front = facing * (attacker_x - position.x) > 0
	var shield = game.state.shield()
	var reduction = 0.9 if magic_guard_remaining > 0 else float(shield.reduction)
	if defense == "dodge" and defense_time >= 2.0 / 60 and defense_time <= 6.0 / 60:
		game.message = "闪避成功。"
		return "dodged"
	if front and reduction > 0 and defense == "parry" and defense_time >= 3.0 / 60 and defense_time <= (8.0 + float(shield.parryBonusFrames)) / 60:
		defense = "guard"
		if attacker != null:
			attacker.take_hit(0, 25, false)
			attacker.mode = "recovery"
			attacker.elapsed = 0
		game.message = "弹反成功！削韧 25。"
		return "parried"
	if front and reduction > 0 and defense == "guard":
		stamina_delay = 0.4
		if stamina >= damage * 0.6:
			stamina -= damage * 0.6
			health = maxf(0, health - ceilf(damage * (1 - reduction)))
			counter_remaining = 0.5
			game.message = "格挡成功；0.5 秒内按 J 反击。"
			return "blocked"
		stamina = 0
		defense = "stagger"
		defense_time = 0
		game.message = "精力耗尽，防御被击破。"
	else:
		game.message = "受到 %d 伤害。" % damage
	prayer_active = false
	prayer_sequence = ""
	health = maxf(0, health - damage)
	$Sprite.trigger_hit()
	return "hit"

func activate_skill() -> void:
	var skill = game.state.active_skill()
	if skill == "shield":
		if stamina >= 10:
			stamina -= 10
			stamina_delay = 0.4
			defense = "parry"
			defense_time = 0
		return
	if skill == "prayer":
		prayer_active = true
		prayer_sequence = ""
		game.message = "按住 L：W→S→W 回复；W→A→D 光辉武器；A→D→S 神识。"
		return
	if defense_cooldown > 0 or skill_cooldown > 0:
		return
	if skill in ["none", "catalog"]:
		game.message = "当前武器没有可用战技。"
		return
	var costs = {"soulArrow": 15, "holyGuard": 15, "flurry": 20, "blessing": 20, "daggerStep": 10}
	if fp < costs.get(skill, 0):
		game.message = "FP 不足。"
		return
	if skill == "blessing" and health >= 350:
		return
	fp -= costs[skill]
	skill_cooldown = 0.35
	effect_remaining = 0.3
	match skill:
		"soulArrow":
			game.spawn_soul_arrow()
		"holyGuard":
			magic_guard_remaining = 2
			defense = "guard"
		"blessing":
			health = minf(350, health + 70)
			game.message = "祝福回复 20% 生命。"
		"daggerStep":
			_start_dodge(facing)
		"flurry":
			var reach = float(FragmentData.load_catalog().weapons[game.state.equipment.mainHand].reach) + 0.7
			var target = game.nearest_enemy(reach, true)
			if target != null:
				for strike in range(3):
					target.take_hit(roundf(25 * game.state.power() * 0.7) * (1 if target.id == "soldier" else 2), 8, false)
			game.message = "连续突刺三连击。"

func finish_prayer() -> void:
	prayer_active = false
	var costs = {"WSW": 20, "WAD": 30, "ADS": 15}
	if not costs.has(prayer_sequence):
		game.message = "未匹配祷言。"
		return
	if fp < costs[prayer_sequence] or (prayer_sequence == "WSW" and health >= 350):
		game.message = "FP 不足或生命已满。"
		return
	fp -= costs[prayer_sequence]
	match prayer_sequence:
		"WSW": health = minf(350, health + 105)
		"WAD": radiant_remaining = 60
		"ADS": sight_remaining = 30
	game.message = "祷言生效。"
	prayer_sequence = ""

func _draw() -> void:
	if attack_phase == "active" or (attack_phase == "recovery" and attack_time < 0.09):
		var extent = attack_visual_extent()
		var progress = clampf(attack_time / float(ATTACKS[attack_kind].active), 0, 1) if attack_phase == "active" else 1.0
		var fade = 1.0 if attack_phase == "active" else 1.0 - attack_time / 0.09
		var ribbon = PackedVector2Array()
		var outer = PackedVector2Array()
		var height = 62.0 if attack_kind == "heavy" else 49.0
		for i in range(33):
			var angle = lerpf(-1.35, 1.35, i / 32.0)
			var point = Vector2(facing * extent * cos(angle), -55 + height * sin(angle))
			ribbon.append(point)
			outer.append(point)
		for i in range(32, -1, -1):
			var angle = lerpf(-1.35, 1.35, i / 32.0)
			ribbon.append(Vector2(facing * (extent - 24) * cos(angle), -55 + (height - 13) * sin(angle)))
		draw_colored_polygon(ribbon, Color(1.0, 0.83, 0.46, 0.35 * fade))
		draw_polyline(outer, Color(1.0, 0.94, 0.73, 0.9 * fade), 3, true)
		var sweep_angle = lerpf(-1.15, 1.15, progress)
		draw_line(Vector2(facing * 24, -55), Vector2(facing * extent * cos(sweep_angle), -55 + height * sin(sweep_angle)), Color(1, 0.93, 0.7, 0.8 * fade), 5, true)
	if $Sprite.hit_remaining > 0:
		var fade = $Sprite.hit_remaining / 0.2
		for i in range(7):
			var angle = i * TAU / 7.0
			var direction = Vector2(cos(angle), sin(angle))
			draw_line(Vector2(0, -60) + direction * (23 + (1-fade)*10), Vector2(0, -60) + direction * (35 + (1-fade)*20), Color(1, 0.45, 0.35, fade), 2, true)
	if defense in ["guard", "parry"]:
		draw_line(Vector2(facing * 36, -95), Vector2(facing * 36, -25), Color(0.5, 0.8, 1), 6)
