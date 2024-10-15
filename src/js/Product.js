import React from 'react'
import "../css/Product.css"

function Product() {
  return (
    <div className='product'>
      
      <div className='product_info'>
        <p> The product info</p>

        <p className='product_price'>
          <small>$</small>
          <strong>19.99</strong>
        </p>

        <div className='product_rating'>
          <p>:star</p>
        </div>
      </div>

      <img className='product_img' src='./images/product1.jpg' alt=''/>
      <button>Add to cart</button>

    </div>
  )
}

export default Product
