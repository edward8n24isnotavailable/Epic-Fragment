extends CanvasLayer

var game
var root: Control
var stats: Label
var location: Label
var message: Label
var prompt: Label
var hp: ProgressBar
var stamina: ProgressBar
var fp: ProgressBar
var origin_picker: OptionButton
var main_picker: OptionButton
var off_picker: OptionButton
var grip_label: Label
var overlay: PanelContainer
var overlay_kind = ""
var confirm_button: Button
var main_ids: Array = []
var off_ids: Array = []
var new_dialog: ConfirmationDialog
var import_dialog: FileDialog

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var theme = Theme.new()
	theme.default_font = game.font
	theme.default_font_size = 16
	root.theme = theme
	add_child(root)
	var sidebar = PanelContainer.new()
	sidebar.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	sidebar.offset_right = 252
	sidebar.offset_bottom = -112
	sidebar.add_theme_stylebox_override("panel", _panel_style())
	root.add_child(sidebar)
	var margin = MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 16)
	sidebar.add_child(margin)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 7)
	margin.add_child(column)
	_label(column, "史诗碎片", 26)
	_label(column, "监狱 · Greybox", 15)
	hp = _bar(column, "生命", 350, Color(0.7, 0.23, 0.25))
	stamina = _bar(column, "精力", 90, Color(0.36, 0.63, 0.39))
	fp = _bar(column, "FP", 80, Color(0.3, 0.55, 0.8))
	stats = _label(column, "", 15)
	origin_picker = OptionButton.new()
	origin_picker.focus_mode = Control.FOCUS_NONE
	for id in FragmentData.load_catalog().origins:
		origin_picker.add_item(FragmentData.load_catalog().origins[id].name)
	column.add_child(origin_picker)
	origin_picker.item_selected.connect(_choose_origin)
	main_picker = OptionButton.new()
	main_picker.focus_mode = Control.FOCUS_NONE
	main_picker.item_selected.connect(_equip_main)
	column.add_child(main_picker)
	off_picker = OptionButton.new()
	off_picker.focus_mode = Control.FOCUS_NONE
	off_picker.item_selected.connect(_equip_off)
	column.add_child(off_picker)
	grip_label = _label(column, "", 14)
	_button(column, "T · 时间轴", func(): toggle_overlay("timeline"))
	_button(column, "I · 武器图鉴", func(): toggle_overlay("catalog"))
	_button(column, "Esc · 暂停", func(): toggle_overlay("pause"))
	location = Label.new()
	location.position = Vector2(275, 18)
	location.add_theme_font_size_override("font_size", 22)
	root.add_child(location)
	var footer = PanelContainer.new()
	footer.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	footer.offset_top = -112
	footer.add_theme_stylebox_override("panel", _panel_style())
	root.add_child(footer)
	var bottom = VBoxContainer.new()
	bottom.add_theme_constant_override("separation", 8)
	var footer_margin = MarginContainer.new()
	footer_margin.add_theme_constant_override("margin_left", 22)
	footer_margin.add_theme_constant_override("margin_top", 12)
	footer_margin.add_theme_constant_override("margin_right", 22)
	footer.add_child(footer_margin)
	footer_margin.add_child(bottom)
	prompt = _label(bottom, "", 19)
	message = _label(bottom, "", 15)
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	new_dialog = ConfirmationDialog.new()
	new_dialog.title = "开始新游戏"
	new_dialog.dialog_text = "清除当前祭坛存档并开始新游戏？"
	new_dialog.confirmed.connect(func(): close_overlay(); game.new_game())
	root.add_child(new_dialog)
	import_dialog = FileDialog.new()
	import_dialog.title = "导入旧版 JSON 存档"
	import_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	import_dialog.access = FileDialog.ACCESS_FILESYSTEM
	import_dialog.filters = PackedStringArray(["*.json ; JSON 存档"])
	import_dialog.use_native_dialog = true
	import_dialog.file_selected.connect(_import_save)
	root.add_child(import_dialog)

func _panel_style() -> StyleBoxFlat:
	var style = StyleBoxFlat.new()
	style.bg_color = Color(0.055, 0.065, 0.08, 1)
	style.border_color = Color(0.27, 0.25, 0.21)
	style.set_border_width_all(1)
	return style

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		toggle_overlay("pause")
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("timeline"):
		toggle_overlay("timeline")
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("equipment"):
		toggle_overlay("catalog")
		get_viewport().set_input_as_handled()

func _label(parent: Node, text: String, size: int = 16) -> Label:
	var label = Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	parent.add_child(label)
	return label

func _button(parent: Node, text: String, callback: Callable) -> Button:
	var button = Button.new()
	button.text = text
	button.focus_mode = Control.FOCUS_NONE
	button.pressed.connect(callback)
	parent.add_child(button)
	return button

