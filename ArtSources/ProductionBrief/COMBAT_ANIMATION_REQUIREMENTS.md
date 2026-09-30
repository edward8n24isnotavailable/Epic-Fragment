# 当前敌人招式动画需求

所有时间直接来自现有 profiles 配置。蓄力、命中、收招需要分别组织帧段；以24fps制作参考关键帧，实际播放必须保持这些秒数。先制作右向，左向可镜像。四个 upper 遭遇共用 upper1 的动作。相同二阶段动作不重复交付，只制作新增/变化招式。

| 人物 | 阶段 | 招式 | 蓄力/秒 | 命中/秒 | 收招/秒 |
| --- | --- | --- | --- | --- | --- |
| 牢房疯兵 / cellGuard | normal | 疯乱劈砍 | 0.38 | 0.17 | 0.72 |
| 牢房疯兵 / cellGuard | normal | 扑身突击 | 0.55 | 0.27 | 0.95 |
| 灰烬士兵 / soldier | normal | 横斩 | 0.6 | 0.16 | 0.8 |
| 二楼狱卒 / upper1 | normal | 横斩 | 0.6 | 0.16 | 0.8 |
| 腐化骑士 / corruptedKnight | normal | 腐化横斩 | 0.7 | 0.2 | 0.95 |
| 腐化骑士 / corruptedKnight | normal | 盾肩冲撞 | 0.6 | 0.32 | 1.1 |
| 腐化骑士 / corruptedKnight | normal | 重剑下劈 | 0.95 | 0.2 | 1.2 |
| 责难官 / inquisitor | normal | 审讯鞭横扫 | 0.7 | 0.22 | 0.95 |
| 责难官 / inquisitor | normal | 烙铁投掷 | 0.9 | 0.15 | 1.05 |
| 责难官 / inquisitor | normal | 锁链拉拽 | 0.8 | 0.2 | 1 |
| 责难官 / inquisitor | normal | 刑罚踩踏 | 0.85 | 0.22 | 1.1 |
| 责难官 / inquisitor | phase2 | 暴怒连击 | 0.42 | 0.34 | 0.7 |
| 典狱长 / warden | normal | 念力推 | 0.75 | 0.18 | 1 |
| 典狱长 / warden | normal | 暗影弹 | 1 | 0.15 | 1 |
| 典狱长 / warden | normal | 地面震动 | 1.15 | 0.25 | 1.25 |
| 典狱长 / warden | phase2 | 钥匙横斩 | 0.55 | 0.22 | 0.9 |
| 典狱长 / warden | phase2 | 钥匙突进 | 0.72 | 0.35 | 1.1 |
| 禁卫队长 / palaceGuard | normal | 禁卫长枪突刺 | 0.65 | 0.2 | 0.85 |
| 禁卫队长 / palaceGuard | normal | 盾阵冲锋 | 0.75 | 0.3 | 1 |

投射物、刀光、锁链和地震冲击波另交；攻击动作不能把这些效果与角色背景合并。敌人还需要 idle/walk/hurt/exhausted/death；力竭保持可循环，死亡末帧保持。典狱长召唤仍在路线图待制作，暂不扩充召唤小怪清单。
