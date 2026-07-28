import { db } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

// Helpers for reading and seeding the product catalogue.
//
// This module previously used the Firebase v8 API (`db.collection(...).add(...)`)
// against a v9 SDK, imported a `storage` export that did not exist, referenced an
// undefined `error` variable in its catch block, and ran addProduct() as an
// import-time side effect. None of that ran because nothing imported the file.
//
// Note: firestore.rules blocks writes to `products` from the client, which is the
// correct posture for a public catalogue. Seed the catalogue from the Firebase
// console, or temporarily relax the rule while seeding.

export async function fetchProducts() {
  const snapshot = await getDocs(collection(db, 'products'));
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

export async function addProduct(product) {
  try {
    const docRef = await addDoc(collection(db, 'products'), product);
    console.log('Product added successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    // The bare `catch {}` here used to swallow the real cause and then throw a
    // second, confusing ReferenceError on the undefined `error`.
    console.error('Error adding product:', error);
    throw error;
  }
}

// Shape the rest of the app expects. Product.js reads title/description/image/
// price/rating - note `title` and `image`, not `name` and `imageUrl`, which is
// what the old sample object used, so seeded rows rendered blank.
export const SAMPLE_PRODUCT = {
  title: 'Sample Product',
  description: 'Sample product description',
  image: '/images/product1.jpg',
  price: 29.99,
  rating: 4,
};
