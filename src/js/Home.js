import React from 'react'
import '../css/Home.css';
import Product from '../js/Product';

function Home() {
  return (
    <div className='home'>
      <div className='home_container'>
        <img className='home_image' src="/images/amazon_banner.jpg" alt="amazon_banner"/>

        <div className='home_row'>
          <Product id='1234' title='test1' price={24.78} image="./images/product1.jpg" rating={5}/>
          <Product id='1234' title='test2' price={24.78} image="./images/product1.jpg" rating={5}/>
        </div>

        <div className='home_row'>
          <Product id='1234' title='test3' price={24.78} image="./images/product1.jpg" rating={5}/>
          <Product id='1234' title='test4' price={24.78} image="./images/product1.jpg" rating={4}/>
          <Product id='1234' title='test5' price={24.78} image="./images/product1.jpg" rating={5}/>
        </div>

        <div className='home_row'>
          <Product id='1234' title='test6' price={24.78} image="./images/product1.jpg" rating={2}/>
        </div>
      </div>
    </div>
  )
}

export default Home
