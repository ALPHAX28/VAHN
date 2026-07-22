'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { Cart, CartLine, Money, Image, SelectedOption } from '@/lib/api/types';
import {
  createCart,
  addToCart,
  updateCart,
  removeFromCart,
  getCart,
  syncCart,
} from '@/lib/api';

// ---- Types ----

/**
 * Rich display data passed from the product page into addItem
 * so that the optimistic cart item shows real image/title/price instantly.
 */
export interface AddItemDisplayData {
  productTitle: string;
  productHandle: string;
  variantTitle: string;
  price: Money;
  image: Image | null;
  selectedOptions: SelectedOption[];
  quantityAvailable?: number;
}

interface CartState {
  cart: Cart | null;
  isOpen: boolean;
}

type CartAction =
  | { type: 'SET_CART'; payload: Cart | null }
  | { type: 'OPEN_DRAWER' }
  | { type: 'CLOSE_DRAWER' }
  | { type: 'OPTIMISTIC_UPDATE_QUANTITY'; lineId: string; quantity: number }
  | { type: 'OPTIMISTIC_REMOVE'; lineId: string }
  | { type: 'OPTIMISTIC_ADD'; line: CartLine; checkoutUrl: string };

interface CartContextValue extends CartState {
  isLoading: boolean;
  addItem: (merchandiseId: string, quantity: number, displayData?: AddItemDisplayData) => void;
  updateItem: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  lines: CartLine[];
  totalQuantity: number;
}

// ---- Helpers ----

