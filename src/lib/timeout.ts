/**
 * Races a promise against a timer so a hung network/auth call can never leave the app
 * stuck on a loading screen forever — e.g. Supabase's session lock occasionally never
 * releases after a mobile browser suspends/kills a backgrounded tab.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}
