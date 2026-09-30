export interface Actor {
  health: number
  maxHealth: number
  stamina: number
  maxStamina: number
  fp: number
  maxFp: number
}

export type AttackPhase = 'idle' | 'startup' | 'active' | 'recovery'
export type AttackKind = 'light' | 'heavy' | 'shieldBash'

export interface AttackState {
  phase: AttackPhase
  kind: AttackKind
  elapsed: number
  hitTarget: boolean
  staminaDelay: number
  damageMultiplier: number
  jumping: boolean
}

export interface Hurtbox {
  x: number
  y: number
  halfWidth: number
  height: number
}

export interface CombatState {
  player: Actor
  enemy: Actor
  attack: AttackState
  defense: DefenseState
  flasks: number
  maxFlasks: number
}

export type DefenseMode = 'idle' | 'parry' | 'guard' | 'dodge' | 'stagger'

export interface DefenseState {
  mode: DefenseMode
  elapsed: number
  cooldown: number
  direction: -1 | 1
  counterRemaining: number
  dodgeAttackRemaining: number
}

export type HitOutcome = 'hit' | 'blocked' | 'parried' | 'dodged' | 'guardBroken'

export const attackDefinitions = {
  light: { damage: 25, staminaCost: 14, startup: 0.11, active: 0.15, recovery: 0.25, reach: 1.35, height: 1.2 },
  heavy: { damage: 40, staminaCost: 24, startup: 0.28, active: 0.18, recovery: 0.38, reach: 1.55, height: 1.35 },
  shieldBash: { damage: 12, staminaCost: 16, startup: 0.18, active: 0.16,
    recovery: 0.35, reach: 1.05, height: 1.25 },
} as const

export type SpellKind = 'soulArrow' | 'smallHeal' | 'radiantWeapon' | 'divineSight'
  | 'holyGuard' | 'flurry' | 'blessing' | 'daggerStep'
export const spellCosts: Record<SpellKind, number> = {
  soulArrow: 15, smallHeal: 20, radiantWeapon: 30, divineSight: 15,
  holyGuard: 15, flurry: 20, blessing: 20, daggerStep: 10,
}

export function initialCombat(maxFp = 50): CombatState {
  return {
    player: { health: 350, maxHealth: 350, stamina: 90, maxStamina: 90, fp: maxFp, maxFp },
    enemy: { health: 80, maxHealth: 80, stamina: 0, maxStamina: 0, fp: 0, maxFp: 0 },
    attack: { phase: 'idle', kind: 'light', elapsed: 0, hitTarget: false, staminaDelay: 0, damageMultiplier: 1,
      jumping: false },
    defense: { mode: 'idle', elapsed: 0, cooldown: 0, direction: 1, counterRemaining: 0, dodgeAttackRemaining: 0 },
    flasks: 3,
    maxFlasks: 3,
  }
}

export function setMaxFp(state: CombatState, maxFp: number): CombatState {
  return { ...state, player: { ...state.player, fp: maxFp, maxFp } }
}

export function castSpell(state: CombatState, spell: SpellKind): CombatState {
  if (state.player.health <= 0 || state.player.fp < spellCosts[spell]
    || (spell === 'smallHeal' || spell === 'blessing')
      && state.player.health >= state.player.maxHealth) return state
  return { ...state, player: { ...state.player,
    fp: state.player.fp - spellCosts[spell],
    health: spell === 'smallHeal' || spell === 'blessing'
      ? Math.min(state.player.maxHealth, state.player.health
        + Math.ceil(state.player.maxHealth * (spell === 'smallHeal' ? 0.3 : 0.2)))
      : state.player.health } }
}

export function useDaggerStep(state: CombatState, direction: -1 | 1): CombatState {
  if (state.attack.phase !== 'idle' || state.defense.mode !== 'idle' || state.defense.cooldown > 0) return state
  const charged = castSpell(state, 'daggerStep')
  if (charged === state) return state
  return { ...charged,
    defense: { ...charged.defense, mode: 'dodge', elapsed: 0, cooldown: 0.5, direction } }
}

export function useFlask(state: CombatState): CombatState {
  if (state.flasks <= 0 || state.player.health <= 0 || state.player.health >= state.player.maxHealth) return state
  return {
    ...state,
    flasks: state.flasks - 1,
    player: { ...state.player, health: Math.min(state.player.maxHealth,
      state.player.health + Math.ceil(state.player.maxHealth * 0.4)) },
  }
}