func _bar(parent: Node, title: String, maximum: float, color: Color) -> ProgressBar:
	var label = _label(parent, title, 13)
	label.modulate = Color(0.7, 0.72, 0.76)
	var bar = ProgressBar.new()
	bar.max_value = maximum
	bar.custom_minimum_size.y = 20
	var style = StyleBoxFlat.new()
	style.bg_color = color
	style.corner_radius_top_left = 3
	style.corner_radius_bottom_left = 3
	bar.add_theme_stylebox_override("fill", style)
	parent.add_child(bar)
	return bar

func refresh() -> void:
	if game.player == null:
		return
	hp.value = game.player.health
	stamina.value = game.player.stamina
	fp.max_value = game.state.max_fp()
	fp.value = game.player.fp
	stats.text = "魂 %d · 原素瓶 %d / %d\n碎片 %d · 死亡 %d" % [game.state.souls, game.player.flasks, game.state.max_flasks, game.state.collected.size(), game.state.deaths]
	location.text = game.room().label
	message.text = game.message
	prompt.text = game.prompt()
	origin_picker.disabled = game.state.flags.equipmentRecovered
	main_picker.disabled = not game.state.flags.equipmentRecovered or not game.player.can_act()
	off_picker.disabled = main_picker.disabled or game.state.equipment.twoHanded
	grip_label.text = ("双手握持 · 攻击 ×1.2" if game.state.equipment.twoHanded else "单手握持") + "\nL · " + _skill_name(game.state.active_skill())

func _skill_name(skill: String) -> String:
	return {"shield": "弹反 / 举盾", "prayer": "圣典祷言", "soulArrow": "追踪灵魂箭", "holyGuard": "圣盾格挡", "flurry": "连续突刺", "blessing": "祝福", "daggerStep": "闪避步", "none": "无战技", "catalog": "待所属关卡接入"}.get(skill, skill)

func gear_name(id: Variant) -> String:
	if id == null:
		return "空手"
	var data = FragmentData.load_catalog()
	return data.weapons[id].name if data.weapons.has(id) else data.offhands[id].name

func rebuild_equipment() -> void:
	origin_picker.select(FragmentData.load_catalog().origins.keys().find(game.state.origin))
	main_ids = game.state.owned_weapons()
	off_ids = game.state.owned_offhands().filter(func(id): return id != game.state.equipment.mainHand)
	main_picker.clear()
	off_picker.clear()
	for id in main_ids:
		main_picker.add_item("主手 · " + gear_name(id))
	for id in off_ids:
		off_picker.add_item("副手 · " + gear_name(id))
	main_picker.select(main_ids.find(game.state.equipment.mainHand))
	off_picker.select(off_ids.find(game.state.equipment.offHand))
	refresh()

func _choose_origin(index: int) -> void:
	if game.state.choose_origin(FragmentData.load_catalog().origins.keys()[index]):
		game.player.fp = game.state.max_fp()
		game.message = "选择%s；职业装备在走廊没收架上。" % origin_picker.get_item_text(index)
		rebuild_equipment()

func _equip_main(index: int) -> void:
	if not game.state.flags.equipmentRecovered or not game.player.can_act():
		return
	var id = main_ids[index]
	if game.state.equipment.offHand == id:
		game.state.equipment.offHand = game.state.equipment.mainHand
	game.state.equipment.mainHand = id
	game.player.magic_guard_remaining = 0
	rebuild_equipment()

func _equip_off(index: int) -> void:
	if not game.state.flags.equipmentRecovered or not game.player.can_act():
		return
	game.state.equipment.offHand = off_ids[index]
	game.player.magic_guard_remaining = 0
	rebuild_equipment()

func toggle_overlay(kind: String) -> void:
	if overlay_kind == kind or (kind == "pause" and overlay_kind != ""):
		close_overlay()
		return
	if kind == "timeline" and "F01" not in game.state.collected:
		game.message = "先调查档案室 F01，时间轴才会展开。"
		refresh()
		return
	close_overlay()
	overlay_kind = kind
	game.player.prayer_active = false
	get_tree().paused = true
	overlay = PanelContainer.new()
	overlay.add_theme_stylebox_override("panel", _panel_style())
	overlay.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	overlay.position = Vector2(280, 65)
	overlay.size = Vector2(950, 520)
	overlay.set_anchors_preset(Control.PRESET_TOP_LEFT)
	overlay.offset_right = 1240
	overlay.offset_bottom = 590
	root.add_child(overlay)
	var margin = MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 18)
	overlay.add_child(margin)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 12)
	margin.add_child(column)
	var heading = HBoxContainer.new()
	column.add_child(heading)
	var title = _label(heading, {"timeline": "时间轴 · 证据与解释", "catalog": "武器图鉴", "pause": "暂停"}[kind], 24)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_button(heading, "关闭", close_overlay)
	match kind:
		"timeline": _build_timeline(column)
		"catalog": _build_catalog(column)
		"pause": _build_pause(column)

