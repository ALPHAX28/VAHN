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
    if (cachedCartData) {
      try {
        const parsed = JSON.parse(cachedCartData);
        if (parsed) {
          dispatch({ type: 'SET_CART', payload: parsed });
        }
      } catch (e) {
        console.error('Failed to parse cached cart data', e);
      }
    }

    // 2. Fetch fresh cart data in background to sync
    const storedCartId = localStorage.getItem(CART_ID_STORAGE_KEY);
    if (!storedCartId) return;
    getCart(storedCartId)
      .then((cart) => {
        if (cart) {
          dispatch({ type: 'SET_CART', payload: cart });
        } else {
          localStorage.removeItem(CART_ID_STORAGE_KEY);
          localStorage.removeItem('vahn-cart-data');
          dispatch({ type: 'SET_CART', payload: null });
        }
      })
      .catch(() => {
        // Keep cached cart on network error to prevent flashing / empty state
      });
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

  const getOrCreateCartId = useCallback(async (): Promise<string> => {
    const storedId = localStorage.getItem(CART_ID_STORAGE_KEY);
    if (storedId) return storedId;
    const newCart = await createCart([]);
    localStorage.setItem(CART_ID_STORAGE_KEY, newCart.id);
    dispatch({ type: 'SET_CART', payload: newCart });
    return newCart.id;
  }, []);

  /**
   * addItem — fire-and-forget, optimistic.
   * The cart drawer opens INSTANTLY with real product data if displayData is provided.
   */
  const addItem = useCallback(
    (merchandiseId: string, quantity: number, displayData?: AddItemDisplayData) => {
      // Build a fully-populated optimistic line if we have display data
      const unitAmount = displayData ? parseFloat(displayData.price.amount) * quantity : 0;
      const currencyCode = displayData?.price.currencyCode ?? 'INR';

      const optimisticLine: CartLine = {
        id: `temp-${merchandiseId}-${Date.now()}`,
        quantity,
        merchandise: {
          id: merchandiseId,
          title: displayData?.variantTitle ?? '',
          selectedOptions: displayData?.selectedOptions ?? [],
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

      // Open drawer with optimistic item IMMEDIATELY
      dispatch({
        type: 'OPTIMISTIC_ADD',
        line: optimisticLine,
        checkoutUrl: state.cart?.checkoutUrl ?? '',
      });

      // Sync to server in background
      getOrCreateCartId()
        .then((cartId) => addToCart(cartId, [{ merchandiseId, quantity }]))
        .then((updatedCart) => {
          localStorage.setItem(CART_ID_STORAGE_KEY, updatedCart.id);
          // Replace optimistic cart with real server data
          dispatch({ type: 'SET_CART', payload: updatedCart });
        })
        .catch(async (err) => {
          console.error('addToCart failed, rolling back:', err);
          const storedId = localStorage.getItem(CART_ID_STORAGE_KEY);
          if (storedId) {
            const realCart = await getCart(storedId).catch(() => null);
            dispatch({ type: 'SET_CART', payload: realCart });
          }
        });
    },
    [getOrCreateCartId, state.cart]
  );

  /**
   * updateItem — optimistic quantity change.
   * Uses timestamps to discard stale server responses (prevents flicker on rapid clicks).
   */
  const updateItem = useCallback(
    (lineId: string, quantity: number) => {
      if (!state.cart?.id || state.cart.id === 'temp') return;

      // Safeguard: Clamp to maximum available stock if defined
      const line = state.cart.lines.edges.find((e) => e.node.id === lineId)?.node;
      if (line && line.merchandise.quantityAvailable !== undefined && quantity > line.merchandise.quantityAvailable) {
        quantity = line.merchandise.quantityAvailable;
      }

      // Stamp this operation — any server response with an older stamp is discarded
      const stamp = Date.now();
      lastOpTimestamp.current.set(lineId, stamp);

      // Optimistic update — instant
      if (quantity === 0) {
        dispatch({ type: 'OPTIMISTIC_REMOVE', lineId });
      } else {
        dispatch({ type: 'OPTIMISTIC_UPDATE_QUANTITY', lineId, quantity });
      }

      const cartId = state.cart.id;

      const serverCall =
        quantity === 0
          ? removeFromCart(cartId, [lineId])
          : updateCart(cartId, [{ id: lineId, quantity }]);

      serverCall
        .then((updatedCart) => {
          // Only commit if no NEWER operation for this line has been initiated
          if (lastOpTimestamp.current.get(lineId) === stamp) {
            dispatch({ type: 'SET_CART', payload: updatedCart });
            lastOpTimestamp.current.delete(lineId);
          }
          // Otherwise: a newer optimistic update is already in place — discard this response
        })
        .catch(async (err) => {
          console.error('updateItem failed, rolling back:', err);
          const realCart = await getCart(cartId).catch(() => null);
          dispatch({ type: 'SET_CART', payload: realCart });
          lastOpTimestamp.current.delete(lineId);
        });
    },
    [state.cart]
  );

  /**
   * removeItem — optimistic removal.
   */
  const removeItem = useCallback(
    (lineId: string) => {
      if (!state.cart?.id || state.cart.id === 'temp') return;

      const stamp = Date.now();
      lastOpTimestamp.current.set(lineId, stamp);

      dispatch({ type: 'OPTIMISTIC_REMOVE', lineId });

      removeFromCart(state.cart.id, [lineId])
        .then((updatedCart) => {
          if (lastOpTimestamp.current.get(lineId) === stamp) {
            dispatch({ type: 'SET_CART', payload: updatedCart });
            lastOpTimestamp.current.delete(lineId);
          }
        })
        .catch(async (err) => {
          console.error('removeItem failed, rolling back:', err);
          const realCart = await getCart(state.cart!.id).catch(() => null);
          dispatch({ type: 'SET_CART', payload: realCart });
          lastOpTimestamp.current.delete(lineId);
        });
    },
    [state.cart]
  );

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
