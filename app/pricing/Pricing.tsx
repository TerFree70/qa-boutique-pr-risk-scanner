export function Pricing() {
  const monthlyPrice = 99;
  const annualDiscount = 0.2;
  const annualPrice = monthlyPrice * 12 * (1 - annualDiscount);

  return {
    monthlyPrice,
    annualPrice,
  };
}
