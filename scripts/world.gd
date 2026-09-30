extends Node2D

const PlayerScene = preload("res://scenes/player.tscn")
const EnemyScript = preload("res://scripts/enemy.gd")
const HudScript = preload("res://scripts/hud.gd")
const ViewScript = preload("res://scripts/prison_view.gd")
const PERMANENT_ENEMIES = ["corruptedKnight", "inquisitor", "warden", "palaceGuard"]
const INTERACTIONS = [
	["equipment", "prison", -77.5, 0, "没收架", "confiscation_rack"],
	["dagger", "prison", -75, 0, "牢房 D", "cell_d_dagger"],
	["ring", "prison", -65, -1.5, "石桥下方", ""],
	["flask", "prison", -55.5, -0.5, "羽毛与假墙", ""],
	["F01", "prison", -17, 2.5, "政务记录 F01", "archive_cabinet_f01"],
	["highRing", "prison", -8, 6.2, "高台戒指", ""],
	["shortcutTop", "prison", -30, 7, "捷径梯", "ladder"],
	["shortcutBottom", "prison", -30, 2.5, "捷径梯", ""],
	["F07", "prison", 5.5, 2.5, "公告板 F07", "f07_notice_board"],
	["exit", "prison", 9, 2.5, "王城公文通道", "locked_door"],
	["altar", "prison", 16, 2.5, "祭坛 · 时间轴与存档", "altar"],
	["armory", "prison", 21.5, 2.5, "后楼梯", "ladder"],
	["upper", "prison", 23.7, 2.5, "二楼高台", ""],
	["lock", "prison", 42.5, 2.5, "拘押档案夹层锁门", "locked_door"],
	["cityReturn", "city", 52, 2.5, "返回监狱", "locked_door"],
	["F10", "city", 75, 2.5, "封锁令 F10", "archive_cabinet_f01"],
	["armoryReturn", "armory", 92, 2.5, "返回大厅", "ladder"],
	["detentionEntry", "armory", 103, 2.5, "检修通道", "locked_door"],
	["detentionReturn", "detention", 111, 2.5, "军械库通道", "locked_door"],
	["detentionRecord", "detention", 114, 2.5, "拘押名册", "archive_cabinet_f01"],
	["lockReturn", "detention", 118, 2.5, "责难官房", "locked_door"],
]
var state = FragmentState.new()
var zone = "prison"
var message = "向右穿过牢房，取回装备，探索监狱。"
var player: FragmentPlayer
var enemies: Array = []
var scenery: Node2D
var props: Array = []
var terrain: Node2D
var hud
var font: SystemFont
var projectiles: Array = []
var death_remaining = 0.0
var hud_clock = 0.0
var auto_load = true
var save_path = FragmentState.SAVE_PATH

func _ready() -> void:
	if "--art-validation" in OS.get_cmdline_user_args():
		get_tree().change_scene_to_file.call_deferred("res://scenes/art_validation.tscn")
		set_physics_process(false)
		return
	FragmentData.configure_input()
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Microsoft YaHei", "Arial"])
	scenery = ViewScript.new()
	scenery.game = self
	scenery.z_index = -10
	scenery.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(scenery)
	terrain = Node2D.new()
	add_child(terrain)
	player = PlayerScene.instantiate()
	player.game = self
	add_child(player)
	hud = HudScript.new()
	hud.game = self
	add_child(hud)
	if auto_load and state.load_checkpoint(save_path):
		travel("prison", 16, 2.5)
		message = "已载入祭坛存档。"
	else:
		travel("prison", -81, 0)
		if auto_load and FileAccess.file_exists(save_path):
			message = "存档格式无效；从新角色开始，存档文件仍保留。"
	player.refill()
	reset_enemies()
	hud.rebuild_equipment()
	hud.refresh()

