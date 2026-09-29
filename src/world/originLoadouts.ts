export const originLoadouts = {
  knight: { name: '骑士', level: 9, armor: ['骑士头盔', '骑士铠甲', '骑士腿甲', '骑士护手'],
    mainHand: '直剑', offHand: '鸢形盾', other: '原素瓶×3' },
  assassin: { name: '刺客', level: 10, armor: ['刺客兜帽', '刺客皮甲', '刺客腿甲', '刺客护手'],
    mainHand: '刺剑', offHand: '小皮盾', other: '原素瓶×3、飞镖×10、隐身术' },
  mage: { name: '法师', level: 6, armor: ['法师尖帽', '法师长袍', '法师腿布', '法师护手'],
    mainHand: '学徒法杖', offHand: '短刀', other: '原素瓶×3、灵魂箭' },
  cleric: { name: '牧师', level: 7, armor: ['牧师帽', '牧师长袍', '牧师腿布', '牧师护手'],
    mainHand: '钉锤', offHand: '旅人圣典', other: '原素瓶×3、小回复、光辉武器、神识' },
  wretch: { name: '一无所有者', level: 1, armor: ['破布头', '破布身', '破布腿', '破布手'],
    mainHand: '木棍', offHand: '木盾', other: '原素瓶×3' },
} as const

export type OriginId = keyof typeof originLoadouts
