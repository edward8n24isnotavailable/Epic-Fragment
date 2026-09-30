# Steam 桌面发行准备

发行目标为 Windows 10/11 x64。主工程导出原生程序 `release/EpicFragment.exe`，内嵌 PCK，不依赖浏览器、Node.js 或本地服务器。

## 当前交付

- Godot 4.7.2 Standard，Compatibility 桌面 OpenGL 渲染。
- 本地文件存档与稳定的用户目录名 `EpicFragment`。
- Windows x64 导出预设和可重复执行的导入、测试、导出脚本。
- 键盘及基础手柄玩法输入。

## 发布时配置

1. 使用真实 Steam App ID，在 Steamworks 设置 Windows Depot，上传程序与 `THIRD_PARTY_NOTICES.txt`。
2. 在 Steamworks 配置 Windows 启动项和工作目录，指向 `EpicFragment.exe`。
3. 若采用 Auto-Cloud，配置 `%APPDATA%/EpicFragment/checkpoint.json`。
4. 在 Windows 10/11 x64 上验收存档、中文界面、输入和暂停菜单。
5. 按产品需求接入 Steamworks 成就、显式云同步及完整 Steam Input。当前工程没有添加 Steam SDK 或 GodotSteam 扩展。

当前产物是原生 Greybox；没有上传或发布到 Steam，也没有申请 App ID、操作发行账号。外城/皇宫完整关卡、美术、音效和完整控制器体验仍按 ROADMAP 实施。

引擎与导出依据：[Godot 官方下载](https://godotengine.org/download/windows/)、[命令行导出](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)、[Windows 导出](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_windows.html)。
