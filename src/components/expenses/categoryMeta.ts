import { Fuel, MoreHorizontal, Package, ShoppingBag, Users, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '@/lib/finance/types';

// Icon + tint for each category, used in the picker and expense rows. The
// tint is decoration beside a text label, never the only identifier.
export const CATEGORY_META: Record<ExpenseCategory, { label: string; short: string; icon: LucideIcon; color: string }> = {
  equipment_rental: { label: EXPENSE_CATEGORY_LABELS.equipment_rental, short: 'Rental', icon: Package, color: 'var(--neon-pink)' },
  equipment_purchase: { label: EXPENSE_CATEGORY_LABELS.equipment_purchase, short: 'Purchase', icon: ShoppingBag, color: 'var(--neon-green)' },
  transportation_fuel: { label: EXPENSE_CATEGORY_LABELS.transportation_fuel, short: 'Fuel', icon: Fuel, color: 'var(--neon-cyan)' },
  crew: { label: EXPENSE_CATEGORY_LABELS.crew, short: 'Crew', icon: Users, color: 'var(--neon-purple)' },
  food: { label: EXPENSE_CATEGORY_LABELS.food, short: 'Food', icon: UtensilsCrossed, color: 'var(--neon-orange)' },
  maintenance: { label: EXPENSE_CATEGORY_LABELS.maintenance, short: 'Maintenance', icon: Wrench, color: 'var(--neon-mint)' },
  other: { label: EXPENSE_CATEGORY_LABELS.other, short: 'Other', icon: MoreHorizontal, color: 'rgba(255, 255, 255, 0.6)' },
};
