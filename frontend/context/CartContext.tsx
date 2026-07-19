'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
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
  isOpen: boolean;
}

type CartAction =
  | { type: 'SET_CART'; payload: Cart | null }
  | { type: 'OPEN_DRAWER' }
  | { type: 'CLOSE_DRAWER' }
  // Optimistic actions — update local state instantly
  | { type: 'OPTIMISTIC_UPDATE_QUANTITY'; lineId: string; quantity: number }
  | { type: 'OPTIMISTIC_REMOVE'; lineId: string }
  | { type: 'OPTIMISTIC_ADD'; line: CartLine; checkoutUrl: string };

interface CartContextValue extends CartState {
  isLoading: boolean;
  addItem: (merchandiseId: string, quantity: number) => Promise<void>;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  openCart: () => void;
  closeCart: () => void;
  lines: CartLine[];
  totalQuantity: number;
}

// ---- Helpers ----

function recalcCart(cart: Cart): Cart {
  const lines: CartLine[] = cart.lines.edges.map((e) => e.node);
  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce(
    (sum, l) => sum + parseFloat(l.cost.totalAmount.amount),
    0
  );
  const currencyCode = lines[0]?.cost.totalAmount.currencyCode ?? 'INR';
  return {
    ...cart,
    totalQuantity,
    lines: {
      edges: lines.map((node) => ({ node })),
    },
    cost: {
      subtotalAmount: { amount: subtotal.toFixed(2), currencyCode },
      totalAmount: { amount: subtotal.toFixed(2), currencyCode },
      totalTaxAmount: { amount: '0.00', currencyCode },
    },
  };
}

