export type CombatAttribute = 'strength' | 'dexterity' | 'intelligence' | 'faith'
export type ScalingGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E'
export type WeaponSkillId = 'holyGuard' | 'flurry' | 'soulArrow' | 'blessing' | 'daggerStep' | 'none' | 'catalog'

export interface CombatAttributes {
  strength: number
  dexterity: number
  intelligence: number
  faith: number
}

export interface WeaponDefinition {
  name: string
  category: '特大剑' | '大剑' | '匕首' | '刺剑' | '法杖' | '钉锤' | '木棍'
  attack: number
  elemental?: { type: '火' | '雷' | '暗' | '魔法'; damage: number }
  bleed?: number
  hpRegen?: number
  scaling: Partial<Record<CombatAttribute, ScalingGrade>>
  weight: number
  reach: number
  skill: WeaponSkillId
  skillName: string
  fpCost: number
  source: string
}

const catalog = {
  veteranGreatsword: { name: '老兵特大剑', category: '特大剑', attack: 155, scaling: { strength: 'C' }, weight: 16, reach: 2.3, skill: 'catalog', skillName: '震荡波', fpCost: 15, source: '初期商店' },
  exileGreatsword: { name: '流放者特大剑', category: '特大剑', attack: 170, scaling: { strength: 'C' }, weight: 18, reach: 2.35, skill: 'catalog', skillName: '旋风斩', fpCost: 20, source: '法兰区域' },
  ashGreatsword: { name: '灰之特大剑', category: '特大剑', attack: 145, elemental: { type: '暗', damage: 30 }, scaling: { strength: 'D' }, weight: 15, reach: 2.3, skill: 'catalog', skillName: '灰烬冲击', fpCost: 20, source: '深渊 BOSS' },
  cathedralKnightGreatsword: { name: '教堂骑士特大剑', category: '特大剑', attack: 165, scaling: { strength: 'C' }, weight: 19, reach: 2.35, skill: 'catalog', skillName: '坚守', fpCost: 10, source: '教堂掉落' },
  blackKnightGreatsword: { name: '黑骑士特大剑', category: '特大剑', attack: 180, elemental: { type: '火', damage: 40 }, scaling: { strength: 'C' }, weight: 20, reach: 2.4, skill: 'catalog', skillName: '火焰旋转', fpCost: 25, source: '黑骑士掉落' },
  lorianGreatsword: { name: '洛里安大剑', category: '特大剑', attack: 190, elemental: { type: '火', damage: 60 }, scaling: { strength: 'B' }, weight: 22, reach: 2.45, skill: 'catalog', skillName: '地底爆发', fpCost: 30, source: '最终 BOSS' },
  vanhaltGreatsword: { name: '凡荷尔特大剑', category: '特大剑', attack: 150, elemental: { type: '雷', damage: 30 }, scaling: { strength: 'D' }, weight: 17, reach: 2.3, skill: 'catalog', skillName: '落雷', fpCost: 25, source: '皇宫塔楼' },

  straightSword: { name: '直剑', category: '大剑', attack: 105, scaling: { strength: 'D', dexterity: 'D' }, weight: 3, reach: 1.35, skill: 'holyGuard', skillName: '圣盾格挡', fpCost: 15, source: '骑士初始' },
  standardGreatsword: { name: '标准大剑', category: '大剑', attack: 115, scaling: { dexterity: 'E' }, weight: 6, reach: 1.75, skill: 'catalog', skillName: '横扫', fpCost: 12, source: '初期商店' },
  balmuk: { name: '巴尔穆克', category: '大剑', attack: 100, elemental: { type: '火', damage: 20 }, scaling: { dexterity: 'D' }, weight: 4, reach: 1.5, skill: 'catalog', skillName: '火焰附魔', fpCost: 18, source: '火焰区域' },
  crimson: { name: '克里姆森', category: '大剑', attack: 95, bleed: 45, scaling: { dexterity: 'C' }, weight: 3.5, reach: 1.45, skill: 'catalog', skillName: '出血突刺', fpCost: 15, source: '地下区域' },
  irithyllSword: { name: '伊鲁席尔直剑', category: '大剑', attack: 90, elemental: { type: '魔法', damage: 30 }, scaling: { dexterity: 'C' }, weight: 3, reach: 1.4, skill: 'catalog', skillName: '灵魂光线', fpCost: 18, source: '魔法学院' },
  scorchedEarth: { name: '燔烧三尺', category: '大剑', attack: 95, elemental: { type: '雷', damage: 25 }, scaling: { dexterity: 'D' }, weight: 4, reach: 1.5, skill: 'catalog', skillName: '雷电附魔', fpCost: 18, source: '皇宫前院' },
  astoraSword: { name: '亚斯特拉直剑', category: '大剑', attack: 85, hpRegen: 1, scaling: { dexterity: 'E' }, weight: 3.5, reach: 1.35, skill: 'catalog', skillName: '祝福', fpCost: 20, source: 'NPC 支线' },

  thiefDagger: { name: '盗贼短刀', category: '匕首', attack: 75, scaling: { dexterity: 'C' }, weight: 1.5, reach: 1.0, skill: 'daggerStep', skillName: '闪避步', fpCost: 10, source: '刺客初始（武器表）' },
  assassinsBlade: { name: '刺杀之刃', category: '匕首', attack: 65, bleed: 45, scaling: { dexterity: 'B' }, weight: 1, reach: 1.0, skill: 'catalog', skillName: '出血突刺', fpCost: 12, source: '盗贼区域' },
  shadowDagger: { name: '暗影匕首', category: '匕首', attack: 70, elemental: { type: '暗', damage: 15 }, scaling: { dexterity: 'C' }, weight: 1.2, reach: 1.0, skill: 'catalog', skillName: '暗影步', fpCost: 15, source: '皇宫地下通道' },
  needleSword: { name: '针剑', category: '匕首', attack: 55, bleed: 60, scaling: { dexterity: 'B' }, weight: 0.8, reach: 1.1, skill: 'catalog', skillName: '连刺', fpCost: 18, source: '后期商人' },
  occultDagger: { name: '秘仪短刀', category: '匕首', attack: 60, elemental: { type: '暗', damage: 20 }, scaling: { dexterity: 'B' }, weight: 1, reach: 1.0, skill: 'catalog', skillName: '暗之花', fpCost: 20, source: '隐藏 BOSS' },

  rapier: { name: '刺剑', category: '刺剑', attack: 95, scaling: { strength: 'D', dexterity: 'B' }, weight: 2.5, reach: 1.6, skill: 'flurry', skillName: '连续突刺', fpCost: 20, source: '刺客初始' },
  dagger: { name: '短刀', category: '匕首', attack: 70, scaling: { strength: 'E', dexterity: 'C' }, weight: 1, reach: 1.0, skill: 'daggerStep', skillName: '闪避步', fpCost: 10, source: '法师副手／牢房 D' },
  apprenticeStaff: { name: '学徒法杖', category: '法杖', attack: 60, scaling: { intelligence: 'C' }, weight: 2, reach: 1.3, skill: 'soulArrow', skillName: '追踪灵魂箭', fpCost: 15, source: '法师初始' },
  sageStaff: { name: '贤者法杖', category: '法杖', attack: 0, scaling: {}, weight: 2.5, reach: 1.3, skill: 'catalog', skillName: '火焰弹', fpCost: 20, source: '魔法学院' },
  courtMageStaff: { name: '宫廷法师法杖', category: '法杖', attack: 0, scaling: {}, weight: 3, reach: 1.3, skill: 'catalog', skillName: '光辉墙', fpCost: 25, source: '皇宫皇家书房' },
  crystalStaff: { name: '结晶法杖', category: '法杖', attack: 0, scaling: {}, weight: 3.5, reach: 1.3, skill: 'catalog', skillName: '暗之雨', fpCost: 35, source: '隐藏 BOSS' },
  mace: { name: '钉锤', category: '钉锤', attack: 85, scaling: { strength: 'D', faith: 'D' }, weight: 4, reach: 1.25, skill: 'blessing', skillName: '祝福', fpCost: 20, source: '牧师初始' },
  club: { name: '木棍', category: '木棍', attack: 40, scaling: {}, weight: 1, reach: 1.2, skill: 'none', skillName: '无', fpCost: 0, source: '一无所有者初始' },
} satisfies Record<string, WeaponDefinition>

