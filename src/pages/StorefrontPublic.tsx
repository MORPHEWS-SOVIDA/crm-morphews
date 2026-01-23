import { CartProvider } from '@/components/storefront/cart/CartContext';
import { StorefrontLayout } from '@/components/storefront/StorefrontLayout';

export default function StorefrontPublic() {
  return (
    <CartProvider>
      <StorefrontLayout />
    </CartProvider>
  );
}
