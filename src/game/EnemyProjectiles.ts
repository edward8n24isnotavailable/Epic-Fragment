import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Scene } from '@babylonjs/core/scene'
import type { WorldZone } from '../world/prisonLayout'
import type { EncounterId } from './encounters'
import { makeMaterial } from './prisonScene'

interface Projectile {
  mesh: Mesh
  ownerId: EncounterId
  name: string
  damage: number
  x: number
  y: number
  direction: -1 | 1
  speed: number
  remaining: number
  zone: WorldZone
}

export class EnemyProjectiles {
  private readonly projectiles: Projectile[] = []
  private readonly emberMaterial
  private readonly shadowMaterial

  constructor(private readonly scene: Scene) {
    this.emberMaterial = makeMaterial(scene, 'enemy ember projectile',
      new Color3(0.95, 0.34, 0.1), new Color3(0.6, 0.11, 0.02))
    this.shadowMaterial = makeMaterial(scene, 'enemy shadow projectile',
      new Color3(0.45, 0.26, 0.64), new Color3(0.23, 0.1, 0.4))
  }

  spawn(ownerId: EncounterId, name: string, damage: number, speed: number,
    x: number, y: number, direction: -1 | 1, zone: WorldZone): void {
    const mesh = MeshBuilder.CreateSphere(`enemy projectile ${name}`, { diameter: 0.28 }, this.scene)
    mesh.material = ownerId === 'warden' ? this.shadowMaterial : this.emberMaterial
    mesh.position.set(x, y, -0.15)
    this.projectiles.push({ mesh, ownerId, name, damage, speed, x, y, direction,
      remaining: 1.25, zone })
  }

  step(dt: number, playerX: number, playerY: number, zone: WorldZone,
    onHit: (projectile: { ownerId: EncounterId; name: string; damage: number; x: number }) => void): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index]
      projectile.remaining -= dt
      projectile.x += projectile.direction * projectile.speed * dt
      projectile.mesh.position.x = projectile.x
      const hit = projectile.zone === zone && Math.abs(projectile.x - playerX) <= 0.42
        && Math.abs(projectile.y - (playerY + 1)) <= 0.55
      if (hit) onHit(projectile)
      if (hit || projectile.remaining <= 0 || projectile.zone !== zone) {
        projectile.mesh.dispose()
        this.projectiles.splice(index, 1)
      }
    }
  }

  clear(): void {
    for (const projectile of this.projectiles) projectile.mesh.dispose()
    this.projectiles.length = 0
  }
}
