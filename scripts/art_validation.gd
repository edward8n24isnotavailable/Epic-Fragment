extends Node2D
## Isolated art/physics validation room. No checkpoint reads or writes.

const PlayerScene = preload("res://scenes/player.tscn")
const EnemyScript = preload("res://scripts/enemy.gd")
var state = FragmentState.new()
var zone = "prison"
var message = "向左上楼；转角跳上高台。右侧门前按 E。"
var player: FragmentPlayer
var enemies: Array = []
var font: SystemFont
var hud
var metadata: Dictionary
var terrain: Node2D
var foreground: Sprite2D
var door: Sprite2D
var door_body: StaticBody2D
var room_camera: Camera2D
var status: Label
var controls: Label
var glows: Array = []
var clock = 0.0
var debug_collision = false
var overview = false
var door_open = false
var paused = false
var respawns = 0
var door_tween: Tween

func _ready() -> void:
	FragmentData.configure_input()
	metadata = JSON.parse_string(FileAccess.get_file_as_string("res://data/prison_matte.json"))
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei", "Arial"])
	hud = self
	state.flags.equipmentRecovered = true
	state.flags.doubleJump = false
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_add_layer("background", -10)
	foreground = _add_layer("foreground", 5)
	door = _add_layer("door", 3)
	terrain = Node2D.new()
	add_child(terrain)
	for collider in metadata.colliders:
		if collider.enabled:
			_add_polygon(collider.name, _points(collider.polygon), collider.get("one_way", false))
	_add_polygon("BoundaryLeft", PackedVector2Array([Vector2(-1290, -900), Vector2(-1248, -900), Vector2(-1248, 250), Vector2(-1290, 250)]))
	_add_polygon("BoundaryRight", PackedVector2Array([Vector2(1222, -900), Vector2(1280, -900), Vector2(1280, 250), Vector2(1222, 250)]))
	door_body = _add_polygon("Door", PackedVector2Array([Vector2(1010, -245), Vector2(1038, -245), Vector2(1038, 0), Vector2(1010, 0)]))
	player = PlayerScene.instantiate()
	player.game = self
	add_child(player)
	player.get_node("Camera").enabled = false
	player.get_node("Sprite").texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	# Snap to the corrected ramp: the supplied spawn is inside its source box.
	reset_player(true)
	var enemy = EnemyScript.new()
	enemy.setup(self, "soldier")
	enemy.definition = enemy.definition.duplicate(true)
	enemy.definition.enemy.spawnX = 7.5
	enemy.definition.minX = 4.0
	enemy.definition.maxX = 14.0
	enemy.definition.floorY = 0
	enemy.position = FragmentData.point(7.5, 0)
	add_child(enemy)
	enemy.sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	enemies.append(enemy)
	room_camera = Camera2D.new()
	room_camera.position = Vector2(player.position.x + 140, player.position.y - 100)
	add_child(room_camera)
	_build_ui()
	_build_glows()
	_update_camera(1.0)

func _points(raw: Array) -> PackedVector2Array:
	var points = PackedVector2Array()
	for p in raw:
		points.append(Vector2(p[0], p[1]))
	return points

func _add_layer(layer: String, depth: int) -> Sprite2D:
	var sprite = Sprite2D.new()
	sprite.texture = load("res://assets/levels/prison_matte/%s.png" % layer)
	sprite.centered = false
	sprite.position = Vector2(metadata.image_origin[0], metadata.image_origin[1])
	sprite.z_index = depth
	add_child(sprite)
	return sprite

func _add_polygon(id: String, points: PackedVector2Array, one_way = false) -> StaticBody2D:
	var body = StaticBody2D.new()
	body.name = id
	body.collision_layer = 1
	body.collision_mask = 0
	var collision = CollisionPolygon2D.new()
	collision.polygon = points
	collision.one_way_collision = one_way
	collision.one_way_collision_margin = 3
	body.add_child(collision)
	terrain.add_child(body)
	return body

