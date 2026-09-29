import { basicEnemyProfile, type EnemyProfile } from '../domain/enemy'
import type { EncounterId } from './encounters'

const madGuard: EnemyProfile = { detectRange: 4.5, chaseSpeed: 2.8, attacks: [
  { name: '疯乱劈砍', range: 1.35, damage: 15, windup: 0.38, active: 0.17, recovery: 0.72 },
  { name: '扑身突击', range: 2.8, damage: 18, windup: 0.55, active: 0.27,
    recovery: 0.95, lungeSpeed: 5 },
] }

const corruptedKnight: EnemyProfile = { detectRange: 5.3, chaseSpeed: 1.9, attacks: [
  { name: '腐化横斩', range: 2.1, damage: 50, windup: 0.7, active: 0.2, recovery: 0.95 },
  { name: '盾肩冲撞', range: 3.4, damage: 45, windup: 0.6, active: 0.32,
    recovery: 1.1, lungeSpeed: 4.8 },
  { name: '重剑下劈', range: 1.65, damage: 65, windup: 0.95, active: 0.2, recovery: 1.2 },
] }

const inquisitor: EnemyProfile = { detectRange: 6, chaseSpeed: 1.8, attacks: [
  { name: '审讯鞭横扫', range: 3.1, damage: 35, windup: 0.7, active: 0.22, recovery: 0.95 },
  { name: '烙铁投掷', range: 5.2, damage: 32, windup: 0.9,
    active: 0.15, recovery: 1.05, projectileSpeed: 8 },
  { name: '锁链拉拽', range: 3.8, damage: 30, windup: 0.8,
    active: 0.2, recovery: 1.0, displacement: -1.6 },
  { name: '刑罚踩踏', range: 1.5, damage: 45, windup: 0.85, active: 0.22,
    recovery: 1.1, groundOnly: true, allAround: true },
] }

const ragingInquisitor: EnemyProfile = { ...inquisitor, chaseSpeed: 2.3, attacks: [
  ...inquisitor.attacks,
  { name: '暴怒连击', range: 2.2, damage: 50, windup: 0.42, active: 0.34,
    recovery: 0.7, lungeSpeed: 3 },
] }

const warden: EnemyProfile = { detectRange: 7, chaseSpeed: 1.4, attacks: [
  { name: '念力推', range: 4.4, damage: 45, windup: 0.75,
    active: 0.18, recovery: 1.0, displacement: 1.8 },
  { name: '暗影弹', range: 6.2, damage: 38, windup: 1.0,
    active: 0.15, recovery: 1.0, projectileSpeed: 7 },
  { name: '地面震动', range: 3.0, damage: 55, windup: 1.15, active: 0.25,
    recovery: 1.25, groundOnly: true, allAround: true },
] }

const wardenSecondPhase: EnemyProfile = { ...warden, chaseSpeed: 2.0, attacks: [
  ...warden.attacks,
  { name: '钥匙横斩', range: 2.2, damage: 60, windup: 0.55, active: 0.22, recovery: 0.9 },
  { name: '钥匙突进', range: 4.0, damage: 65, windup: 0.72, active: 0.35,
    recovery: 1.1, lungeSpeed: 5.2 },
] }

const palaceGuard: EnemyProfile = { detectRange: 5.2, chaseSpeed: 2.1, attacks: [
  { name: '禁卫长枪突刺', range: 2.4, damage: 40, windup: 0.65, active: 0.2, recovery: 0.85 },
  { name: '盾阵冲锋', range: 3.7, damage: 45, windup: 0.75, active: 0.3,
    recovery: 1.0, lungeSpeed: 5 },
] }

export function profileForEncounter(id: EncounterId, health: number): EnemyProfile {
  if (id === 'cellGuard') return madGuard
  if (id === 'corruptedKnight') return corruptedKnight
  if (id === 'inquisitor') return health < 200 ? ragingInquisitor : inquisitor
  if (id === 'warden') return health <= 600 ? wardenSecondPhase : warden
  if (id === 'palaceGuard') return palaceGuard
  return basicEnemyProfile
}
