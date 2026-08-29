/**
 * Turning stored traffic settings into the percentages people actually read.
 *
 * Two facts are stored separately and on purpose (see `Experiment.controlWeight` in
 * schema.prisma): `trafficAllocation` decides how many visitors enter the experiment at all,
 * and the per-arm weights decide how the entered share is divided. Keeping them apart means
 * neither can drift from the other — but nobody thinks in "relative weight within the included
 * portion", so every screen composes them into one set of percentages of *total* traffic that
 * add up to 100.
 *
 * Shared by the wizard, the edit form, the experiment detail page and the public share page,
 * so a split is never displayed two subtly different ways.
 */

export interface ArmShares {
  /** Percentage of total site traffic reaching control. */
  control: number;
  /** Percentage of total site traffic reaching each variant, in the given order. */
  variants: number[];
  /** Percentage never entered into the experiment: `100 - trafficAllocation`. */
  excluded: number;
}

/**
 * Distributes a whole-number total across values, so displayed percentages always sum to
 * exactly `total` rather than showing a rounding shortfall. Largest-remainder, which puts the
 * leftover point on the arm with the strongest claim to it.
 */
export function roundToTotal(values: number[], total: number): number[] {
  const floors = values.map(Math.floor);
  const shortfall = total - floors.reduce((sum, value) => sum + value, 0);

  const order = values
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  const result = [...floors];
  for (let i = 0; i < shortfall; i += 1) {
    const target = order[i % order.length];
    if (target) result[target.index] = result[target.index]! + 1;
  }
  return result;
}

/**
 * Composes stored weights and allocation into percentages of total site traffic.
 *
 * Falls back to an even split across the arms when every weight is zero — a state validation
 * rejects, but a display helper must not divide by zero over data that somehow reached it.
 */
export function armShares(input: {
  controlWeight: number;
  variantWeights: number[];
  trafficAllocation: number;
}): ArmShares {
  const included = Math.min(Math.max(input.trafficAllocation, 0), 100);
  const excluded = 100 - included;

  const raw = [input.controlWeight, ...input.variantWeights].map((weight) =>
    Number.isFinite(weight) && weight > 0 ? weight : 0,
  );
  const totalWeight = raw.reduce((sum, weight) => sum + weight, 0);

  const scaled =
    totalWeight > 0
      ? raw.map((weight) => (weight / totalWeight) * included)
      : raw.map(() => included / raw.length);

  const [control = 0, ...variants] = roundToTotal([...scaled, excluded], 100);

  return { control, variants: variants.slice(0, input.variantWeights.length), excluded };
}
