import { cloneGeometry, type TakeoffGeometry } from './takeoffGeometry';

export interface UndoEntry {
  itemId: string;
  geometry: TakeoffGeometry;
  quantity: number;
}

export class UndoStack {
  private undo: UndoEntry[] = [];
  private redo: UndoEntry[] = [];
  private max = 80;

  push(entry: UndoEntry) {
    this.undo.push(entry);
    if (this.undo.length > this.max) this.undo.shift();
    this.redo = [];
  }

  canUndo(): boolean { return this.undo.length > 0; }
  canRedo(): boolean { return this.redo.length > 0; }

  undoStep(): UndoEntry | null {
    const entry = this.undo.pop();
    if (!entry) return null;
    this.redo.push(entry);
    return entry;
  }

  redoStep(): UndoEntry | null {
    const entry = this.redo.pop();
    if (!entry) return null;
    this.undo.push(entry);
    return entry;
  }

  snapshot(itemId: string, geometry: TakeoffGeometry, quantity: number): UndoEntry {
    return { itemId, geometry: cloneGeometry(geometry), quantity };
  }

  clear() {
    this.undo = [];
    this.redo = [];
  }
}