func close_overlay() -> void:
	if is_instance_valid(overlay):
		overlay.queue_free()
	overlay = null
	overlay_kind = ""
	confirm_button = null
	get_tree().paused = false
	if game.player != null:
		game.player.prayer_active = false
	refresh()

func _scroll(parent: Node) -> VBoxContainer:
	var scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	parent.add_child(scroll)
	var rows = VBoxContainer.new()
	rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rows.add_theme_constant_override("separation", 14)
	scroll.add_child(rows)
	return rows

func _build_timeline(column: Node) -> void:
	var note = _label(column, "线索记录各方的说法；选择证据后，回祭坛提交解释。", 15)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var rows = _scroll(column)
	for node in FragmentData.load_catalog().timeNodes:
		_label(rows, "%s · %s" % [node.id, node.label], 18)
		var options = OptionButton.new()
		options.focus_mode = Control.FOCUS_NONE
		options.add_item("尚未选择解释")
		var ids: Array = [null]
		for fragment in FragmentData.load_catalog().fragments:
			if fragment.timeNodeId == node.id and fragment.id in game.state.collected:
				ids.append(fragment.id)
				options.add_item("%s · %s" % [fragment.id, fragment.title])
		rows.add_child(options)
		options.select(ids.find(game.state.selections[node.id]))
		var detail = _label(rows, "", 14)
		detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_update_evidence(detail, game.state.selections[node.id], node.result)
		options.item_selected.connect(_select_evidence.bind(node.id, ids, detail, node.result))
	confirm_button = _button(column, "在祭坛提交当前解释", func(): close_overlay(); game.confirm_timeline())
	confirm_button.disabled = not game.at_altar()
	if not game.at_altar():
		_label(column, "当前不在祭坛；选择会保留，返回大厅后按 E 提交。", 13)

func _update_evidence(label: Label, id: Variant, result: String) -> void:
	if id == null:
		label.text = result
		return
	var fragment = FragmentData.fragment(id)
	label.text = "%s\n来源：%s%s" % [fragment.statement, fragment.source,
		"\n" + fragment.reliabilityHint if fragment.has("reliabilityHint") else ""]

func _select_evidence(index: int, node: String, ids: Array, detail: Label, result: String) -> void:
	if game.state.select(node, ids[index]):
		_update_evidence(detail, ids[index], result)

func _build_catalog(column: Node) -> void:
	_label(column, "只可装备已取得的物品；预估攻击含当前出身的属性补正。", 14)
	var rows = _scroll(column)
	var data = FragmentData.load_catalog()
	for id in data.weapons:
		var item: Dictionary = data.weapons[id]
		var owned = id in game.state.owned_weapons() and game.state.flags.equipmentRecovered
		_label(rows, "%s · %s · %s" % [item.name, item.category, "已取得" if owned else "未取得"], 18)
		var details = _label(rows, "预估攻击 %.1f · 重量 %.1f · 战技 %s / FP %d\n来源：%s · 补正 %s" % [
			FragmentData.weapon_attack(id, data.attributes[game.state.origin]) * (1.2 if game.state.equipment.twoHanded else 1),
			item.weight, item.skillName, item.fpCost, item.source, JSON.stringify(item.scaling)], 14)
		details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	for id in data.offhands:
		var item: Dictionary = data.offhands[id]
		_label(rows, item.name, 18)
		_label(rows, "减伤 %.0f%% · 重量 %.1f · 来源：%s" % [item.reduction * 100, item.weight, item.source], 14)

func _build_pause(column: Node) -> void:
	_label(column, "A / D 移动 · W / Space 跳跃 · Shift 疾跑\nJ / K 轻 / 重攻击 · Q 盾击 · L 防御 / 战技\nR 原素瓶 · E 调查 · F 单双手 · T 时间轴 · I 图鉴", 16)
	_button(column, "继续游戏", close_overlay)
	_button(column, "载入祭坛存档", func(): close_overlay(); game.load_game())
	_button(column, "导入旧版 JSON 存档", func(): import_dialog.popup_centered(Vector2i(900, 600)))
	_button(column, "新游戏（清除存档）", func(): new_dialog.popup_centered())
	_button(column, "退出游戏", func(): get_tree().quit())

func _import_save(path: String) -> void:
	var candidate = FragmentState.new()
	if not candidate.apply_save(JSON.parse_string(FileAccess.get_file_as_string(path))):
		game.message = "JSON 存档无效，当前进度未更改。"
	elif candidate.save_checkpoint(game.save_path):
		close_overlay()
		game.load_game()
	else:
		game.message = "存档写入失败。"
	refresh()