func _build_ui() -> void:
	var canvas = CanvasLayer.new()
	add_child(canvas)
	for info in [[0, 66], [648, 72]]:
		var panel = ColorRect.new()
		panel.position.y = info[0]
		panel.size = Vector2(1280, info[1])
		panel.color = Color(0.015, 0.023, 0.032, 0.9)
		panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		canvas.add_child(panel)
	status = Label.new()
	status.position = Vector2(22, 10)
	status.add_theme_font_override("font", font)
	status.add_theme_font_size_override("font_size", 18)
	canvas.add_child(status)
	controls = Label.new()
	controls.position = Vector2(22, 656)
	controls.add_theme_font_override("font", font)
	controls.add_theme_font_size_override("font_size", 16)
	controls.text = "A/D 移动 · 空格跳跃 · Shift 冲刺 · J/K 攻击 · L 盾技 · E 开门 · Backspace 重置\nTab 全景/跟随 · C 碰撞对照（绿=实际 / 紫=源模型） · V 前景 · B 二段跳 · Esc 暂停"
	canvas.add_child(controls)

func _build_glows() -> void:
	var gradient = Gradient.new()
	gradient.colors = PackedColorArray([Color(1, 1, 1, 0.32), Color(1, 1, 1, 0)])
	var texture = GradientTexture2D.new()
	texture.gradient = gradient
	texture.width = 128
	texture.height = 128
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1, 0.5)
	for id in metadata.markers:
		if not ("Torch" in id or "Rune" in id):
			continue
		var glow = Sprite2D.new()
		glow.texture = texture
		glow.position = Vector2(metadata.markers[id][0], metadata.markers[id][1])
		glow.modulate = Color(1, 0.48, 0.13) if "Torch" in id else Color(0.12, 0.7, 1)
		glow.scale = Vector2(1.9, 1.9) if "Torch" in id else Vector2(1.1, 1.1)
		var material = CanvasItemMaterial.new()
		material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		glow.material = material
		glow.z_index = 2
		add_child(glow)
		glows.append(glow)

func reset_player(use_source_spawn = false) -> void:
	player.refill()
	if use_source_spawn:
		var source = metadata.markers.MARK_PlayerStart
		var ramp_y = lerpf(-195.84, 0, (float(source[0]) + 987.2) / 342.4)
		player.position = Vector2(source[0], ramp_y - 4)
	else:
		player.position = FragmentData.point(-8, 0)

func _unhandled_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo:
		return
	match event.physical_keycode:
		KEY_TAB:
			overview = not overview
		KEY_C:
			debug_collision = not debug_collision
		KEY_V:
			foreground.visible = not foreground.visible
		KEY_B:
			state.flags.doubleJump = not state.flags.doubleJump
		KEY_BACKSPACE:
			reset_room()
		KEY_ESCAPE:
			paused = not paused
			player.set_physics_process(not paused)
			for enemy in enemies:
				enemy.set_physics_process(not paused)

func interact() -> bool:
	if absf(player.position.x - 1024) > 150 or absf(player.position.y) > 100 or door_open:
		return false
	door_open = true
	door_body.get_child(0).set_deferred("disabled", true)
	door_tween = create_tween()
	door_tween.tween_property(door, "position:y", door.position.y - 270, 0.8)
	message = "门的画面与二维碰撞同步打开；本房间不写存档。"
	return true

func reset_room() -> void:
	reset_player()
	state.defeated.clear()
	for enemy in enemies:
		enemy.health = enemy.max_health
		enemy.poise = enemy.max_poise
		enemy.mode = "patrol"
		enemy.elapsed = 0
		enemy.exhausted = 0
		enemy.position = FragmentData.point(7.5, 0)
		enemy.velocity = Vector2.ZERO
		enemy.show()
	if door_tween and door_tween.is_valid():
		door_tween.kill()
	door_open = false
	door.position.y = metadata.image_origin[1]
	door_body.get_child(0).set_deferred("disabled", false)
	message = "验证房已重置。向左上楼；转角跳上高台。"

