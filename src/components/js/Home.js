import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import '../css/App.css';
import '../css/Home.css';
import Product from './Product';
import { fetchProducts } from '../../services/productService';
import { logger, newCorrelationId } from '../../lib/logger';

// Four states, not one.
//
// The original version rendered `products.map(...)` and nothing else, so an
// empty grid meant any of: still loading, permission denied, zero documents in
// the collection, or a crashed request. All four looked identical, which is why
// the site appeared merely "stale" for weeks when Firestore was actually
// rejecting every read.
const STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  EMPTY: 'empty',
  FAILED: 'failed',
};

function Home() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState(STATUS.LOADING);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const correlationId = newCorrelationId();

    setStatus(STATUS.LOADING);
    setError(null);

    try {
      const result = await fetchProducts({ correlationId });

      setProducts(result.products);
      setStatus(result.products.length === 0 ? STATUS.EMPTY : STATUS.READY);
    } catch (caught) {
      // Already logged with its Firestore error code inside the service; here
      // we only need the message that is safe to put in front of a shopper.
      setError(caught.message);
      setStatus(STATUS.FAILED);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // The guard stops a slow response writing into an unmounted component,
    // which React warns about and which masks the real ordering problem.
    const run = async () => {
      if (!active) return;
      await load();
    };

    run();

    return () => {
      active = false;
    };
  }, [load]);

  return (
    <div className="home">
      <div className="home_container">
        <img className="home_image" src="/images/amazon_banner.jpg" alt="amazon_banner" />

        {status === STATUS.LOADING && (
          <p className="home_status" role="status">
            Loading products&hellip;
          </p>
        )}

        {status === STATUS.FAILED && (
          <div className="home_status home_status--error" role="alert">
            <p>{error}</p>
            <button type="button" className="button-effect" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {status === STATUS.EMPTY && (
          <p className="home_status" role="status">
            No products are available right now. Run <code>npm run seed:products</code> to
            populate the catalogue.
          </p>
        )}

        {status === STATUS.READY && (
          <Box sx={{ width: '100%' }}>
            <Grid container rowSpacing={1} columnSpacing={1.25}>
              {products.map((product) => (
                // The key belongs on the outermost element produced by map(),
                // which is this Grid - not on the Product nested inside it.
                <Grid container spacing={0.5} size={4} key={product.id}>
                  <Product product={product} />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </div>
    </div>
  );
}

export default Home;

// Exported for tests, so they assert on a shared constant rather than on
// duplicated string literals.
export { STATUS };

// A module-level breadcrumb: if the homepage renders at all, this ran.
logger.debug('ui.home.module_loaded');
