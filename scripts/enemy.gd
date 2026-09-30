class_name FragmentEnemy
extends CharacterBody2D

var game
var id = ""
var definition: Dictionary
var health = 80.0
var max_health = 80.0
var poise = 50.0
var max_poise = 50.0
var poise_delay = 0.0
var exhausted = 0.0
var execution_available = false
var phase_two = false
var mode = "patrol"
var elapsed = 0.0
var facing = -1
var attack_index = 0
var active_attack: Dictionary = {}
var hit_player = false
var sprite: Sprite2D
var label: Label
var flash = 0.0

func setup(owner_game, encounter_id: String) -> void:
	game = owner_game
	id = encounter_id
	definition = FragmentData.load_catalog().encounters[id]
	health = definition.health
	max_health = health
	max_poise = definition.enemy.poise.max
	poise = max_poise
	position = FragmentData.point(definition.enemy.spawnX, definition.floorY)
	collision_layer = 4
	collision_mask = 1
	var collision = CollisionShape2D.new()
	var shape = RectangleShape2D.new()
	shape.size = Vector2(50, 108)
	collision.shape = shape
	collision.position.y = -54
	add_child(collision)
	sprite = Sprite2D.new()
	sprite.texture = load("res://assets/characters/ash_soldier_stand_64x96.png")
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.position.y = -58
	sprite.scale = Vector2(1.2, 1.2)
	add_child(sprite)
	label = Label.new()
	label.position = Vector2(-100, -173)
	label.size = Vector2(200, 40)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", game.font)
	label.add_theme_font_size_override("font_size", 14)
	add_child(label)
	if id in game.state.defeated:
		health = 0
		mode = "dead"

func profile() -> Dictionary:
	var second = health < 200 if id == "inquisitor" else health <= 600 if id == "warden" else false
	return FragmentData.load_catalog().profiles[id]["phase2" if second else "normal"]

func _physics_process(dt: float) -> void:
	if not visible or health <= 0 or game.player.health <= 0:
		return
	flash = maxf(0, flash - dt)
	var was_exhausted = exhausted > 0
	exhausted = maxf(0, exhausted - dt)
	if was_exhausted and exhausted == 0:
		poise = max_poise
		execution_available = false
		mode = "patrol"
	else:
		var recover_time = maxf(0, dt - poise_delay)
		poise_delay = maxf(0, poise_delay - dt)
		if exhausted == 0:
			poise = minf(max_poise, poise + recover_time * 10)
	if exhausted > 0:
		_update_art()
		return
	elapsed += dt
	var target = game.player.position
	var dx = (target.x - position.x) / FragmentData.UNIT
	var dy = absf(target.y - position.y) / FragmentData.UNIT
	var config = profile()
	var speed = 0.0
	if mode in ["patrol", "chase"]:
		if absf(dx) < float(config.detectRange) and dy < 2.5:
			facing = 1 if dx >= 0 else -1
			mode = "chase"
			var attacks: Array = config.attacks
			for offset in range(attacks.size()):
				var index = (attack_index + offset) % attacks.size()
				var attack: Dictionary = attacks[index]
				if absf(dx) >= float(attack.get("minimumRange", 0)) and absf(dx) <= float(attack.range) and dy < float(attack.get("verticalRange", 1.3)):
					active_attack = attack
					attack_index = (index + 1) % attacks.size()
					mode = "windup"
					elapsed = 0
					hit_player = false
					break
			if mode == "chase":
				speed = facing * float(config.chaseSpeed)
		else:
			mode = "patrol"
			if position.x <= (float(definition.enemy.spawnX) - 1.2) * FragmentData.UNIT:
				facing = 1
			elif position.x >= (float(definition.enemy.spawnX) + 1.2) * FragmentData.UNIT:
				facing = -1
			speed = facing * 1.1
	elif mode == "windup" and elapsed >= float(active_attack.windup):
		mode = "active"
		elapsed = 0
	elif mode == "active":
		speed = facing * float(active_attack.get("lungeSpeed", 0))
		if not hit_player:
			if active_attack.has("projectileSpeed"):
				game.spawn_enemy_projectile(self, active_attack)
				hit_player = true
			elif absf(dx) <= float(active_attack.range) and dy < float(active_attack.get("verticalRange", 1.3)) and (active_attack.get("allAround", false) or facing * dx > 0) and (not active_attack.get("groundOnly", false) or game.player.is_on_floor()):
				var outcome = game.player.receive_hit(float(active_attack.damage), position.x, self)
				if outcome == "hit":
					game.player.position.x += facing * float(active_attack.get("displacement", 0)) * FragmentData.UNIT
				hit_player = true
		if elapsed >= float(active_attack.active):
			mode = "recovery"
			elapsed = 0
	elif mode == "recovery" and elapsed >= float(active_attack.get("recovery", 0.8)):
		mode = "chase"
		elapsed = 0
	velocity = Vector2(speed * FragmentData.UNIT, velocity.y + 27 * FragmentData.UNIT * dt)
	move_and_slide()
	position.x = clampf(position.x, float(definition.minX) * FragmentData.UNIT, float(definition.maxX) * FragmentData.UNIT)
	_update_art()

func _update_art() -> void:
	sprite.flip_h = facing < 0
	sprite.modulate = Color(1.5, 0.5, 0.3) if mode == "windup" else Color(0.55, 0.75, 1.1) if exhausted > 0 or game.player.sight_remaining > 0 else Color(1.2, 0.7, 0.7) if flash > 0 else Color.WHITE
	sprite.rotation = 0.2 * facing if mode == "active" else 0.0
	label.text = definition.name + (" · 力竭" if exhausted > 0 else "\n" + active_attack.get("name", "") if mode == "windup" else "")
	queue_redraw()

func take_hit(damage: float, poise_damage: float, execution_eligible: bool) -> void:
	if health <= 0:
		return
	if execution_eligible and execution_available:
		damage *= 2
		execution_available = false
		game.message = "处决命中：双倍伤害！"
	health = maxf(0, health - damage)
	flash = 0.15
	if exhausted <= 0 and poise_damage > 0:
		poise = maxf(0, poise - poise_damage)
		poise_delay = 5
		if poise == 0:
			exhausted = 3
			execution_available = true
			game.message = "%s力竭！3 秒内用 J/K 处决。" % definition.name
	if id == "warden" and health <= 600 and health > 0 and not phase_two:
		phase_two = true
		max_poise = 450
		poise = 0 if exhausted > 0 else minf(450, poise + 100)
		game.message = "典狱长进入第二阶段：韧性 450。"
	if health <= 0:
		mode = "dead"
		game.enemy_defeated(self)
		hide()
	_update_art()

func _draw() -> void:
	if health <= 0:
		return
	draw_rect(Rect2(-38, -132, 76, 5), Color(0.15, 0.07, 0.08))
	draw_rect(Rect2(-38, -132, 76 * health / max_health, 5), Color(0.8, 0.24, 0.23))
	draw_rect(Rect2(-38, -124, 76 * poise / max_poise, 3), Color(0.55, 0.7, 0.85))
