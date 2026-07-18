export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

// Global toast queue (rune store) — transient confirmations that don't need
// a full Banner or block the UI. Mounted once via <Toast /> in the root layout.
class ToastStore {
  items = $state<ToastItem[]>([]);
  #nextId = 0;

  show(message: string, variant: ToastVariant = "info", duration = 4000): void {
    const id = this.#nextId++;
    this.items.push({ id, message, variant });

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string, duration?: number): void {
    this.show(message, "success", duration);
  }

  error(message: string, duration?: number): void {
    this.show(message, "error", duration);
  }

  dismiss(id: number): void {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toast = new ToastStore();
