class_name FragmentData
extends RefCounted

const UNIT = 64.0
const STARTING = {
	"knight": ["straightSword", "kiteShield"], "assassin": ["rapier", "leatherShield"],
	"mage": ["apprenticeStaff", "dagger"], "cleric": ["mace", "travelerScripture"],
	"wretch": ["club", "woodenShield"],
}
static var catalog: Dictionary = {}

static func load_catalog() -> Dictionary:
	if catalog.is_empty():
		catalog = JSON.parse_string(FileAccess.get_file_as_string("res://data/game_data.json"))
	return catalog

static func point(x: float, y: float) -> Vector2:
	return Vector2(x * UNIT, -y * UNIT)

static func weapon_attack(id: String, attributes: Dictionary) -> float:
	var data = load_catalog()
	var weapon: Dictionary = data.weapons[id]
	var multiplier = 1.0
	for attribute in weapon.scaling:
		multiplier += float(data.scaling[weapon.scaling[attribute]]) * (float(attributes[attribute]) - 10.0) / 10.0
	return maxf(0.0, (float(weapon.attack) + float(weapon.get("elemental", {}).get("damage", 0))) * multiplier)

static func fragment(id: String) -> Dictionary:
	for item in load_catalog().fragments:
		if item.id == id:
			return item
	return {}

static func room_at(x: float, y: float, zone: String) -> Dictionary:
	var rooms: Array = load_catalog().rooms
	if zone == "prison":
		if y >= 6.7 and x >= -42 and x < 18:
			return rooms[9]
		for item in rooms.slice(0, 9):
			if x >= item.minX and x < item.maxX:
				return item
		return rooms[0] if x < -85 else rooms[8]
	var ids = {"city": ["CityStreet", "PalaceFoyer"], "armory": ["Armory"], "detention": ["DetentionArchive"]}[zone]
	for item in rooms:
		if item.id in ids and x >= item.minX and x <= item.maxX:
			return item
	return rooms[11] if zone == "city" else rooms[12] if zone == "armory" else rooms[13]

static func configure_input() -> void:
	var keys = {
		"move_left": [KEY_A, KEY_LEFT], "move_right": [KEY_D, KEY_RIGHT],
		"jump": [KEY_W, KEY_SPACE], "sprint": [KEY_SHIFT], "light": [KEY_J],
		"heavy": [KEY_K], "skill": [KEY_L], "shield_bash": [KEY_Q],
		"flask": [KEY_R], "interact": [KEY_E], "grip": [KEY_F],
		"timeline": [KEY_T], "pause": [KEY_ESCAPE], "equipment": [KEY_I],
	}
	for action in keys:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for key in keys[action]:
			var event = InputEventKey.new()
			event.physical_keycode = key
			InputMap.action_add_event(action, event)
	var buttons = {"jump": JOY_BUTTON_A, "light": JOY_BUTTON_X, "heavy": JOY_BUTTON_Y,
		"skill": JOY_BUTTON_LEFT_SHOULDER, "interact": JOY_BUTTON_B,
		"flask": JOY_BUTTON_RIGHT_SHOULDER, "timeline": JOY_BUTTON_BACK, "pause": JOY_BUTTON_START}
	for action in buttons:
		var event = InputEventJoypadButton.new()
		event.button_index = buttons[action]
		InputMap.action_add_event(action, event)
	for axis_value in [-1.0, 1.0]:
		var event = InputEventJoypadMotion.new()
		event.axis = JOY_AXIS_LEFT_X
		event.axis_value = axis_value
		InputMap.action_add_event("move_left" if axis_value < 0 else "move_right", event)

