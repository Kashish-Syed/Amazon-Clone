import React from 'react';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { Link } from 'react-router-dom';
import '../css/Header.css';
import { useStateValue } from './StateProvider';
import { auth } from '../../database/firebase';
import { signOut } from 'firebase/auth';
import { logger, serializeError } from '../../lib/logger';

function Header() {
    const [state] = useStateValue();
    const { user } = state;

    // Total UNITS, not distinct products. `basket.length` counted lines, so a
    // cart holding three of one item displayed "1".
    const itemCount = state.lines.reduce((sum, line) => sum + line.quantity, 0);

    const handleAuthentication = async () => {
        if (!user) return;

        try {
            await signOut(auth);
            logger.info('auth.signed_out');
        } catch (error) {
            // signOut returns a promise. Ignoring it meant a failed sign-out
            // left the user apparently signed out in the UI while still holding
            // a live session.
            logger.error('auth.sign_out_failed', { error: serializeError(error) });
        }
    };

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
            {/* When signed in this is a sign-out control, not a link to /login.
                It previously rendered `to={false}`, which react-router v6 does
                not accept as a destination. */}
            <Link to={user ? '/' : '/login'}>
                <div onClick={handleAuthentication} className='header_option header_border'>
                    <span className='header_optionLineOne'>
                        {user ? `Hello ${user?.email?.split('@')[0] ?? 'there'}` : 'Hello Guest'}
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
                        {itemCount}
                    </span>
                </div>
            </Link>
      </div>
    </div>
  )
}

export default Header
