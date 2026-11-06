// Generic object pool. Callers supply a factory returning a new item with
// `.active = false` initially; acquire() returns the first inactive item, or
// grows the pool up to maxSize, or returns null if exhausted.
//
// Items are never destroyed. Releasing = setting `.active = false` (done by
// the caller, since item-specific reset logic lives there).
export class ObjectPool {
  constructor(factory, maxSize = 64) {
    this.factory = factory;
    this.items = [];
    this.maxSize = maxSize;
  }

  acquire() {
    for (const item of this.items) {
      if (!item.active) return item;
    }
    if (this.items.length >= this.maxSize) return null;
    const item = this.factory();
    this.items.push(item);
    return item;
  }

  forEachActive(fn) {
    for (const item of this.items) {
      if (item.active) fn(item);
    }
  }

  countActive() {
    let n = 0;
    for (const item of this.items) if (item.active) n++;
    return n;
  }
}
