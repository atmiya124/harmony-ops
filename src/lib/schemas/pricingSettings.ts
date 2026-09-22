import { z } from 'zod';

export const pricingSettingsInputSchema = z.object({
  ledPricePerSqft: z.coerce.number().finite().nonnegative(),
  stagePricePerPanel: z.coerce.number().finite().nonnegative(),
});

export type PricingSettingsInput = z.infer<typeof pricingSettingsInputSchema>;
