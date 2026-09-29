export interface Actor {
  health: number
  maxHealth: number
  stamina: number
  maxStamina: number
}

export type AttackPhase = 'idle' | 'startup' | 'active' | 'recovery'

export interface AttackState {
  phase: AttackPhase
  elapsed: number
  hitTarget: boolean
  staminaDelay: number
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
}

export const attackDefinition = {
  damage: 25,
  staminaCost: 14,
  startup: 0.11,
  active: 0.15,
  recovery: 0.25,
  reach: 1.35,
  height: 1.2,
} as const

export function initialCombat(): CombatState {
  return {
    player: { health: 350, maxHealth: 350, stamina: 90, maxStamina: 90 },
    enemy: { health: 80, maxHealth: 80, stamina: 0, maxStamina: 0 },
    attack: { phase: 'idle', elapsed: 0, hitTarget: false, staminaDelay: 0 },
  }
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
): CombatState {
  const dt = Math.max(0, Math.min(deltaTime, 1 / 30))
  const player = { ...state.player }
  const enemy = { ...state.enemy }
  const attack = { ...state.attack }

  if (attack.phase === 'idle' && attackPressed && player.stamina >= attackDefinition.staminaCost) {
    player.stamina -= attackDefinition.staminaCost
    attack.phase = 'startup'
    attack.elapsed = 0
    attack.hitTarget = false
    attack.staminaDelay = 0.4
  }

  if (attack.phase !== 'idle') {
    attack.elapsed += dt
    const duration = attackDefinition[attack.phase]
    if (attack.elapsed >= duration) {
      attack.elapsed -= duration
      attack.phase = attack.phase === 'startup'
        ? 'active'
        : attack.phase === 'active' ? 'recovery' : 'idle'
    }
  }

  if (attack.phase === 'active' && !attack.hitTarget && enemy.health > 0) {
    const hitbox: Hurtbox = {
      x: playerX + facing * 0.95,
      y: playerY + 0.35,
      halfWidth: attackDefinition.reach / 2,
      height: attackDefinition.height,
    }
    const enemyHurtbox: Hurtbox = {
      x: enemyX,
      y: enemyY,
      halfWidth: 0.45,
      height: 1.8,
    }
    if (boxesOverlap(hitbox, enemyHurtbox)) {
      enemy.health = Math.max(0, enemy.health - attackDefinition.damage)
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

  return { player, enemy, attack }
}

export function damagePlayer(state: CombatState, damage: number): CombatState {
  return {
    ...state,
    player: { ...state.player, health: Math.max(0, state.player.health - Math.max(0, damage)) },
  }
}
