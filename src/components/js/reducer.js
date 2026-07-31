// Application state.
//
// The reducer holds only what the user has actually chosen: which products are
// in the cart, who is signed in, and the three checkout selections. It stores
// NO derived values - no subtotal, no tax, no total.
//
// That is deliberate. Caching a total in state means there are two answers to
// "what does this order cost", and they drift the moment an action forgets to
// recompute one of them. Totals come from selectPricing() below, which runs the
// pricing engine over current state every time it is asked.

import { config } from '../../config';
import { addItem, decrementItem, itemCount, removeLine, setQuantity } from '../../domain/cart';
import { priceOrder } from '../../domain/pricing';
import { DEFAULT_SHIPPING_METHOD } from '../../domain/shipping';
import { DEFAULT_REGION_CODE } from '../../domain/tax';
import { logger } from '../../lib/logger';

export const ACTIONS = {
  ADD_TO_CART: 'ADD_TO_CART',
  REMOVE_FROM_CART: 'REMOVE_FROM_CART',
  DECREMENT_ITEM: 'DECREMENT_ITEM',
  SET_QUANTITY: 'SET_QUANTITY',
  EMPTY_CART: 'EMPTY_CART',
  SET_USER: 'SET_USER',
  SET_PROMO_CODE: 'SET_PROMO_CODE',
  SET_REGION: 'SET_REGION',
  SET_SHIPPING_METHOD: 'SET_SHIPPING_METHOD',
};

export const initialState = {
  /**
   * Cart lines, each carrying its own quantity. See domain/cart.js.
   * This replaced a flat `basket` array in which two of the same product were
   * two separate entries.
   */
  lines: [],

  user: null,

  /**
   * False until Firebase has told us whether anyone is signed in.
   *
   * `user: null` on its own is ambiguous - it means both "signed out" and "we
   * do not know yet", and onAuthStateChanged does not fire until after the
   * first render. Any route that redirects on `!user` will bounce a signed-in
   * shopper to the login page on a hard refresh unless it waits for this.
   */
  authResolved: false,

  checkout: {
    promoCode: '',
    regionCode: DEFAULT_REGION_CODE,
    shippingMethodId: DEFAULT_SHIPPING_METHOD,
  },
};

/**
 * Price the current cart.
 *
 * The single way any component should obtain money figures. Components must
 * not add prices up themselves - that is how the subtotal on the cart page and
 * the amount sent to Stripe ended up being computed by two different pieces of
 * arithmetic.
 *
 * @param {typeof initialState} state
 * @returns {import('../../domain/pricing').OrderPricing}
 */
export function selectPricing(state) {
  return priceOrder({
    lines: state.lines,
    promoCode: state.checkout.promoCode,
    regionCode: state.checkout.regionCode,
    features: config.features,
  });
}

/**
 * Total units in the cart, for the header badge.
 *
 * @param {typeof initialState} state
 * @returns {number}
 */
export function selectItemCount(state) {
  return itemCount(state.lines);
}

const reducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.ADD_TO_CART: {
      const { lines, clamped } = addItem(state.lines, action.product, action.quantity ?? 1);

      if (clamped) {
        // The shopper asked for more than we can sell them. Worth a log line:
        // a spike here usually means the catalogue's stock numbers are stale.
        logger.warn('cart.quantity_clamped', {
          productId: action.product?.id,
          requested: action.quantity ?? 1,
          stock: action.product?.stock,
        });
      }

      return { ...state, lines };
    }

    case ACTIONS.REMOVE_FROM_CART:
      return { ...state, lines: removeLine(state.lines, action.productId) };

    case ACTIONS.DECREMENT_ITEM:
      return { ...state, lines: decrementItem(state.lines, action.productId) };

    case ACTIONS.SET_QUANTITY:
      return { ...state, lines: setQuantity(state.lines, action.productId, action.quantity) };

    case ACTIONS.EMPTY_CART:
      // The promo code goes with the cart it was applied to. Leaving it behind
      // would silently discount the shopper's next, unrelated order.
      return { ...state, lines: [], checkout: { ...state.checkout, promoCode: '' } };

    case ACTIONS.SET_USER:
      // Auth is resolved either way: being told "nobody is signed in" is just
      // as much of an answer as being handed a user.
      return { ...state, user: action.user ?? null, authResolved: true };

    case ACTIONS.SET_PROMO_CODE:
      return { ...state, checkout: { ...state.checkout, promoCode: action.code ?? '' } };

    case ACTIONS.SET_REGION:
      return { ...state, checkout: { ...state.checkout, regionCode: action.regionCode } };

    case ACTIONS.SET_SHIPPING_METHOD:
      return { ...state, checkout: { ...state.checkout, shippingMethodId: action.methodId } };

    // Returning state unchanged is what keeps an unrecognised action harmless.
    // Without this branch the reducer returned undefined and wiped everything -
    // cart, signed-in user, the lot.
    default:
      logger.debug('state.unhandled_action', { type: action?.type });
      return state;
  }
};

export default reducer;
