import type { GameSnapshot } from '../game/GameRuntime'
import { offhandGear, weapons, weaponAttack, type CombatAttribute } from '../world/weaponCatalog'

const attributeLabels: Record<CombatAttribute, string> = {
  strength: '力', dexterity: '敏', intelligence: '智', faith: '信',
}

export function WeaponCatalog({ snapshot }: { snapshot: GameSnapshot }) {
  const ownedWeapons = new Set(snapshot.weaponOptions)
  const ownedOffhands = new Set(snapshot.offhandOptions)
  const categories = [...new Set(Object.values(weapons).map(weapon => weapon.category))]

  return <details className="weapon-catalog">
    <summary>武器图鉴 · {Object.keys(weapons).length} 件武器 / {Object.keys(offhandGear).length} 件副手</summary>
    <p className="catalog-note">按 GDD 地点取得；未开放地区的装备暂时锁定。预估伤害含当前属性补正。后续战技与特效随关卡接入。</p>
    {categories.map(category => <div key={category} className="catalog-group">
      <h3>{category}</h3>
      {Object.entries(weapons).filter(([, weapon]) => weapon.category === category).map(([id, weapon]) => {
        const owned = ownedWeapons.has(id as keyof typeof weapons)
        const scaling = Object.entries(weapon.scaling)
          .map(([attribute, grade]) => `${attributeLabels[attribute as CombatAttribute]}${grade}`).join(' · ')
        return <div key={id} className={`catalog-item${owned ? ' owned' : ''}`}>
          <div className="catalog-item-heading"><strong>{weapon.name}</strong><span>{owned ? snapshot.equipmentRecovered ? '已拥有' : '没收中' : '未取得'}</span></div>
          <div>物理 {weapon.attack || '未定义'}{weapon.elemental && ` + ${weapon.elemental.type} ${weapon.elemental.damage}`}
            {weapon.attack > 0 && ` · 补正后 ${Math.round(weaponAttack(weapon, snapshot.attributes))}`}</div>
          <div>补正 {scaling || '无'} · 重 {weapon.weight} · {weapon.skillName} / {weapon.fpCost} FP</div>
          {(weapon.bleed || weapon.hpRegen) && <div>{weapon.bleed ? `出血 ${weapon.bleed}` : ''}{weapon.hpRegen ? ` 生命回复 +${weapon.hpRegen}` : ''}</div>}
          <div>来源 · {weapon.source}</div>
        </div>
      })}
    </div>)}
    <div className="catalog-group"><h3>盾牌与圣典</h3>
      {Object.entries(offhandGear).map(([id, item]) => <div key={id}
        className={`catalog-item${ownedOffhands.has(id as keyof typeof offhandGear) ? ' owned' : ''}`}>
        <div className="catalog-item-heading"><strong>{item.name}</strong><span>{ownedOffhands.has(id as keyof typeof offhandGear)
          ? snapshot.equipmentRecovered ? '已拥有' : '没收中' : '未取得'}</span></div>
        <div>{item.kind === 'shield' ? `减伤 ${Math.round(item.reduction * 100)}% · 稳定 ${item.stability}` : '祷言媒介'} · 重 {item.weight}</div>
        {item.special && <div>{item.special}</div>}
        <div>来源 · {item.source}</div>
      </div>)}
    </div>
  </details>
}