func _physics_process(dt: float) -> void:
	if player.health <= 0:
		if death_remaining <= 0:
			state.drops = state.drops.filter(func(drop): return drop.kind != "grave")
			if state.souls > 0:
				state.drops.append({"x": player.position.x / FragmentData.UNIT, "y": -player.position.y / FragmentData.UNIT,
					"amount": state.souls, "kind": "grave", "zone": zone})
			state.souls = 0
			state.deaths += 1
			death_remaining = 1.5
			message = "你倒下了；失去的魂留在原地。"
		else:
			death_remaining -= dt
			if death_remaining <= 0:
				travel("prison", 16 if state.checkpoint_active else -81, 2.5 if state.checkpoint_active else 0)
				player.refill()
				reset_enemies()
				message = "在检查点苏醒。失去的魂可回原地拾取。"
	else:
		if Input.is_action_just_pressed("interact"):
			interact()
		if zone == "prison" and absf(player.position.x / FragmentData.UNIT - 16) <= 1.2 and absf(player.position.y / FragmentData.UNIT + 2.5) < 1:
			if state.collect("F03"):
				message = "到达祭坛，获得 F03 国王死讯公告。按 T 拼时间轴。"
		var current_room = room()
		if current_room.id not in state.discovered:
			state.discovered.append(current_room.id)
		for i in range(state.drops.size() - 1, -1, -1):
			var drop: Dictionary = state.drops[i]
			if drop_zone(drop) == zone and player.position.distance_to(FragmentData.point(drop.x, drop.get("y", 2.5))) < 65:
				state.souls += int(drop.amount)
				state.drops.remove_at(i)
	_step_projectiles(dt)
	hud_clock += dt
	if hud_clock >= 0.1:
		hud_clock = 0
		hud.refresh()
	queue_redraw()

func room() -> Dictionary:
	return FragmentData.room_at(player.position.x / FragmentData.UNIT, -player.position.y / FragmentData.UNIT, zone)

func travel(next_zone: String, x: float, y: float = 2.5) -> void:
	zone = next_zone
	player.position = FragmentData.point(x, y)
	player.clear_transients()
	projectiles.clear()
	player.get_node("Camera").reset_smoothing()
	_build_terrain()
	_build_props()
	for enemy in enemies:
		enemy.visible = ("city" if enemy.id == "palaceGuard" else "prison") == zone and enemy.health > 0
	scenery.queue_redraw()

func _build_terrain() -> void:
	for child in terrain.get_children():
		child.free()
	for surface in FragmentData.load_catalog().surfaces[zone]:
		var body = StaticBody2D.new()
		body.collision_layer = 1
		body.collision_mask = 0
		var collision = CollisionShape2D.new()
		var shape = RectangleShape2D.new()
		var height = 18.0 if surface.get("oneWay", false) else 1000.0
		shape.size = Vector2((surface.maxX - surface.minX) * FragmentData.UNIT, height)
		collision.shape = shape
		collision.position = FragmentData.point((surface.minX + surface.maxX) / 2, surface.y) + Vector2(0, height / 2)
		collision.one_way_collision = surface.get("oneWay", false)
		collision.one_way_collision_margin = 2
		body.add_child(collision)
		terrain.add_child(body)

func _build_props() -> void:
	for prop in props:
		prop.free()
	props.clear()
	for entry in INTERACTIONS:
		if entry[1] != zone:
			continue
		var node = Node2D.new()
		node.position = FragmentData.point(entry[2], entry[3])
		if entry[5] != "":
			var sprite = Sprite2D.new()
			sprite.texture = load("res://assets/props/%s_256.png" % entry[5])
			sprite.scale = Vector2(0.48, 0.48)
			sprite.position.y = -48
			node.add_child(sprite)
		var label = Label.new()
		label.position = Vector2(-120, -140 if entry[5] != "" else -45)
		label.size = Vector2(240, 30)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.text = entry[4]
		label.add_theme_font_override("font", font)
		label.add_theme_font_size_override("font_size", 14)
		label.modulate = Color(0.82, 0.72, 0.5)
		node.add_child(label)
		scenery.add_child(node)
		props.append(node)
	var zone_surfaces: Array = FragmentData.load_catalog().surfaces[zone]
	var min_x: float = zone_surfaces.map(func(surface): return float(surface.minX)).min()
	var max_x: float = zone_surfaces.map(func(surface): return float(surface.maxX)).max()
	for x in range(int(min_x) + 2, int(max_x), 8):
		var tile_room = FragmentData.room_at(x, 0, zone)
		var torch = Sprite2D.new()
		torch.texture = load("res://assets/props/wall_torch_256.png")
		torch.scale = Vector2(0.28, 0.28)
		torch.position = FragmentData.point(x, tile_room.floorY) - Vector2(0, 215)
		scenery.add_child(torch)
		props.append(torch)