func _physics_process(dt: float) -> void:
	if not paused:
		clock += dt
		if Input.is_action_just_pressed("interact"):
			interact()
		if player.position.y > 180 or player.health <= 0:
			respawns += 1
			reset_player()
			message = "落水或死亡后回到安全地面。"
		for i in range(glows.size()):
			glows[i].self_modulate.a = 0.78 + sin(clock * 7.3 + i * 2.8) * 0.16
	_update_camera(dt)
	status.text = "美术验证房 · Blender 烘焙 / Godot 2D     HP %d   体力 %d   二段跳 %s%s\n%s" % [player.health, player.stamina, "开" if state.flags.doubleJump else "关", "   [暂停]" if paused else "", message]
	queue_redraw()

func _update_camera(dt: float) -> void:
	var desired = Vector2(0, -288) if overview else Vector2(clampf(player.position.x + player.facing * 110, -680, 654), clampf(player.position.y - 100, -350, -120))
	room_camera.position = room_camera.position.lerp(desired, minf(1, dt * 7))
	room_camera.zoom = Vector2.ONE * (0.5 if overview else 1.1)

func _draw() -> void:
	if not is_instance_valid(player):
		return
	# Contact shadow and native animated effects stay separate from the baked art.
	if player.is_on_floor():
		draw_set_transform(player.position, 0, Vector2(1, 0.2))
		draw_circle(Vector2.ZERO, 28, Color(0.01, 0.02, 0.025, 0.45))
		draw_set_transform(Vector2.ZERO)
	for id in metadata.markers:
		var p = Vector2(metadata.markers[id][0], metadata.markers[id][1])
		if "Torch" in id:
			var height = 22 + sin(clock * 12 + p.x) * 5
			draw_colored_polygon(PackedVector2Array([p + Vector2(-7, 7), p + Vector2(-5, -5), p + Vector2(sin(clock * 9) * 4, -height), p + Vector2(7, 2), p + Vector2(4, 9)]), Color(1, 0.42, 0.07, 0.95))
			draw_circle(p, 4, Color(1, 0.86, 0.4))
		elif "Rune" in id:
			draw_polyline(PackedVector2Array([p + Vector2(0, -17), p + Vector2(10, 0), p + Vector2(0, 17), p + Vector2(-10, 0), p + Vector2(0, -17)]), Color(0.15, 0.8, 1, 0.85 + sin(clock * 2) * 0.15), 2, true)
	# The pit is scenery, not a platform. Falling through it resets the player.
	for i in range(18):
		var x = -180 + i * 20
		var y = 35 + sin(clock * 1.7 + i * 0.8) * 2
		draw_line(Vector2(x, y), Vector2(x + 12, y), Color(0.15, 0.47, 0.63, 0.35), 1, true)
	if not debug_collision:
		return
	for collider in metadata.colliders:
		var original = _points(collider.source_polygon)
		original.append(original[0])
		draw_polyline(original, Color(1, 0.3, 0.85, 0.8), 2, true)
		if collider.enabled:
			var playable = _points(collider.polygon)
			draw_colored_polygon(playable, Color(0.1, 1, 0.55, 0.13))
			playable.append(playable[0])
			draw_polyline(playable, Color(0.1, 1, 0.55, 0.95), 2, true)
	for id in metadata.markers:
		var p = Vector2(metadata.markers[id][0], metadata.markers[id][1])
		draw_circle(p, 5, Color(1, 0.85, 0.2))
		draw_string(font, p + Vector2(8, -5), id.trim_prefix("MARK_"), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1, 0.85, 0.2))
	var rect = Rect2(player.position + Vector2(-20, -108), Vector2(40, 108))
	draw_rect(rect, Color(1, 1, 0.3), false, 2)

func rebuild_equipment() -> void:
	message = "双手持握" if state.equipment.twoHanded else "单手持握"

func nearest_enemy(distance: float):
	var nearest = null
	for enemy in enemies:
		if enemy.health > 0 and player.position.distance_to(enemy.position) < distance * FragmentData.UNIT:
			if nearest == null or player.position.distance_to(enemy.position) < player.position.distance_to(nearest.position):
				nearest = enemy
	return nearest

func enemy_defeated(enemy) -> void:
	state.defeated.append(enemy.id)
	message = "原有二维战斗已在烘焙场景中运行。Backspace 回到左侧地面。"
