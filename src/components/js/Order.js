import React from 'react';
import "../css/Order.css";
import moment from "moment";
import CheckoutProduct from './CheckoutProduct';
import CurrencyFormat from 'react-currency-format';
import { or } from 'firebase/firestore';

function Order({ order }) {
  return (
    <div className='order'>
      <div className="order_header">
        <div className="order_info">
          <p className='order_date'>
            <h4>Order Placed:</h4> {moment.unix(order.data.created).format("MMMM Do YYYY, h:mma")}
          </p> {/* This is a time stamp */}
        </div>
        <div className="order_info">
          <p className='order_id'>
            <h4>Order id: </h4>
            <small>{order.id}</small>
          </p>
        </div>
      </div>
      
      <div className="order_items">
        {order.data.basket?.map(item => (
          <CheckoutProduct
              id={item.id}
              title={item.title}
              description={item.description}
              image={item.image}
              price={item.price}
              rating={item.rating}
              hideButton
          />
        ))}
      </div>

      <CurrencyFormat 
      renderText={(value =>
        <h3 className="order_total">Order Total: {value}</h3>
      )}
      decimalScale={2}
      value={order.data.amount / 100}
      displayType='text'
      prefix='$'
      />
    </div>
  )
}

export default Order