export function addFlaskCapacity(state: CombatState): CombatState {
  return { ...state, flasks: state.flasks + 1, maxFlasks: state.maxFlasks + 1 }
}

export function refillAtCheckpoint(state: CombatState): CombatState {
  const fresh = initialCombat()
  return { ...state, enemy: fresh.enemy, attack: fresh.attack, defense: fresh.defense, flasks: state.maxFlasks,
    player: { ...state.player, health: state.player.maxHealth, stamina: state.player.maxStamina,
      fp: state.player.maxFp } }
}

export function stepDefense(
  state: CombatState,
  input: { pressed: boolean; held: boolean; sprinting: boolean; direction: -1 | 0 | 1; shieldReduction: number },
  deltaTime: number,
): CombatState {
  const dt = Math.max(0, Math.min(deltaTime, 1 / 30))
  const defense = { ...state.defense, elapsed: state.defense.elapsed + dt,
    cooldown: Math.max(0, state.defense.cooldown - dt),
    counterRemaining: Math.max(0, state.defense.counterRemaining - dt),
    dodgeAttackRemaining: Math.max(0, state.defense.dodgeAttackRemaining - dt) }
  const player = { ...state.player }
  if (defense.mode === 'stagger' && defense.elapsed >= 1
    || defense.mode === 'dodge' && defense.elapsed >= 0.2) {
    if (defense.mode === 'dodge') defense.dodgeAttackRemaining = 0.2
    defense.mode = 'idle'
    defense.elapsed = 0
  } else if (defense.mode === 'parry' && defense.elapsed >= 0.25) {
    defense.mode = input.held && state.attack.phase === 'idle' ? 'guard' : 'idle'
    defense.elapsed = 0
  }
  if (defense.mode === 'idle' && state.attack.phase === 'idle'
    && input.pressed && input.sprinting && input.direction !== 0
    && defense.cooldown === 0 && player.stamina >= 20) {
    player.stamina -= 20
    defense.mode = 'dodge'
    defense.elapsed = 0
    defense.cooldown = 0.5
    defense.direction = input.direction
  } else if (defense.mode === 'idle' && state.attack.phase === 'idle'
    && input.pressed && input.shieldReduction > 0 && player.stamina >= 10) {
    player.stamina -= 10
    defense.mode = 'parry'
    defense.elapsed = 0
  } else if (defense.mode === 'idle' && state.attack.phase === 'idle'
    && input.held && input.shieldReduction > 0) {
    defense.mode = 'guard'
    defense.elapsed = 0
  } else if (defense.mode === 'guard' && !input.held) {
    defense.mode = 'idle'
    defense.elapsed = 0
  }
  if (player.stamina !== state.player.stamina) return { ...state, player,
    attack: { ...state.attack, staminaDelay: 0.4 }, defense }
  return { ...state, defense }
}

export function resolveIncomingHit(
  state: CombatState, damage: number, shieldReduction: number, facingAttacker: boolean,
  parryBonusFrames = 0,
): { state: CombatState; outcome: HitOutcome } {
  const defense = state.defense
  if (defense.mode === 'dodge' && defense.elapsed >= 2 / 60 && defense.elapsed <= 6 / 60) {
    return { state, outcome: 'dodged' }
  }
  if (facingAttacker && shieldReduction > 0 && defense.mode === 'parry'
    && defense.elapsed >= 3 / 60 && defense.elapsed <= (8 + parryBonusFrames) / 60) {
    return { state: { ...state, defense: { ...defense, mode: 'guard', elapsed: 0 } }, outcome: 'parried' }
  }
  if (facingAttacker && shieldReduction > 0 && defense.mode === 'guard') {
    const staminaCost = damage * 0.6
    if (state.player.stamina >= staminaCost) {
      return { state: { ...state, defense: { ...defense, counterRemaining: 0.5 },
        player: { ...state.player, health: Math.max(0, state.player.health - Math.ceil(damage * (1 - shieldReduction))),
          stamina: state.player.stamina - staminaCost },
        attack: { ...state.attack, staminaDelay: 0.4 } }, outcome: 'blocked' }
    }
    return { state: { ...state, player: { ...state.player,
      health: Math.max(0, state.player.health - damage), stamina: 0 },
      defense: { ...defense, mode: 'stagger', elapsed: 0 },
      attack: { ...state.attack, staminaDelay: 0.4 } }, outcome: 'guardBroken' }
  }
  return { state: damagePlayer(state, damage), outcome: 'hit' }
}

