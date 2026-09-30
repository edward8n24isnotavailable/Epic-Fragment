extends AnimatedSprite2D
## Draws Blender-baked puppet poses; gameplay movement/hits remain in FragmentPlayer.

const CATALOG_PATH = "res://data/player_animations.json"
const ATTACK_FRAMES = {"light": [3, 4, 6], "heavy": [7, 4, 9], "shieldBash": [3, 3, 6]}
static var catalog: Dictionary = {}
static var frame_cache: Dictionary = {}
var appearance_id = ""
var visual_clip = "idle"
var visual_clock = 0.0
var hit_remaining = 0.0
var action_remaining = 0.0
var action_name = ""
var land_remaining = 0.0
var was_grounded = false
var previous_vertical = 0.0

func _ready() -> void:
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_set_appearance("prisoner")

static func load_catalog() -> Dictionary:
	if catalog.is_empty():
		catalog = JSON.parse_string(FileAccess.get_file_as_string(CATALOG_PATH))
	return catalog

static func frames_for(appearance: String) -> SpriteFrames:
	if frame_cache.has(appearance):
		return frame_cache[appearance]
	var definition: Dictionary = load_catalog().skins[appearance]
	var atlas = load(definition.atlas) as Texture2D
	var frames = SpriteFrames.new()
	frames.remove_animation("default")
	for clip in definition.clips:
		var entry: Dictionary = definition.clips[clip]
		frames.add_animation(clip)
		frames.set_animation_speed(clip, entry.fps)
		frames.set_animation_loop_mode(clip, SpriteFrames.LOOP_LINEAR if entry.loop else SpriteFrames.LOOP_NONE)
		for source in entry.frames:
			var texture = AtlasTexture.new()
			texture.atlas = atlas
			texture.region = Rect2(source.region[0], source.region[1], source.region[2], source.region[3])
			texture.margin = Rect2(source.margin[0], source.margin[1], source.margin[2], source.margin[3])
			texture.filter_clip = true
			frames.add_frame(clip, texture)
	frame_cache[appearance] = frames
	return frames

func _set_appearance(id: String) -> void:
	if id == appearance_id:
		return
	sprite_frames = frames_for(id)
	appearance_id = id
	animation = "idle"
	frame = 0
	visual_clip = "idle"
	visual_clock = 0

func reset_visual() -> void:
	visual_clip = "idle"
	visual_clock = 0
	hit_remaining = 0
	action_remaining = 0
	land_remaining = 0
	was_grounded = false
	previous_vertical = 0

func trigger_hit() -> void:
	hit_remaining = 0.2

func trigger_action(clip: String, duration: float) -> void:
	action_name = clip
	action_remaining = duration
	visual_clock = 0

func update_from_player(player: FragmentPlayer, dt: float) -> void:
	_set_appearance(player.game.state.origin if player.game.state.flags.equipmentRecovered else "prisoner")
	hit_remaining = maxf(0, hit_remaining - dt)
	action_remaining = maxf(0, action_remaining - dt)
	land_remaining = maxf(0, land_remaining - dt)
	var grounded = player.is_on_floor()
	if grounded and not was_grounded and previous_vertical > 50:
		land_remaining = 0.13
	var clip = "idle"
	if player.health <= 0:
		clip = "death"
	elif player.defense == "stagger":
		clip = "stagger"
	elif hit_remaining > 0:
		clip = "hurt"
	elif player.attack_phase != "idle":
		clip = {"light": "light", "heavy": "heavy", "shieldBash": "bash"}[player.attack_kind]
	elif player.defense == "dodge":
		clip = "dodge"
	elif player.defense == "parry":
		clip = "parry"
	elif player.defense == "guard":
		clip = "guard"
	elif player.prayer_active:
		clip = "prayer"
	elif action_remaining > 0:
		clip = action_name
	elif player.effect_remaining > 0:
		clip = "cast"
	elif not grounded:
		clip = "jump" if player.velocity.y < 0 else "fall"
	elif land_remaining > 0:
		clip = "land"
	elif absf(player.velocity.x) > 250:
		clip = "run"
	elif absf(player.velocity.x) > 12:
		clip = "walk"
	if clip != visual_clip or (clip == "jump" and previous_vertical >= 0 and player.velocity.y < 0):
		visual_clip = clip
		visual_clock = 0
	else:
		visual_clock += dt
	animation = clip
	var count = sprite_frames.get_frame_count(clip)
	var index = int(visual_clock * sprite_frames.get_animation_speed(clip))
	if clip in ["walk", "run"]:
		index = int(visual_clock * sprite_frames.get_animation_speed(clip) * clampf(absf(player.velocity.x) / (384 if clip == "run" else 192), 0.5, 1.6))
	if player.attack_phase != "idle" and clip in ["light", "heavy", "bash"]:
		var segments: Array = ATTACK_FRAMES[player.attack_kind]
		var phase = ["startup", "active", "recovery"].find(player.attack_phase)
		var begin = 0
		for i in range(phase):
			begin += segments[i]
		var duration: float = player.ATTACKS[player.attack_kind][player.attack_phase]
		index = begin + mini(segments[phase] - 1, int(player.attack_time / duration * segments[phase]))
	elif clip == "dodge":
		index = int(player.defense_time / 0.2 * count)
	elif clip == "parry":
		index = int(player.defense_time / 0.25 * count)
	elif clip == "stagger":
		index = int(player.defense_time * count)
	frame = posmod(index, count) if sprite_frames.get_animation_loop_mode(clip) == SpriteFrames.LOOP_LINEAR else clampi(index, 0, count - 1)
	flip_h = player.facing < 0
	modulate = Color(1.4, 0.3, 0.3) if hit_remaining > 0 else Color(1.25, 1.05, 0.65) if player.radiant_remaining > 0 else Color.WHITE
	was_grounded = grounded
	previous_vertical = player.velocity.y
