export const initialState = {
    basket: [],
}

// Selector
// Like a for loop
//
// Number(...) is load-bearing, not cosmetic. Some Firestore product documents
// store `price` as a string rather than a number. With a bare `item.price + amount`
// JavaScript concatenates instead of adding, so a basket of ["12.99", 5] produced
// "512.990" and the customer was charged $512.99 instead of $17.99.
export const getBasketTotal = (basket) =>
    basket?.reduce((amount, item) => Number(item.price ?? 0) + amount, 0) ?? 0;

const reducer = (state, action) => {
    switch(action.type) {
        case 'ADD_TO_CART':
            return {
                ...state,
                basket: [...state.basket, action.item],
            };

        case 'EMPTY_CART':
            return {
                ...state,
                basket: []
            }

        case 'REMOVE_FROM_CART': {
            //find the index of what we are going to delete first
            const index = state.basket.findIndex(
                (basketItem) => basketItem.id === action.id
            );
            let newBasket = [...state.basket];

            if (index >= 0) {
                newBasket.splice(index, 1)
            } else {
                console.warn(`Can't remove product (id: ${action.id}) as it's not in the cart!`)
            }

            return {
                ...state,
                basket: newBasket
            }
        }

        case 'SET_USER':
            return {
                ...state,
                user: action.user
            }

        // Without this, any unrecognised action returned `undefined` and wiped
        // the entire state - the basket and the signed-in user would vanish.
        default:
            return state;
    }
};

export default reducer;