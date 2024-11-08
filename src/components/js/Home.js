import React, { useEffect, useState } from 'react';
import '../css/Home.css';
import Product from './Product';
import '../css/App.css';
import { db } from '../../database/firebase';
import { collection, getDocs } from 'firebase/firestore';
import Grid from '@mui/material/Grid2';
import Box from '@mui/material/Box';

function Home() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProducts = async () => {
      const productsCollection = collection(db, 'products');
      const productSnapshot = await getDocs(productsCollection);
      const productList = productSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productList);
    };

    fetchProducts();
  }, []);

  return (
    <div className='home'>
      <div className='home_container'>
        <img className='home_image' src="/images/amazon_banner.jpg" alt="amazon_banner"/>

        {/* <div className='home_row grid_container'>
          {products.map((product) => (
            <Product 
              key={product.id}
              id={product.id}
              title={product.title}
              price={product.price}
              description={product.description}
              image={product.image}
              rating={product.rating}
            />
          ))}
        </div> */}


        <Box sx={{ width:'100%'}}>
          <Grid container rowSpacing={1} columnSpacing={1.25}>
            {products.map((product) => (
              <Grid container spacing={0.5} size={4}> 
                <Product 
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  price={product.price}
                  description={product.description}
                  image={product.image}
                  rating={product.rating}
                /> 
              </Grid>
            ))}
          </Grid>
        </Box>
      </div>
    </div>
  )
}

export default Home
