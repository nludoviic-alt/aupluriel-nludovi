export function loadDefaultStake(): number {
  try {
    return Number(localStorage.getItem("lio23.default_stake") || 5);
  } catch {
    return 5;
  }
}

export function saveDefaultStake(val: number): void {
  try {
    localStorage.setItem("lio23.default_stake", String(val));
  } catch {
    /* ignore */
  }
}
