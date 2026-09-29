import { applyPoiseDamage, initialPoise, stepPoise, type PoiseState } from './poise'

export type EnemyMode = 'patrol' | 'chase' | 'windup' | 'active' | 'recovery' | 'hit' | 'dead'

export interface EnemyAttack {
  name: string
  range: number
  damage: number
  windup: number
  active: number
  recovery: number
  verticalRange?: number
  minimumRange?: number
  lungeSpeed?: number
  groundOnly?: boolean
  allAround?: boolean
  displacement?: number
  projectileSpeed?: number
}

export interface EnemyProfile {
  detectRange: number
  chaseSpeed: number
  attacks: readonly EnemyAttack[]
}

export interface EnemyState {
  x: number
  spawnX: number
  facing: -1 | 1
  mode: EnemyMode
  elapsed: number
  hitPlayer: boolean
  attackIndex: number
  activeAttack: number
  poise: PoiseState
}

export interface EnemyStep {
  enemy: EnemyState
  playerDamage: number
  playerDisplacement: number
  projectile: { damage: number; speed: number; name: string } | null
}

export const enemyDefinition = {
  patrolSpeed: 1.1,
  chaseSpeed: 2.3,
  patrolRadius: 1.2,
  detectRange: 4.8,
  attackRange: 1.3,
  windup: 0.6,
  active: 0.16,
  recovery: 0.8,
  hitStun: 0.25,
  damage: 25,
  souls: 50,
} as const

export const basicEnemyProfile: EnemyProfile = {
  detectRange: enemyDefinition.detectRange,
  chaseSpeed: enemyDefinition.chaseSpeed,
  attacks: [{ name: '横斩', range: enemyDefinition.attackRange,
    damage: enemyDefinition.damage, windup: enemyDefinition.windup,
    active: enemyDefinition.active, recovery: enemyDefinition.recovery }],
}

export function initialEnemy(spawnX = 4, maxPoise = 50): EnemyState {
  return { x: spawnX, spawnX, facing: -1, mode: 'patrol', elapsed: 0, hitPlayer: false,
    attackIndex: 0, activeAttack: 0,
    poise: initialPoise(maxPoise) }
}

export function applyEnemyHit(state: EnemyState, remainingHealth: number, poiseDamage = 0): EnemyState {
  const poise = applyPoiseDamage(state.poise, poiseDamage)
  return {
    ...state,
    poise: poise.state,
    mode: remainingHealth <= 0 ? 'dead' : poise.broke ? 'hit' : state.mode,
    elapsed: remainingHealth <= 0 || poise.broke ? 0 : state.elapsed,
    hitPlayer: remainingHealth <= 0 || poise.broke ? false : state.hitPlayer,
  }
}

function nextAttack(profile: EnemyProfile, startIndex: number, distance: number,
  heightDifference: number): number | null {
  for (let offset = 0; offset < profile.attacks.length; offset += 1) {
    const index = (startIndex + offset) % profile.attacks.length
    const attack = profile.attacks[index]
    if (distance >= (attack.minimumRange ?? 0) && distance <= attack.range
      && heightDifference < (attack.verticalRange ?? 1.3)) return index
  }
  return null
}

export function enemyAttackName(state: EnemyState, profile: EnemyProfile = basicEnemyProfile): string | null {
  return state.mode === 'windup' || state.mode === 'active'
    ? profile.attacks[state.activeAttack % profile.attacks.length]?.name ?? null : null
}

export function stepEnemy(state: EnemyState, playerX: number, playerY: number, dt: number,
  enemyY = 0, profile: EnemyProfile = basicEnemyProfile): EnemyStep {
  if (state.mode === 'dead') return { enemy: state, playerDamage: 0, playerDisplacement: 0, projectile: null }
  const elapsedTime = Math.max(0, Math.min(dt, 1 / 30))
  const poise = stepPoise(state.poise, elapsedTime)
  if (poise.exhaustedRemaining > 0) return { enemy: { ...state, poise, mode: 'hit', elapsed: 0 },
    playerDamage: 0, playerDisplacement: 0, projectile: null }
  const recovered = state.poise.exhaustedRemaining > 0
  const enemy = { ...state, poise, mode: recovered ? 'chase' as EnemyMode : state.mode,
    elapsed: recovered ? 0 : state.elapsed + elapsedTime }
  const distance = Math.abs(playerX - enemy.x)
  const heightDifference = Math.abs(playerY - enemyY)
  let playerDamage = 0
  let playerDisplacement = 0
  let projectile: EnemyStep['projectile'] = null
  const attack = profile.attacks[enemy.activeAttack % profile.attacks.length]

  switch (enemy.mode) {
    case 'patrol':
      if (distance < profile.detectRange && heightDifference < 1.3) {
        enemy.mode = 'chase'
        enemy.elapsed = 0
      } else {
        enemy.x += enemy.facing * enemyDefinition.patrolSpeed * elapsedTime
        if (Math.abs(enemy.x - enemy.spawnX) >= enemyDefinition.patrolRadius) {
          enemy.x = enemy.spawnX + Math.sign(enemy.x - enemy.spawnX) * enemyDefinition.patrolRadius
          enemy.facing = enemy.facing === 1 ? -1 : 1
        }
      }
      break
    case 'chase': {
      enemy.facing = playerX < enemy.x ? -1 : 1
      if (distance > profile.detectRange * 1.6) {
        enemy.mode = 'patrol'
        enemy.elapsed = 0
      } else {
        const selected = nextAttack(profile, enemy.attackIndex, distance, heightDifference)
        if (selected !== null) {
          enemy.activeAttack = selected
          enemy.mode = 'windup'
          enemy.elapsed = 0
        } else enemy.x += enemy.facing * profile.chaseSpeed * elapsedTime
      }
      break
    }
    case 'windup':
      if (enemy.elapsed >= attack.windup) {
        enemy.mode = 'active'
        enemy.elapsed = 0
        enemy.hitPlayer = false
      }
      break
    case 'active': {
      if (attack.lungeSpeed) enemy.x += enemy.facing * attack.lungeSpeed * elapsedTime
      if (attack.projectileSpeed && !enemy.hitPlayer) {
        projectile = { damage: attack.damage, speed: attack.projectileSpeed, name: attack.name }
        enemy.hitPlayer = true
      }
      const hitDistance = Math.abs(playerX - enemy.x)
      const inFront = attack.allAround || enemy.facing * (playerX - enemy.x) >= -0.2
      if (!attack.projectileSpeed && !enemy.hitPlayer && inFront && hitDistance <= attack.range + 0.25
        && heightDifference < (attack.verticalRange ?? 1.3)
        && (!attack.groundOnly || heightDifference < 0.3)) {
        playerDamage = attack.damage
        playerDisplacement = (attack.displacement ?? 0) * Math.sign(playerX - enemy.x)
        enemy.hitPlayer = true
      }
      if (enemy.elapsed >= attack.active) {
        enemy.mode = 'recovery'
        enemy.elapsed = 0
        enemy.attackIndex = (enemy.activeAttack + 1) % profile.attacks.length
      }
      break
    }
    case 'recovery':
      if (enemy.elapsed >= attack.recovery) {
        enemy.mode = 'chase'
        enemy.elapsed = 0
      }
      break
    case 'hit':
      if (enemy.elapsed >= enemyDefinition.hitStun) {
        enemy.mode = 'chase'
        enemy.elapsed = 0
      }
      break
  }

  return { enemy, playerDamage, playerDisplacement, projectile }
}
