// Whether this learner has paid for premium (level 6+ and Mutprobe 6+).
// There is no payment yet, so everyone is on the free plan. When accounts and
// payment exist, this reads the verified purchase; nothing else has to change.
export function usePaid(): boolean {
  return false;
}