func reset_enemies() -> void:
	for enemy in enemies:
		enemy.free()
	enemies.clear()
	for id in FragmentData.load_catalog().encounters:
		var enemy = EnemyScript.new()
		enemy.setup(self, id)
		add_child(enemy)
		enemy.visible = ("city" if id == "palaceGuard" else "prison") == zone and enemy.health > 0
		enemies.append(enemy)

func enemy_by_id(id: String):
	for enemy in enemies:
		if enemy.id == id:
			return enemy
	return null

func nearest_enemy(reach: float = 8, forward_only = false):
	var best = null
	var nearest = reach * FragmentData.UNIT
	for enemy in enemies:
		if not enemy.visible or enemy.health <= 0 or absf(enemy.position.y - player.position.y) > 115:
			continue
		var dx = enemy.position.x - player.position.x
		if forward_only and player.facing * dx < 0:
			continue
		if absf(dx) <= nearest:
			best = enemy
			nearest = absf(dx)
	return best

func enemy_defeated(enemy) -> void:
	if enemy.id in PERMANENT_ENEMIES and enemy.id not in state.defeated:
		state.defeated.append(enemy.id)
	state.drops.append({"x": enemy.position.x / FragmentData.UNIT, "y": -enemy.position.y / FragmentData.UNIT,
		"amount": enemy.definition.souls, "kind": "enemy", "zone": zone})
	message = "%s倒下。" % enemy.definition.name
	match enemy.id:
		"inquisitor":
			state.collect("F05")
			add_loot("诘问之戒")
			message = "获得 F05 首相手令与诘问之戒；返回祭坛提交前三节点。"
		"warden":
			state.collect("F12")
			state.flags.wardenKey = true
			add_loot("典狱长钥匙串")
			add_loot("钥匙环戒指")
			message = "获得 F12、典狱长钥匙串与戒指。"
		"palaceGuard":
			message = "禁卫队长倒下；按 E 搜索尸体取得 F10。"
		"corruptedKnight":
			if add_loot("长廊原素瓶碎片"):
				state.max_flasks += 1
				player.flasks += 1

func add_loot(id: String) -> bool:
	if id in state.loot:
		return false
	state.loot.append(id)
	return true

func interaction() -> Array:
	var x = player.position.x / FragmentData.UNIT
	var y = -player.position.y / FragmentData.UNIT
	for entry in INTERACTIONS:
		if entry[1] == zone and absf(x - entry[2]) <= 1.4 and absf(y - entry[3]) <= 1.1:
			return entry
	return []

func prompt() -> String:
	var entry = interaction()
	if entry.is_empty():
		return ""
	match entry[0]:
		"F07": return "E · 隐藏字迹 F07" if state.flags.spiritPerception else "公告板：需要监狱临时灵力感知"
		"shortcutBottom": return "E · 登上二楼" if state.flags.shortcutOpen else "铁梯固定销在上方"
		"shortcutTop": return "E · 沿梯下降" if state.flags.shortcutOpen else "E · 放下永久捷径梯"
		"upper": return "W / Space · 二段跳登上高台" if state.flags.doubleJump else "二楼高台：需要完整历史解释的二段跳"
		"altar": return "T · 拼时间轴；E · 确认解释并存档"
		"exit": return "E · 进入王城" if state.flags.exitKnowledge else "E · 调查公文通行条件"
		"lock": return "E · 使用典狱长钥匙" if state.flags.wardenKey else "锁门：需要典狱长钥匙串"
		"F10": return "E · 搜索尸体 F10" if enemy_by_id("palaceGuard").health <= 0 else "封锁令在禁卫队长身上"
	return "E · " + entry[4]

