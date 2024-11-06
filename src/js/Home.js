import React from 'react'
import '../css/Home.css';
import Product from '../js/Product';
import '../css/App.css';

function Home() {
  return (
    <div className='home'>
      <div className='home_container'>
        <img className='home_image' src="/images/amazon_banner.jpg" alt="amazon_banner"/>

        <div className='home_row'>
          <Product id='1234' title='hair mask loreum ipsum' price={24.78} image="./images/crockery.jpg" rating={5}/>
          <Product id='1234' title='test2' price={19.99} image="./images/laneige_lipbalm.jpg" rating={5}/>
        </div>

        <div className='home_row'>
          <Product id='1234' title='lorem ipsum lorem ipsum' price={24.78} image="./images/litter.jpg" rating={5}/>
          <Product id='1234' title='test4' price={45.99} image="./images/eva-nyc.jpg" rating={4}/>
          <Product id='1234' title='test5' price={30.00} image="./images/automatic_feeder.jpg" rating={5}/>
        </div>

        <div className='home_row'>
          <Product id='1234' title='test6' price={48.57} image="./images/product1.jpg" rating={2}/>
        </div>
      </div>
    </div>
  )
}

export default Home
