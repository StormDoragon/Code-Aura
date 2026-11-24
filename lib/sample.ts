import type { SourceFile } from "./source";

export const sampleFile: SourceFile = {
  path: "checkout.ts",
  code: `type CartItem = {
  price: number;
  quantity: number;
};

export function checkout(items: CartItem[], couponCode?: string) {
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const discount = couponCode === "WELCOME" ? 0.1 : 0;

  // Prices are in cents, so rounding happens only once.
  if (items.length === 0) {
    return { ok: false, total: 0 };
  } else {
    return { ok: true, total: Math.round(subtotal * (1 - discount)) };
  }
}
`,
};