func interact() -> void:
	var entry = interaction()
	if entry.is_empty() or player.health <= 0:
		return
	match entry[0]:
		"equipment":
			state.flags.equipmentRecovered = true
			message = "取回%s装备与原素瓶。" % FragmentData.load_catalog().origins[state.origin].name
			hud.rebuild_equipment()
		"dagger":
			if add_loot("备用短刀"):
				state.acquired_weapons.append("dagger")
				message = "获得牢房 D 的短刀。"
				hud.rebuild_equipment()
		"ring":
			add_loot("花木戒指")
			message = "在石桥下找到花木戒指。"
		"flask":
			if add_loot("通风管原素瓶碎片"):
				state.max_flasks += 1
				player.flasks += 1
			message = "调查假墙，获得原素瓶碎片。"
		"highRing":
			add_loot("长廊高台戒指")
			message = "获得长廊高台戒指。"
		"F01":
			state.collect("F01")
			message = "获得 F01 政务记录，按 T 展开时间轴。"
		"F07":
			if state.flags.spiritPerception:
				state.collect("F07")
				message = "获得 F07 典狱长拒令公告。"
			else:
				message = "字迹被覆盖，当前无法辨认。"
		"altar": confirm_timeline()
		"shortcutTop":
			if state.flags.shortcutOpen:
				travel("prison", -30, 2.5)
			else:
				state.flags.shortcutOpen = true
				message = "铁梯已放下，中层走廊与二楼永久双向连通。"
		"shortcutBottom":
			if state.flags.shortcutOpen:
				travel("prison", -30, 7)
			else:
				message = "需要从二楼放下铁梯。"
		"exit":
			if state.flags.exitKnowledge:
				state.flags.frontGateOpen = true
				travel("city", 55)
				message = "进入王城占位区；皇宫前厅在右侧。"
			else:
				message = "收集 F01、F03 并在祭坛提交 T0、T1 后，公文通道才会开放。"
		"armory": travel("armory", 94)
		"lock":
			if state.flags.wardenKey:
				state.flags.lockedDoorOpen = true
				travel("detention", 116)
			else:
				message = "锁孔刻着典狱长徽记。"
		"cityReturn": travel("prison", 10)
		"F10":
			if enemy_by_id("palaceGuard").health <= 0:
				state.collect("F10")
				message = "获得 F10 封锁令，回祭坛提交完整政变线。"
			else:
				message = "先击败禁卫队长。"
		"armoryReturn": travel("prison", 20)
		"detentionEntry":
			if state.flags.lockedDoorOpen:
				travel("detention", 112)
			else:
				message = "通道从刑讯室一侧锁着。"
		"detentionReturn": travel("armory", 102)
		"detentionRecord":
			state.flags.archiveRewardTaken = true
			add_loot("装备强化材料")
			message = "名册中的释放与拒令记录互相矛盾；获得强化材料。"
		"lockReturn": travel("prison", 41)
		"upper": message = "需要二段跳登上大厅高台。"

func at_altar() -> bool:
	return zone == "prison" and absf(player.position.x / FragmentData.UNIT - 16) <= 1.4 and absf(player.position.y / FragmentData.UNIT + 2.5) < 1

