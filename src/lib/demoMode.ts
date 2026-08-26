export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

export class DemoWriteBlockedError extends Error {
  constructor() {
    super("This is a live demo — changes aren't saved.");
    this.name = 'DemoWriteBlockedError';
  }
}

export function assertWritable(): void {
  if (isDemoMode) throw new DemoWriteBlockedError();
}
