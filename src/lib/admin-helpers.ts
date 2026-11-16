import { COLOR_PALETTE, ORDER_STATUS_META } from "./data";

export const ColorPalette = COLOR_PALETTE;

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_META[status]?.label ?? status;
}