func confirm_timeline() -> bool:
	if not at_altar():
		message = "返回大厅祭坛才能提交解释和存档。"
		return false
	state.confirm()
	player.refill()
	projectiles.clear()
	reset_enemies()
	var saved = state.save_checkpoint(save_path)
	message = "祭坛响应：%s。%s" % ["二段跳" if state.flags.doubleJump else "监狱临时灵力感知" if state.flags.spiritPerception else "公文通道开放" if state.flags.exitKnowledge else "资源补满",
		"已存档。" if saved else "存档写入失败。"]
	hud.refresh()
	return saved

func load_game() -> bool:
	var candidate = FragmentState.new()
	if not candidate.load_checkpoint(save_path):
		message = "没有有效的祭坛存档。"
		return false
	state = candidate
	travel("prison", 16, 2.5)
	player.refill()
	reset_enemies()
	hud.rebuild_equipment()
	message = "已载入祭坛存档；普通敌人与临时战斗状态重置。"
	return true

func new_game() -> void:
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	state = FragmentState.new()
	death_remaining = 0
	travel("prison", -81, 0)
	player.refill()
	reset_enemies()
	hud.rebuild_equipment()
	message = "新游戏：向右取回职业装备。"

func spawn_enemy_projectile(enemy, attack: Dictionary) -> void:
	var start = enemy.position + Vector2(enemy.facing * 35, -65)
	var direction = (player.position + Vector2(0, -65) - start).normalized()
	projectiles.append({"position": start, "velocity": direction * float(attack.projectileSpeed) * FragmentData.UNIT,
		"damage": attack.damage, "enemy": true, "life": 2.5, "target": null, "attacker": enemy})

func spawn_soul_arrow() -> void:
	var start = player.position + Vector2(player.facing * 35, -65)
	projectiles.append({"position": start, "velocity": Vector2(player.facing * 10 * FragmentData.UNIT, 0),
		"damage": 40, "enemy": false, "life": 0.8, "target": nearest_enemy(8, true), "attacker": null})
	message = "释放追踪灵魂箭。"

func _step_projectiles(dt: float) -> void:
	for i in range(projectiles.size() - 1, -1, -1):
		var shot: Dictionary = projectiles[i]
		shot.life -= dt
		if not shot.enemy and is_instance_valid(shot.target) and shot.target.health > 0:
			shot.velocity = (shot.target.position + Vector2(0, -65) - shot.position).normalized() * 10 * FragmentData.UNIT
		shot.position += shot.velocity * dt
		if shot.enemy:
			if shot.position.distance_to(player.position + Vector2(0, -65)) < 35:
				player.receive_hit(float(shot.damage), shot.position.x, shot.attacker if is_instance_valid(shot.attacker) else null)
				shot.life = 0
		else:
			for enemy in enemies:
				if enemy.visible and enemy.health > 0 and shot.position.distance_to(enemy.position + Vector2(0, -65)) < 35:
					enemy.take_hit(shot.damage, 0, false)
					shot.life = 0
					break
		if shot.life <= 0:
			projectiles.remove_at(i)

func drop_zone(drop: Dictionary) -> String:
	return drop.get("zone", "city" if drop.x >= 50 and drop.x <= 80 else "prison")

func _draw() -> void:
	for drop in state.drops:
		if drop_zone(drop) == zone:
			var p = FragmentData.point(drop.x, drop.get("y", 2.5)) - Vector2(0, 18)
			draw_circle(p, 9, Color(0.4, 0.85, 0.92) if drop.kind == "grave" else Color(0.91, 0.77, 0.42))
	for shot in projectiles:
		draw_circle(shot.position, 9, Color(0.7, 0.25, 0.55) if shot.enemy else Color(0.4, 0.8, 1))
	if zone == "prison" and state.flags.shortcutOpen:
		for y in range(-448, -160, 18):
			draw_line(Vector2(-1940, y), Vector2(-1900, y), Color(0.6, 0.52, 0.4), 3)
		draw_line(Vector2(-1940, -448), Vector2(-1940, -160), Color(0.4, 0.38, 0.35), 4)
		draw_line(Vector2(-1900, -448), Vector2(-1900, -160), Color(0.4, 0.38, 0.35), 4)
