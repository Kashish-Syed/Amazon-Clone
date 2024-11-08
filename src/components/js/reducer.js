export const initialState = {
    basket: [],
}

// Selector
// Like a for loop
export const getBasketTotal = (basket) =>
    basket?.reduce((amount, item) => item.price + amount, 0);

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

        case 'REMOVE_FROM_CART':
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
        
        case 'SET_USER':
            return {
                ...state,
                user: action.user
            }
    }
};

export default reducer;