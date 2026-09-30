class_name FragmentState
extends RefCounted

const SAVE_PATH = "user://checkpoint.json"
const FLAG_KEYS = ["equipmentRecovered", "exitKnowledge", "spiritPerception", "doubleJump", "dash",
	"shortcutOpen", "wardenKey", "lockedDoorOpen", "frontGateOpen", "archiveRewardTaken"]
var origin = "knight"
var equipment: Dictionary
var flags: Dictionary = {}
var collected: Array = []
var selections: Dictionary = {}
var loot: Array = []
var acquired_weapons: Array = []
var acquired_offhands: Array = []
var defeated: Array = []
var discovered: Array = ["Cell"]
var souls = 0
var drops: Array = []
var deaths = 0
var checkpoint_active = false
var max_flasks = 3

func _init() -> void:
	for key in FLAG_KEYS:
		flags[key] = false
	for node in FragmentData.load_catalog().timeNodes:
		selections[node.id] = null
	choose_origin(origin)

func choose_origin(id: String) -> bool:
	if flags.equipmentRecovered or not FragmentData.STARTING.has(id):
		return false
	origin = id
	equipment = {"mainHand": FragmentData.STARTING[id][0], "offHand": FragmentData.STARTING[id][1], "twoHanded": false}
	return true

func max_fp() -> float:
	var attunement = float(FragmentData.load_catalog().attributes[origin].attunement)
	return 50 + minf(20, maxf(0, attunement - 10)) * 5 + maxf(0, attunement - 30) * 2

func collect(id: String) -> bool:
	if id in collected or FragmentData.fragment(id).is_empty():
		return false
	collected.append(id)
	return true

func select(node: String, id: Variant) -> bool:
	if not selections.has(node):
		return false
	if id != null and (id not in collected or FragmentData.fragment(id).get("timeNodeId") != node):
		return false
	selections[node] = id
	return true

func effects() -> Dictionary:
	var first_two = selections.T0 == "F01" and selections.T1 == "F03"
	var first_three = first_two and selections.T2 == "F05"
	return {"exitKnowledge": first_two, "spiritPerception": first_three,
		"doubleJump": first_three and selections.T3 == "F07" and selections.T4 == "F10",
		"dash": selections.T0 == "F01" and selections.T1 == "F04" and selections.T2 == "F05"
			and selections.T3 == "F08" and selections.T4 == "F09"}

func confirm() -> void:
	var rewards = effects()
	for key in rewards:
		flags[key] = flags[key] or rewards[key]
	checkpoint_active = true

func owned_weapons() -> Array:
	var result = [FragmentData.STARTING[origin][0]]
	var secondary = FragmentData.STARTING[origin][1]
	if FragmentData.load_catalog().weapons.has(secondary):
		result.append(secondary)
	if origin == "assassin":
		result.append("thiefDagger")
	for id in acquired_weapons:
		if id not in result:
			result.append(id)
	return result

func owned_offhands() -> Array:
	var result: Array = [null]
	result.append_array(owned_weapons())
	var secondary = FragmentData.STARTING[origin][1]
	if FragmentData.load_catalog().offhands.has(secondary):
		result.append(secondary)
	for id in acquired_offhands:
		if id not in result:
			result.append(id)
	return result

func active_skill() -> String:
	if not flags.equipmentRecovered:
		return "none"
	var data = FragmentData.load_catalog()
	var off = null if equipment.twoHanded else equipment.offHand
	if data.offhands.has(off):
		return "prayer" if data.offhands[off].kind == "scripture" else "shield"
	return data.weapons[equipment.mainHand].skill

func shield() -> Dictionary:
	var off = null if equipment.twoHanded or not flags.equipmentRecovered else equipment.offHand
	return FragmentData.load_catalog().offhands.get(off, {"reduction": 0.0, "parryBonusFrames": 0})

func power() -> float:
	if not flags.equipmentRecovered:
		return 0.4
	return FragmentData.weapon_attack(equipment.mainHand, FragmentData.load_catalog().attributes[origin]) / 105.0 * (1.2 if equipment.twoHanded else 1.0)