export type WeaponId = keyof typeof catalog
export const weapons: Record<WeaponId, WeaponDefinition> = catalog

export interface OffhandDefinition {
  name: string
  kind: 'shield' | 'scripture'
  reduction: number
  parryBonusFrames: number
  stability: number
  weight: number
  source: string
  special?: string
}

const offhandCatalog = {
  leatherShield: { name: '小皮盾', kind: 'shield', reduction: 0.7, parryBonusFrames: 2, stability: 20, weight: 1.5, source: '刺客初始／初期商店', special: '弹反窗口 +2 帧' },
  kiteShield: { name: '鸢形盾', kind: 'shield', reduction: 0.85, parryBonusFrames: 0, stability: 45, weight: 3, source: '骑士初始' },
  knightShield: { name: '骑士盾', kind: 'shield', reduction: 0.9, parryBonusFrames: 0, stability: 55, weight: 5, source: '教堂掉落' },
  dragonShield: { name: '龙图纹盾', kind: 'shield', reduction: 0.95, parryBonusFrames: 0, stability: 65, weight: 12, source: '火山 BOSS', special: '火减 60%' },
  towerShield: { name: '塔盾', kind: 'shield', reduction: 0.98, parryBonusFrames: 0, stability: 75, weight: 14, source: '皇宫主殿二层', special: '格挡精耗减半' },
  woodenShield: { name: '木盾', kind: 'shield', reduction: 0.5, parryBonusFrames: 0, stability: 10, weight: 1, source: '一无所有者初始' },
  travelerScripture: { name: '旅人圣典', kind: 'scripture', reduction: 0, parryBonusFrames: 0, stability: 0, weight: 1.5, source: '牧师初始' },
  priestScripture: { name: '祭司圣典', kind: 'scripture', reduction: 0, parryBonusFrames: 0, stability: 0, weight: 2, source: '教堂商人' },
  saintScripture: { name: '圣人圣典', kind: 'scripture', reduction: 0, parryBonusFrames: 0, stability: 0, weight: 2.5, source: 'NPC 支线', special: '回复 +20%' },
  whiteScripture: { name: '白教圣典', kind: 'scripture', reduction: 0, parryBonusFrames: 0, stability: 0, weight: 3, source: '皇宫塔楼顶部', special: '雷祷言 +15%' },
} satisfies Record<string, OffhandDefinition>

export type OffhandGearId = keyof typeof offhandCatalog
export const offhandGear: Record<OffhandGearId, OffhandDefinition> = offhandCatalog

export const scalingCoefficients: Record<ScalingGrade, number> = {
  S: 1, A: 0.7, B: 0.5, C: 0.35, D: 0.2, E: 0.1,
}

export function weaponAttack(weapon: WeaponDefinition, attributes: CombatAttributes): number {
  const multiplier = 1 + (Object.entries(weapon.scaling) as [CombatAttribute, ScalingGrade][])
    .reduce((sum, [attribute, grade]) => sum
      + scalingCoefficients[grade] * (attributes[attribute] - 10) / 10, 0)
  return Math.max(0, (weapon.attack + (weapon.elemental?.damage ?? 0)) * multiplier)
}
