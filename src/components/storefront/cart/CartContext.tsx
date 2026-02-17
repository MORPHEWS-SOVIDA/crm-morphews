import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { useUtmTracker } from '@/hooks/useUtmTracker';

export interface CartItem {
  productId: string;
  storefrontProductId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  kitSize: number; // Dynamic kit sizes (1, 2, 3, 5, 10, etc.)
  unitPrice: number; // Price per unit in cents
  totalPrice: number; // Total price for this line item
}

export interface CartCustomerData {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
}

export interface CartShippingData {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

interface CartContextType {
  items: CartItem[];
  storefrontSlug: string | null;
  storefrontId: string | null;
  cartId: string | null;
  addItem: (item: Omit<CartItem, 'totalPrice'>, storefrontSlug: string, storefrontId: string) => void;
  updateQuantity: (productId: string, kitSize: number, quantity: number) => void;
  removeItem: (productId: string, kitSize: number) => void;
  clearCart: () => void;
  updateCustomerData: (data: CartCustomerData) => void;
  updateShippingData: (data: CartShippingData) => void;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

// Debounce helper
function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]) as T;
}

// Generate a unique session ID for cart tracking
function getOrCreateSessionId(): string {
  const storageKey = 'cart_session_id';
  let sessionId = localStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storefrontSlug, setStorefrontSlug] = useState<string | null>(null);
  const [storefrontId, setStorefrontId] = useState<string | null>(null);
  const [cartId, setCartId] = useState<string | null>(null);
  const [customerData, setCustomerData] = useState<CartCustomerData>({});
  const [shippingData, setShippingData] = useState<CartShippingData>({});
  const [sessionId] = useState<string>(() => getOrCreateSessionId());
  const { getUtmForCheckout } = useUtmTracker();

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      try {
        const { 
          items: savedItems, 
          storefrontSlug: savedSlug, 
          storefrontId: savedStorefrontId,
          cartId: savedCartId,
          timestamp 
        } = JSON.parse(saved);
        // Cart expires after 24 hours
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
          setItems(savedItems);
          setStorefrontSlug(savedSlug);
          setStorefrontId(savedStorefrontId || null);
          setCartId(savedCartId || null);
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
        storefrontId,
        cartId,
        timestamp: Date.now(),
      }));
    } else {
      localStorage.removeItem('cart');
    }
  }, [items, storefrontSlug, storefrontId, cartId]);

  // Sync cart to backend
  const syncCartToBackend = useCallback(async (
    currentItems: CartItem[],
    currentStorefrontId: string | null,
    currentCartId: string | null,
    customer?: CartCustomerData,
    shipping?: CartShippingData
  ) => {
    if (!currentStorefrontId || currentItems.length === 0) return;

    try {
      const utmData = getUtmForCheckout();
      
      const payload = {
        cart_id: currentCartId || undefined,
        session_id: sessionId,
        storefront_id: currentStorefrontId,
        source: 'storefront' as const,
        items: currentItems.map(item => ({
          product_id: item.productId,
          storefront_product_id: item.storefrontProductId,
          name: item.name,
          image_url: item.imageUrl,
          quantity: item.quantity,
          kit_size: item.kitSize,
          unit_price_cents: item.unitPrice,
          total_price_cents: item.totalPrice,
        })),
        customer: customer && Object.keys(customer).length > 0 ? customer : undefined,
        shipping: shipping && Object.keys(shipping).length > 0 ? shipping : undefined,
        utm: utmData && Object.keys(utmData).length > 0 ? utmData : undefined,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cart-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();
      
      if (result.success && result.cart_id && !currentCartId) {
        setCartId(result.cart_id);
      }
    } catch (error) {
      console.error('Cart sync error:', error);
      // Don't show error to user - silent sync
    }
  }, [getUtmForCheckout, sessionId]);

  // Debounced sync for customer/shipping data updates
  const debouncedSync = useDebouncedCallback((
    currentItems: CartItem[],
    currentStorefrontId: string | null,
    currentCartId: string | null,
    customer: CartCustomerData,
    shipping: CartShippingData
  ) => {
    syncCartToBackend(currentItems, currentStorefrontId, currentCartId, customer, shipping);
  }, 1000);

  const addItem = (item: Omit<CartItem, 'totalPrice'>, slug: string, sfId: string) => {
    // If adding to a different store, clear the cart first
    if (storefrontSlug && storefrontSlug !== slug) {
      setItems([]);
      setCartId(null);
      toast.info('Carrinho limpo pois você mudou de loja');
    }
    setStorefrontSlug(slug);
    setStorefrontId(sfId);

    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.productId === item.productId && i.kitSize === item.kitSize
      );

      let newItems: CartItem[];

      if (existingIndex >= 0) {
        // Update quantity
        newItems = [...prev];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + item.quantity,
          totalPrice: (newItems[existingIndex].quantity + item.quantity) * item.unitPrice * item.kitSize,
        };
        toast.success('Quantidade atualizada no carrinho');
      } else {
        // Add new item
        newItems = [...prev, {
          ...item,
          totalPrice: item.quantity * item.unitPrice * item.kitSize,
        }];
        toast.success('Produto adicionado ao carrinho');
      }

      // Sync immediately when adding items
      syncCartToBackend(newItems, sfId, cartId);
      
      return newItems;
    });
  };

  const updateQuantity = (productId: string, kitSize: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, kitSize);
      return;
    }

    setItems(prev => {
      const newItems = prev.map(item => {
        if (item.productId === productId && item.kitSize === kitSize) {
          return {
            ...item,
            quantity,
            totalPrice: quantity * item.unitPrice * item.kitSize,
          };
        }
        return item;
      });
      
      // Sync after update
      syncCartToBackend(newItems, storefrontId, cartId);
      
      return newItems;
    });
  };

  const removeItem = (productId: string, kitSize: number) => {
    setItems(prev => {
      const newItems = prev.filter(
        item => !(item.productId === productId && item.kitSize === kitSize)
      );
      
      // Sync after removal
      if (newItems.length > 0) {
        syncCartToBackend(newItems, storefrontId, cartId);
      }
      
      return newItems;
    });
    toast.success('Produto removido do carrinho');
  };

  const clearCart = () => {
    setItems([]);
    setStorefrontSlug(null);
    setStorefrontId(null);
    setCartId(null);
    setCustomerData({});
    setShippingData({});
  };

  const updateCustomerData = useCallback((data: CartCustomerData) => {
    setCustomerData(prev => {
      const newData = { ...prev, ...data };
      // Debounced sync when customer data changes
      debouncedSync(items, storefrontId, cartId, newData, shippingData);
      return newData;
    });
  }, [items, storefrontId, cartId, shippingData, debouncedSync]);

  const updateShippingData = useCallback((data: CartShippingData) => {
    setShippingData(prev => {
      const newData = { ...prev, ...data };
      // Debounced sync when shipping data changes
      debouncedSync(items, storefrontId, cartId, customerData, newData);
      return newData;
    });
  }, [items, storefrontId, cartId, customerData, debouncedSync]);

  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const itemCount = items.reduce((sum, item) => sum + (item.quantity * item.kitSize), 0);

  return (
    <CartContext.Provider value={{
      items,
      storefrontSlug,
      storefrontId,
      cartId,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      updateCustomerData,
      updateShippingData,
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