export function boxesOverlap(a: Hurtbox, b: Hurtbox): boolean {
  return Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth
    && a.y < b.y + b.height
    && a.y + a.height > b.y
}

export function stepCombat(
  state: CombatState,
  attackPressed: boolean,
  playerX: number,
  playerY: number,
  facing: -1 | 1,
  enemyX: number,
  deltaTime: number,
  sprinting = false,
  enemyY = 0,
  heavyPressed = false,
  weaponPower = 1,
  weaponReach: number = attackDefinitions.light.reach,
  airborne = false,
  enemyDamageMultiplier = 1,
  shieldBashPressed = false,
): CombatState {
  const dt = Math.max(0, Math.min(deltaTime, 1 / 30))
  const player = { ...state.player }
  const enemy = { ...state.enemy }
  const attack = { ...state.attack }
  const defense = { ...state.defense }

  const requestedKind: AttackKind = shieldBashPressed ? 'shieldBash' : heavyPressed ? 'heavy' : 'light'
  if (attack.phase === 'idle' && (attackPressed || heavyPressed || shieldBashPressed)
    && state.defense.mode !== 'dodge' && state.defense.mode !== 'parry' && state.defense.mode !== 'stagger'
    && player.stamina >= attackDefinitions[requestedKind].staminaCost) {
    attack.kind = requestedKind
    attack.jumping = requestedKind === 'heavy' && airborne
    attack.damageMultiplier = requestedKind === 'shieldBash' ? 1
      : (requestedKind === 'light' && defense.counterRemaining > 0 ? 0.8
        : requestedKind === 'light' && defense.dodgeAttackRemaining > 0 ? 0.9 : 1) * weaponPower
    if (defense.mode === 'guard') defense.mode = 'idle'
    defense.counterRemaining = 0
    defense.dodgeAttackRemaining = 0
    player.stamina -= attackDefinitions[requestedKind].staminaCost
    attack.phase = 'startup'
    attack.elapsed = 0
    attack.hitTarget = false
    attack.staminaDelay = 0.4
  }

  if (attack.phase !== 'idle') {
    attack.elapsed += dt
    const duration = attackDefinitions[attack.kind][attack.phase]
    if (attack.elapsed >= duration) {
      attack.elapsed -= duration
      attack.phase = attack.phase === 'startup'
        ? 'active'
        : attack.phase === 'active' ? 'recovery' : 'idle'
    }
  }

  if (attack.phase === 'active' && !attack.hitTarget && enemy.health > 0) {
    const definition = attackDefinitions[attack.kind]
    const reach = weaponReach * definition.reach / attackDefinitions.light.reach
    const hitbox: Hurtbox = {
      x: playerX + facing * (0.35 + reach / 2),
      y: playerY + 0.35,
      halfWidth: reach / 2,
      height: definition.height,
    }
    const enemyHurtbox: Hurtbox = {
      x: enemyX,
      y: enemyY,
      halfWidth: 0.45,
      height: 1.8,
    }
    if (boxesOverlap(hitbox, enemyHurtbox)) {
      enemy.health = Math.max(0, enemy.health - definition.damage * attack.damageMultiplier
        * enemyDamageMultiplier)
      attack.hitTarget = true
    }
  }

  if (sprinting) {
    player.stamina = Math.max(0, player.stamina - 10 * dt)
    attack.staminaDelay = 0.4
  } else {
    attack.staminaDelay = Math.max(0, attack.staminaDelay - dt)
  }
  if (attack.staminaDelay === 0) {
    player.stamina = Math.min(player.maxStamina, player.stamina + 45 * dt)
  }

  return { ...state, player, enemy, attack, defense }
}

export function damagePlayer(state: CombatState, damage: number): CombatState {
  return {
    ...state,
    player: { ...state.player, health: Math.max(0, state.player.health - Math.max(0, damage)) },
  }
}
