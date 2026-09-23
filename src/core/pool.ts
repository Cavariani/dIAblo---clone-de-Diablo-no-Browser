// Generic object pool. Use for particles, projectiles, floating texts, damage packets, etc.

export class Pool<T> {
  private free: T[] = [];
  private created = 0;

  constructor(
    private readonly factory: () => T,
    private readonly reset?: (obj: T) => void,
    prewarm = 0,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(this.make());
  }

  private make(): T {
    this.created++;
    return this.factory();
  }

  acquire(): T {
    return this.free.pop() ?? this.make();
  }

  release(obj: T): void {
    this.reset?.(obj);
    this.free.push(obj);
  }

  get size(): number {
    return this.free.length;
  }

  get totalCreated(): number {
    return this.created;
  }
}