// ---- Reducer ----

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'SET_CART':
      return { ...state, cart: action.payload };

    case 'OPEN_DRAWER':
      return { ...state, isOpen: true };

    case 'CLOSE_DRAWER':
      return { ...state, isOpen: false };

    // Instantly update quantity in local state
    case 'OPTIMISTIC_UPDATE_QUANTITY': {
      if (!state.cart) return state;
      const updatedEdges = state.cart.lines.edges.map((edge) => {
        if (edge.node.id !== action.lineId) return edge;
        const newQty = action.quantity;
        const unitPrice = parseFloat(edge.node.merchandise.price.amount);
        const currencyCode = edge.node.merchandise.price.currencyCode;
        return {
          node: {
            ...edge.node,
            quantity: newQty,
            cost: {
              totalAmount: {
                amount: (unitPrice * newQty).toFixed(2),
                currencyCode,
              },
            },
          },
        };
      });
      const newCart = recalcCart({ ...state.cart, lines: { edges: updatedEdges } });
      return { ...state, cart: newCart };
    }

    // Instantly remove item from local state
    case 'OPTIMISTIC_REMOVE': {
      if (!state.cart) return state;
      const filteredEdges = state.cart.lines.edges.filter(
        (edge) => edge.node.id !== action.lineId
      );
      const newCart = recalcCart({ ...state.cart, lines: { edges: filteredEdges } });
      return { ...state, cart: newCart };
    }

    // Instantly add item to local state (before server confirms)
    case 'OPTIMISTIC_ADD': {
      if (!state.cart) {
        // Build a minimal cart locally
        const tempCart: Cart = {
          id: 'temp',
          checkoutUrl: action.checkoutUrl,
          totalQuantity: action.line.quantity,
          lines: { edges: [{ node: action.line }] },
          cost: {
            subtotalAmount: action.line.cost.totalAmount,
            totalAmount: action.line.cost.totalAmount,
            totalTaxAmount: { amount: '0.00', currencyCode: action.line.cost.totalAmount.currencyCode },
          },
        };
        return { ...state, cart: tempCart, isOpen: true };
      }
      // Check if same variant already in cart — merge quantities
      const exists = state.cart.lines.edges.find(
        (e) => e.node.merchandise.id === action.line.merchandise.id
      );
      let updatedEdges;
      if (exists) {
        updatedEdges = state.cart.lines.edges.map((edge) => {
          if (edge.node.merchandise.id !== action.line.merchandise.id) return edge;
          const newQty = edge.node.quantity + action.line.quantity;
          const unitPrice = parseFloat(edge.node.merchandise.price.amount);
          const currencyCode = edge.node.merchandise.price.currencyCode;
          return {
            node: {
              ...edge.node,
              quantity: newQty,
              cost: {
                totalAmount: { amount: (unitPrice * newQty).toFixed(2), currencyCode },
              },
            },
          };
        });
      } else {
        updatedEdges = [...state.cart.lines.edges, { node: action.line }];
      }
      const newCart = recalcCart({ ...state.cart, lines: { edges: updatedEdges } });
      return { ...state, cart: newCart, isOpen: true };
    }

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
    isOpen: false,
  });

  // Track pending server requests to prevent race conditions
  const pendingRef = useRef<Set<string>>(new Set());

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
    if (state.cart?.id && state.cart.id !== 'temp') return state.cart.id;
    const storedId = localStorage.getItem(CART_ID_STORAGE_KEY);
    if (storedId) return storedId;
    const newCart = await createCart([]);
    localStorage.setItem(CART_ID_STORAGE_KEY, newCart.id);
    dispatch({ type: 'SET_CART', payload: newCart });
    return newCart.id;
  }, [state.cart?.id]);

  const addItem = useCallback(
    async (merchandiseId: string, quantity: number) => {
      // Build optimistic line from current cart data (use temp values if needed)
      const existingVariant = state.cart?.lines.edges
        .map((e) => e.node)
        .find((l) => l.merchandise.id === merchandiseId);

      const optimisticLine: CartLine = existingVariant
        ? {
            ...existingVariant,
            id: existingVariant.id,
            quantity: existingVariant.quantity + quantity,
          }
        : {
            id: `temp-${merchandiseId}`,
            quantity,
            merchandise: {
              id: merchandiseId,
              title: '',
              selectedOptions: [],
              product: { id: '', title: '', handle: '', featuredImage: null },
              price: { amount: '0', currencyCode: 'INR' },
            },
            cost: { totalAmount: { amount: '0', currencyCode: 'INR' } },
          };

      // Optimistically open the drawer immediately
      dispatch({ type: 'OPTIMISTIC_ADD', line: optimisticLine, checkoutUrl: state.cart?.checkoutUrl ?? '' });

      try {
        const cartId = await getOrCreateCart();
        const updatedCart = await addToCart(cartId, [{ merchandiseId, quantity }]);
        localStorage.setItem(CART_ID_STORAGE_KEY, updatedCart.id);
        // Replace optimistic state with real server response
        dispatch({ type: 'SET_CART', payload: updatedCart });
        dispatch({ type: 'OPEN_DRAWER' });
      } catch (err) {
        console.error('Failed to add item, refreshing cart:', err);
        // Rollback: re-fetch the real cart state
        const storedId = localStorage.getItem(CART_ID_STORAGE_KEY);
        if (storedId) {
          const realCart = await getCart(storedId).catch(() => null);
          dispatch({ type: 'SET_CART', payload: realCart });
        }
      }
    },
    [getOrCreateCart, state.cart]
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (!state.cart?.id) return;

      // Debounce: track this operation
      const opId = `update-${lineId}`;
      pendingRef.current.add(opId);

      // Optimistic update — instant UI change
      if (quantity === 0) {
        dispatch({ type: 'OPTIMISTIC_REMOVE', lineId });
      } else {
        dispatch({ type: 'OPTIMISTIC_UPDATE_QUANTITY', lineId, quantity });
      }

      try {
        const cartId = state.cart.id;
        let updatedCart: Cart;
        if (quantity === 0) {
          updatedCart = await removeFromCart(cartId, [lineId]);
        } else {
          updatedCart = await updateCart(cartId, [{ id: lineId, quantity }]);
        }
        // Only apply server response if this op is still the latest
        if (pendingRef.current.has(opId)) {
          dispatch({ type: 'SET_CART', payload: updatedCart });
        }
      } catch (err) {
        console.error('Failed to update item, rolling back:', err);
        // Rollback: re-fetch real cart
        const realCart = await getCart(state.cart.id).catch(() => null);
        dispatch({ type: 'SET_CART', payload: realCart });
      } finally {
        pendingRef.current.delete(opId);
      }
    },
    [state.cart]
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      if (!state.cart?.id) return;

      // Optimistic remove — instant UI change
      dispatch({ type: 'OPTIMISTIC_REMOVE', lineId });

      try {
        const updatedCart = await removeFromCart(state.cart.id, [lineId]);
        dispatch({ type: 'SET_CART', payload: updatedCart });
      } catch (err) {
        console.error('Failed to remove item, rolling back:', err);
        const realCart = await getCart(state.cart.id).catch(() => null);
        dispatch({ type: 'SET_CART', payload: realCart });
      }
    },
    [state.cart]
  );

  const lines: CartLine[] = state.cart?.lines.edges.map((e) => e.node) ?? [];
  const totalQuantity = state.cart?.totalQuantity ?? 0;

  return (
    <CartContext.Provider
      value={{
        ...state,
        isLoading: false, // No global loading state needed with optimistic updates
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
