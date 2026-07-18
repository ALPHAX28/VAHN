'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import type { Cart, CartLine } from '@/lib/api/types';
import {
  createCart,
  addToCart,
  updateCart,
  removeFromCart,
  getCart,
} from '@/lib/api';

// ---- Types ----

interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  isOpen: boolean;
}

type CartAction =
  | { type: 'SET_CART'; payload: Cart | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'OPEN_DRAWER' }
  | { type: 'CLOSE_DRAWER' };

interface CartContextValue extends CartState {
  addItem: (merchandiseId: string, quantity: number) => Promise<void>;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  openCart: () => void;
  closeCart: () => void;
  lines: CartLine[];
  totalQuantity: number;
}

// ---- Reducer ----

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_CART':
      return { ...state, cart: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'OPEN_DRAWER':
      return { ...state, isOpen: true };
    case 'CLOSE_DRAWER':
      return { ...state, isOpen: false };
    default:
      return state;
  }
}

// ---- Context ----

const CartContext = createContext<CartContextValue | null>(null);

const CART_ID_STORAGE_KEY = 'vahn-cart-id';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    cart: null,
    isLoading: false,
    isOpen: false,
  });

  // Initialize cart from localStorage on mount
  useEffect(() => {
    async function initCart() {
      const storedCartId = localStorage.getItem(CART_ID_STORAGE_KEY);
      if (storedCartId) {
        try {
          const cart = await getCart(storedCartId);
          if (cart) {
            dispatch({ type: 'SET_CART', payload: cart });
            return;
          }
        } catch {
          // Cart expired, will create new one on next add
        }
        localStorage.removeItem(CART_ID_STORAGE_KEY);
      }
    }
    initCart();
  }, []);

  const getOrCreateCart = useCallback(async (): Promise<string> => {
    if (state.cart?.id) return state.cart.id;
    const storedId = localStorage.getItem(CART_ID_STORAGE_KEY);
    if (storedId) return storedId;
    const newCart = await createCart([]);
    localStorage.setItem(CART_ID_STORAGE_KEY, newCart.id);
    dispatch({ type: 'SET_CART', payload: newCart });
    return newCart.id;
  }, [state.cart?.id]);

  const addItem = useCallback(
    async (merchandiseId: string, quantity: number) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const cartId = await getOrCreateCart();
        const updatedCart = await addToCart(cartId, [{ merchandiseId, quantity }]);
        localStorage.setItem(CART_ID_STORAGE_KEY, updatedCart.id);
        dispatch({ type: 'SET_CART', payload: updatedCart });
        dispatch({ type: 'OPEN_DRAWER' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [getOrCreateCart]
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (!state.cart?.id) return;
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        if (quantity === 0) {
          const updatedCart = await removeFromCart(state.cart.id, [lineId]);
          dispatch({ type: 'SET_CART', payload: updatedCart });
        } else {
          const updatedCart = await updateCart(state.cart.id, [{ id: lineId, quantity }]);
          dispatch({ type: 'SET_CART', payload: updatedCart });
        }
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.cart?.id]
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      if (!state.cart?.id) return;
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const updatedCart = await removeFromCart(state.cart.id, [lineId]);
        dispatch({ type: 'SET_CART', payload: updatedCart });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.cart?.id]
  );

  const lines: CartLine[] = state.cart?.lines.edges.map((e) => e.node) ?? [];
  const totalQuantity = state.cart?.totalQuantity ?? 0;

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        updateItem,
        removeItem,
        openCart: () => dispatch({ type: 'OPEN_DRAWER' }),
        closeCart: () => dispatch({ type: 'CLOSE_DRAWER' }),
        lines,
        totalQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
