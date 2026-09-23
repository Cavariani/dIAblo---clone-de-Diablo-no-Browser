// Fog of war overlay: one texel per cell, drawn with the iso affine transform (linear filtered = soft edges).
import { BufferImageSource, Matrix, Sprite, Texture } from 'pixi.js';
import type { TileMap } from '../../world/types';

export class FogRenderer {
  readonly sprite = new Sprite();
  private data: Uint8Array | null = null;
  private source: BufferImageSource | null = null;
  private version = -1;
  private map: TileMap | null = null;

  setMap(map: TileMap): void {
    this.map = map;
    this.data = new Uint8Array(map.width * map.height * 4);
    this.source = new BufferImageSource({ resource: this.data, width: map.width, height: map.height, format: 'rgba8unorm', scaleMode: 'linear' });
    this.sprite.texture = new Texture({ source: this.source });
    // texel (i, j) -> world cell (i, j) -> screen via the iso projection
    this.sprite.setFromMatrix(new Matrix(96, 48, -96, 48, 0, 0));
    this.version = -1;
    this.update();
  }

  update(): void {
    const m = this.map;
    if (!m || !this.data || !this.source) return;
    const v = (m as { fogVersion?: number }).fogVersion ?? 0;
    if (v === this.version) return;
    this.version = v;
    const d = this.data;
    for (let i = 0; i < m.width * m.height; i++) {
      const a = m.visible[i] ? 0 : m.explored[i] ? 110 : 255;
      d[i * 4] = 0;
      d[i * 4 + 1] = 0;
      d[i * 4 + 2] = 0;
      d[i * 4 + 3] = a;
    }
    this.source.update();
  }

  clear(): void {
    this.map = null;
    this.sprite.texture = Texture.EMPTY;
    this.source?.destroy();
    this.source = null;
  }
}