function recalcCart(cart: Cart): Cart {
  const lines = cart.lines.edges.map((e) => e.node);
  const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce(
    (sum, l) => sum + parseFloat(l.cost.totalAmount.amount),
    0
  );
  const currencyCode = lines[0]?.cost.totalAmount.currencyCode ?? 'INR';
  return {
    ...cart,
    totalQuantity,
    lines: { edges: lines.map((node) => ({ node })) },
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

    case 'OPTIMISTIC_UPDATE_QUANTITY': {
      if (!state.cart) return state;
      const updatedEdges = state.cart.lines.edges.map((edge) => {
        if (edge.node.id !== action.lineId) return edge;
        const unitPrice = parseFloat(edge.node.merchandise.price.amount);
        const currencyCode = edge.node.merchandise.price.currencyCode;
        return {
          node: {
            ...edge.node,
            quantity: action.quantity,
            cost: {
              totalAmount: {
                amount: (unitPrice * action.quantity).toFixed(2),
                currencyCode,
              },
            },
          },
        };
      });
      return { ...state, cart: recalcCart({ ...state.cart, lines: { edges: updatedEdges } }) };
    }

    case 'OPTIMISTIC_REMOVE': {
      if (!state.cart) return state;
      const filteredEdges = state.cart.lines.edges.filter(
        (edge) => edge.node.id !== action.lineId
      );
      return { ...state, cart: recalcCart({ ...state.cart, lines: { edges: filteredEdges } }) };
    }

    case 'OPTIMISTIC_ADD': {
      // Open drawer immediately
      if (!state.cart || state.cart.id === 'temp') {
        const tempCart: Cart = {
          id: 'temp',
          checkoutUrl: action.checkoutUrl,
          totalQuantity: action.line.quantity,
          lines: { edges: [{ node: action.line }] },
          discountCodes: [],
          cost: {
            subtotalAmount: action.line.cost.totalAmount,
            totalAmount: action.line.cost.totalAmount,
            totalTaxAmount: { amount: '0.00', currencyCode: action.line.cost.totalAmount.currencyCode },
          },
        };
        return { ...state, cart: tempCart, isOpen: true };
      }
      // Merge into existing cart
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
              cost: { totalAmount: { amount: (unitPrice * newQty).toFixed(2), currencyCode } },
            },
          };
        });
      } else {
        updatedEdges = [...state.cart.lines.edges, { node: action.line }];
      }
      return {
        ...state,
        cart: recalcCart({ ...state.cart, lines: { edges: updatedEdges } }),
        isOpen: true,
      };
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

  // Maps lineId → timestamp of last operation on that line
  // Used to discard stale server responses when the user clicks rapidly
  const lastOpTimestamp = useRef<Map<string, number>>(new Map());

  // Initialize cart from localStorage (synchronously first, then background refresh)
  useEffect(() => {
    // 1. Sync load cached cart data (instant!)
    const cachedCartData = localStorage.getItem('vahn-cart-data');
    let loadedCart: Cart | null = null;
    if (cachedCartData) {
      try {
        const parsed = JSON.parse(cachedCartData);
        if (parsed) {
          dispatch({ type: 'SET_CART', payload: parsed });
          loadedCart = parsed;
        }
      } catch (e) {
        console.error('Failed to parse cached cart data', e);
      }
    }

    // 2. Fetch fresh cart data in background or trigger a sync if local changes are dirty
    const storedCartId = localStorage.getItem(CART_ID_STORAGE_KEY);
    const isDirty = localStorage.getItem('vahn-cart-dirty') === 'true';

    if (isDirty && loadedCart) {
      // Trigger sync immediately on mount so unsynced client changes overwrite database
      triggerSync(true, loadedCart);
    } else if (storedCartId) {
      getCart(storedCartId)
        .then((cart) => {
          if (cart) {
            dispatch({ type: 'SET_CART', payload: cart });
            localStorage.removeItem('vahn-cart-dirty');
          } else {
            localStorage.removeItem(CART_ID_STORAGE_KEY);
            localStorage.removeItem('vahn-cart-data');
            localStorage.removeItem('vahn-cart-dirty');
            dispatch({ type: 'SET_CART', payload: null });
          }
        })
        .catch(() => {
          // Keep cached cart on network error
        });
    }
  }, []);

  // Persist cart updates to localStorage automatically
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (state.cart) {
      localStorage.setItem('vahn-cart-data', JSON.stringify(state.cart));
    }
  }, [state.cart]);

  // Keep a mutable ref of the cart state to avoid recreation of triggerSync
  const cartRef = useRef<Cart | null>(null);
  useEffect(() => {
    cartRef.current = state.cart;
  }, [state.cart]);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);
  const needsSyncRef = useRef(false);

  // Debounced synchronization function
  const triggerSync = useCallback((immediate = false, overrideCart: Cart | null = null) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const runSync = async () => {
      // If a sync is already running, queue a catch-up sync and wait
      if (isSyncingRef.current) {
        needsSyncRef.current = true;
        return;
      }

      isSyncingRef.current = true;
      needsSyncRef.current = false;

      // Set dirty flag before starting network call
      localStorage.setItem('vahn-cart-dirty', 'true');

      try {
        const cart = overrideCart || cartRef.current;
        const currentLines = cart?.lines.edges.map((e) => ({
          merchandiseId: e.node.merchandise.id,
          quantity: e.node.quantity,
        })) ?? [];

        const storedId = localStorage.getItem(CART_ID_STORAGE_KEY);
        let updatedCart: Cart;

        if (!storedId || storedId === 'temp') {
          updatedCart = await createCart(currentLines);
        } else {
          updatedCart = await syncCart(storedId, currentLines);
        }

        localStorage.setItem(CART_ID_STORAGE_KEY, updatedCart.id);
        
        // Only commit response if user hasn't made new changes during flight
        if (!needsSyncRef.current) {
          dispatch({ type: 'SET_CART', payload: updatedCart });
          localStorage.removeItem('vahn-cart-dirty');
        }
      } catch (err) {
        console.error('Cart sync failed:', err);
      } finally {
        isSyncingRef.current = false;
        if (needsSyncRef.current) {
          needsSyncRef.current = false;
          triggerSync();
        }
      }
    };

    if (immediate) {
      runSync();
    } else {
      // Mark dirty immediately on input (before debounce finishes)
      localStorage.setItem('vahn-cart-dirty', 'true');
      syncTimeoutRef.current = setTimeout(runSync, 400); // 400ms debounce
    }
  }, []);

  const getOrCreateCartId = useCallback(async (): Promise<string> => {
    const storedId = localStorage.getItem(CART_ID_STORAGE_KEY);
    if (storedId) return storedId;
    const newCart = await createCart([]);
    localStorage.setItem(CART_ID_STORAGE_KEY, newCart.id);
    dispatch({ type: 'SET_CART', payload: newCart });
    return newCart.id;
  }, []);

  /**
   * addItem — optimistic add to cart
   */
  const addItem = useCallback(
    (merchandiseId: string, quantity: number, displayData?: AddItemDisplayData) => {
      const unitAmount = displayData ? parseFloat(displayData.price.amount) * quantity : 0;
      const currencyCode = displayData?.price.currencyCode ?? 'INR';

      const optimisticLine: CartLine = {
        id: `temp-${merchandiseId}-${Date.now()}`,
        quantity,
        merchandise: {
          id: merchandiseId,
          title: displayData?.variantTitle ?? '',
          selectedOptions: displayData?.selectedOptions ?? [],
          quantityAvailable: displayData?.quantityAvailable,
          product: {
            id: merchandiseId,
            title: displayData?.productTitle ?? '',
            handle: displayData?.productHandle ?? '',
            featuredImage: displayData?.image ?? null,
          },
          price: displayData?.price ?? { amount: '0', currencyCode: 'INR' },
        },
        cost: {
          totalAmount: {
            amount: unitAmount.toFixed(2),
            currencyCode,
          },
        },
      };

      dispatch({
        type: 'OPTIMISTIC_ADD',
        line: optimisticLine,
        checkoutUrl: state.cart?.checkoutUrl ?? '',
      });

      triggerSync();
    },
    [state.cart?.checkoutUrl, triggerSync]
  );

  /**
   * updateItem — optimistic update item quantity
   */
  const updateItem = useCallback(
    (lineId: string, quantity: number) => {
      const line = state.cart?.lines.edges.find((e) => e.node.id === lineId)?.node;
      if (line && line.merchandise.quantityAvailable !== undefined && quantity > line.merchandise.quantityAvailable) {
        quantity = line.merchandise.quantityAvailable;
      }

      if (quantity === 0) {
        dispatch({ type: 'OPTIMISTIC_REMOVE', lineId });
      } else {
        dispatch({ type: 'OPTIMISTIC_UPDATE_QUANTITY', lineId, quantity });
      }

      triggerSync();
    },
    [state.cart, triggerSync]
  );

  /**
   * removeItem — optimistic remove item
   */
  const removeItem = useCallback(
    (lineId: string) => {
      dispatch({ type: 'OPTIMISTIC_REMOVE', lineId });
      triggerSync();
    },
    [triggerSync]
  );

  /**
   * clearCart — resets cart state after checkout
   */
  const clearCart = useCallback(() => {
    localStorage.removeItem(CART_ID_STORAGE_KEY);
    localStorage.removeItem('vahn-cart-data');
    localStorage.removeItem('vahn-cart-dirty');
    dispatch({ type: 'SET_CART', payload: null });
  }, []);

  const lines: CartLine[] = state.cart?.lines.edges.map((e) => e.node) ?? [];
  const totalQuantity = state.cart?.totalQuantity ?? 0;

  return (
    <CartContext.Provider
      value={{
        ...state,
        isLoading: false,
        addItem,
        updateItem,
        removeItem,
        clearCart,
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