func to_save() -> Dictionary:
	return {"version": 1, "engine": "godot", "origin": origin, "equipment": equipment.duplicate(true),
		"flags": flags.duplicate(), "loot": loot.duplicate(), "acquiredWeapons": acquired_weapons.duplicate(),
		"acquiredOffhands": acquired_offhands.duplicate(), "defeatedEncounters": defeated.duplicate(),
		"discoveredRooms": discovered.duplicate(), "maxFlasks": max_flasks,
		"narrative": {"collectedFragmentIds": collected.duplicate(), "selections": selections.duplicate()},
		"progression": {"souls": souls, "drops": drops.duplicate(true), "deaths": deaths,
			"checkpointActive": checkpoint_active, "checkpointX": 16}, "savedAt": Time.get_unix_time_from_system()}

static func valid_save(value: Variant) -> bool:
	if not value is Dictionary or value.get("version") != 1:
		return false
	var data = FragmentData.load_catalog()
	if not data.origins.has(value.get("origin")):
		return false
	for key in ["equipment", "flags", "progression", "narrative"]:
		if not value.get(key) is Dictionary:
			return false
	var gear: Dictionary = value.equipment
	if not data.weapons.has(gear.get("mainHand")) or not gear.get("twoHanded") is bool:
		return false
	if gear.get("offHand") != null and not data.weapons.has(gear.offHand) and not data.offhands.has(gear.offHand):
		return false
	if gear.get("offHand") == gear.mainHand:
		return false
	for key in FLAG_KEYS:
		if not value.flags.get(key) is bool:
			return false
	for key in ["loot", "acquiredWeapons", "acquiredOffhands", "defeatedEncounters", "discoveredRooms"]:
		if not value.get(key) is Array:
			return false
		for id in value[key]:
			if not id is String:
				return false
			if key == "acquiredWeapons" and not data.weapons.has(id):
				return false
			if key == "acquiredOffhands" and not data.offhands.has(id):
				return false
			if key == "defeatedEncounters" and not data.encounters.has(id):
				return false
	var story: Dictionary = value.narrative
	if not story.get("collectedFragmentIds") is Array or not story.get("selections") is Dictionary:
		return false
	for id in story.collectedFragmentIds:
		if not id is String or FragmentData.fragment(id).is_empty():
			return false
	for node in data.timeNodes:
		if not story.selections.has(node.id):
			return false
		var id = story.selections[node.id]
		if id != null and (not id is String or id not in story.collectedFragmentIds or FragmentData.fragment(id).get("timeNodeId") != node.id):
			return false
	if not _number(value.get("maxFlasks"), 3) or value.maxFlasks != floor(value.maxFlasks) or value.maxFlasks > 100:
		return false
	var progress: Dictionary = value.progression
	if progress.get("checkpointActive") != true or not _number(progress.get("checkpointX"), -1000):
		return false
	for key in ["souls", "deaths"]:
		if not _number(progress.get(key), 0):
			return false
	if not progress.get("drops") is Array:
		return false
	for drop in progress.drops:
		if not drop is Dictionary or not _number(drop.get("x"), -1000) or not _number(drop.get("y", 2.5), -1000) or not _number(drop.get("amount"), 0) or drop.get("kind") not in ["enemy", "grave"]:
			return false
	return true

static func _number(value: Variant, minimum: float) -> bool:
	return (value is float or value is int) and is_finite(float(value)) and float(value) >= minimum

func apply_save(value: Variant) -> bool:
	if not valid_save(value):
		return false
	origin = value.origin
	equipment = value.equipment.duplicate(true)
	flags = value.flags.duplicate()
	loot = value.loot.duplicate()
	acquired_weapons = value.acquiredWeapons.duplicate()
	acquired_offhands = value.acquiredOffhands.duplicate()
	defeated = value.defeatedEncounters.duplicate()
	discovered = value.discoveredRooms.duplicate()
	collected = value.narrative.collectedFragmentIds.duplicate()
	selections = value.narrative.selections.duplicate()
	souls = int(value.progression.souls)
	drops = value.progression.drops.duplicate(true)
	deaths = int(value.progression.deaths)
	checkpoint_active = true
	max_flasks = int(value.maxFlasks)
	return true

func save_checkpoint(path: String = SAVE_PATH) -> bool:
	var payload = to_save()
	if not valid_save(payload):
		return false
	var file = FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(payload, "\t"))
	file.flush()
	file.close()
	return DirAccess.rename_absolute(ProjectSettings.globalize_path(path + ".tmp"), ProjectSettings.globalize_path(path)) == OK

func load_checkpoint(path: String = SAVE_PATH) -> bool:
	if not FileAccess.file_exists(path):
		return false
	return apply_save(JSON.parse_string(FileAccess.get_file_as_string(path)))
