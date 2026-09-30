extends SceneTree

func _initialize() -> void:
	var args = OS.get_cmdline_user_args()
	if args.size() != 1:
		push_error("Pass the export destination directory after --.")
		quit(1)
		return
	var file = FileAccess.open(args[0].path_join("THIRD_PARTY_NOTICES.txt"), FileAccess.WRITE)
	if file == null:
		push_error("Cannot write engine notices.")
		quit(1)
		return
	file.store_string("Godot Engine " + Engine.get_version_info().string + "\n\n" + Engine.get_license_text() + "\n\n")
	file.store_string("Third-party component attribution\n\n" + JSON.stringify(Engine.get_copyright_info(), "\t") + "\n\n")
	var licenses = Engine.get_license_info()
	for name in licenses:
		file.store_string(name + "\n" + str(licenses[name]) + "\n\n")
	file.close()
	quit(0)
