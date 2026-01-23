import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';

export interface CartItem {
  productId: string;
  storefrontProductId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  kitSize: 1 | 3 | 6 | 12;
  unitPrice: number; // Price per unit in cents
  totalPrice: number; // Total price for this line item
}

interface CartContextType {
  items: CartItem[];
  storefrontSlug: string | null;
  addItem: (item: Omit<CartItem, 'totalPrice'>, storefrontSlug: string) => void;
  updateQuantity: (productId: string, kitSize: number, quantity: number) => void;
  removeItem: (productId: string, kitSize: number) => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storefrontSlug, setStorefrontSlug] = useState<string | null>(null);

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        const { items: savedItems, storefrontSlug: savedSlug, timestamp } = JSON.parse(saved);
        // Cart expires after 24 hours
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setItems(savedItems);
          setStorefrontSlug(savedSlug);
        } else {
          localStorage.removeItem('cart');
        }
      } catch (e) {
        localStorage.removeItem('cart');
      }
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem('cart', JSON.stringify({
        items,
        storefrontSlug,
        timestamp: Date.now(),
      }));
    } else {
      localStorage.removeItem('cart');
    }
  }, [items, storefrontSlug]);

  const addItem = (item: Omit<CartItem, 'totalPrice'>, slug: string) => {
    // If adding to a different store, clear the cart first
    if (storefrontSlug && storefrontSlug !== slug) {
      setItems([]);
      toast.info('Carrinho limpo pois você mudou de loja');
    }
    setStorefrontSlug(slug);

    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.productId === item.productId && i.kitSize === item.kitSize
      );

      if (existingIndex >= 0) {
        // Update quantity
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
          totalPrice: (updated[existingIndex].quantity + item.quantity) * item.unitPrice * item.kitSize,
        };
        toast.success('Quantidade atualizada no carrinho');
        return updated;
      }

      // Add new item
      toast.success('Produto adicionado ao carrinho');
      return [...prev, {
        ...item,
        totalPrice: item.quantity * item.unitPrice * item.kitSize,
      }];
    });
  };

  const updateQuantity = (productId: string, kitSize: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, kitSize);
      return;
    }

    setItems(prev => prev.map(item => {
      if (item.productId === productId && item.kitSize === kitSize) {
        return {
          ...item,
          quantity,
          totalPrice: quantity * item.unitPrice * item.kitSize,
        };
      }
      return item;
    }));
  };

  const removeItem = (productId: string, kitSize: number) => {
    setItems(prev => prev.filter(
      item => !(item.productId === productId && item.kitSize === kitSize)
    ));
    toast.success('Produto removido do carrinho');
  };

  const clearCart = () => {
    setItems([]);
    setStorefrontSlug(null);
  };

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const itemCount = items.reduce((sum, item) => sum + (item.quantity * item.kitSize), 0);

  return (
    <CartContext.Provider value={{
      items,
      storefrontSlug,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      subtotal,
      itemCount,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
