import React from 'react';
import '../css/Header.css';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { Link } from 'react-router-dom';
import { useStateValue } from './StateProvider';
import { auth } from '../../database/firebase';

function Header() {
    const [{ basket, user}, dispatch] = useStateValue();

    const handleAuthentication = () => {
        if (user) {
            auth.signOut();
        }
    }

  return (
    <div className='header'>
        <Link to="/">
        <img className="header_logo" src="/images/amazon_white_letter.png" alt="amazon_logo"/>
        </Link>
      <div className='header_search'>
        <input className='header_searchInput' type="text" placeholder='Search Here'/>
        <SearchIcon className='header_searchIcon'/>   
      </div>

      <div className='header_nav'>
            <Link to={!user && '/login'}>
                <div onClick={handleAuthentication} className='header_option header_border'>
                    <span className='header_optionLineOne'>
                        {user ? `Hello ${user?.email.split('@')[0]}` : 'Hello Guest'}
                    </span>
                    <span className='header_optionLineTwo'>
                        {user ? 'Sign Out' : 'Sign In'}
                    </span>
                </div>
            </Link>

            <Link to='/orders'>
                <div className='header_option header_border'>
                    <span className='header_optionLineOne'>
                        Return
                    </span>
                    <span className='header_optionLineTwo'>
                        & Orders
                    </span>
                </div>
            </Link>

            <div className='header_option header_border'>
                <span className='header_optionLineOne'>
                    Your
                </span>
                <span className='header_optionLineTwo'>
                    Prime
                </span>
            </div>
            <Link to='/checkout'>
                <div className='header_optionBasket header_border'>
                    <ShoppingCartIcon />
                    <span className='header_optionLineTwo header_basketCount'>
                        { basket?.length}
                    </span>
                </div>
            </Link>
      </div>
    </div>
  )
}

export default Header
