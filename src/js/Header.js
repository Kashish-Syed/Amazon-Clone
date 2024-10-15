import React from 'react';
import '../css/Header.css';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

function Header() {
  return (
    <div className='header'>
      <img className="header_logo" src="/images/Amazon_logo.svg.png" alt="amazon_logo"/>

      <div className='header_search'>
        <input className='header_searchInput' type="text"/>
        <SearchIcon className='header_searchIcon'/>   
      </div>

      <div className='header_nav'>
            <div className='header_option'>
                <span className='header_optionLineOne'>
                    Hello Guest
                </span>
                <span className='header_optionLineTwo'>
                    Sign in
                </span>
            </div>
            <div className='header_option'>
                <span className='header_optionLineOne'>
                    Return
                </span>
                <span className='header_optionLineTwo'>
                    & Orders
                </span>
            </div>
            <div className='header_option'>
                <span className='header_optionLineOne'>
                    Your
                </span>
                <span className='header_optionLineTwo'>
                    Prime
                </span>
            </div>
            <div className='header_optionBasket'>
                <ShoppingCartIcon />
                <span className='header_optionLineTwo header_basketCount'>
                    0
                </span>
            </div>
      </div>
    </div>
  )
}

export default Header
