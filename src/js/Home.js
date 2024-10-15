import React from 'react'
import '../css/Home.css';
import Product from '../js/Product';

function Home() {
  return (
    <div className='home'>
      <div className='home_container'>
        <img className='home_image' src="/images/amazon_banner.jpg" alt="amazon_banner"/>

        <div className='home_row'>
          <Product />
          <Product />
        </div>

        <div className='home_row'>
          <Product />
          <Product />
          <Product />
        </div>

        <div className='home_row'>
        {/* 1 component */}
        </div>
      </div>
    </div>
  )
}

export default Home
