import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Material } from '@babylonjs/core/Materials/material'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Scene } from '@babylonjs/core/scene'

function pixelTexture(scene: Scene, path: string): Texture {
  const texture = new Texture(path, scene)
  texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE)
  return texture
}

export function tileMaterial(scene: Scene, name: string, file: string, repeat = 1): StandardMaterial {
  const material = new StandardMaterial(name, scene)
  const texture = pixelTexture(scene, `/assets/materials/${file}_64x64.png`)
  texture.uScale = repeat
  texture.vScale = repeat
  material.diffuseTexture = texture
  material.diffuseColor = Color3.White()
  material.specularColor = Color3.Black()
  return material
}

export function pixelSprite(scene: Scene, name: string, path: string,
  width: number, height: number, x: number, y: number, z: number,
  crop?: { left: number; right: number; top: number; bottom: number }): Mesh {
  const mesh = MeshBuilder.CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene)
  mesh.position.set(x, y, z)
  const material = new StandardMaterial(`${name} pixel art`, scene)
  const texture = pixelTexture(scene, path)
  texture.hasAlpha = true
  if (crop) {
    texture.uOffset = crop.left
    texture.uScale = crop.right - crop.left
    texture.vOffset = crop.top
    texture.vScale = crop.bottom - crop.top
  }
  material.diffuseTexture = texture
  material.useAlphaFromDiffuseTexture = true
  material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND
  material.diffuseColor = Color3.White()
  material.specularColor = Color3.Black()
  material.backFaceCulling = false
  mesh.material = material
  return mesh
}

export function propSprite(scene: Scene, name: string, file: string,
  width: number, height: number, x: number, y: number, z: number): Mesh {
  const left = file === 'wall_torch' ? 0.16 : 0.09
  return pixelSprite(scene, name, `/assets/props/${file}_256.png`, width, height, x, y, z,
    { left, right: 0.91, top: 0.09, bottom: 0.91 })
}
