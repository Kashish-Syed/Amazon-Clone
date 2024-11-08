import { db } from './firebase';
import { storage } from './firebase';

async function addProduct(product) {
    try {
        await db.collection("products").add(product);
        console.log("Product added successfullu!")
    } catch {
        console.error("Error adding product", error);
    }
}

async function uploadImage(file) {
    const storageRef = storage.ref();
    const imageRef = storageRef.child(`images/${file.name}`);
}

addProduct({
    name: "Sample Product",
    price: 29.99,
    description: "Sample product description",
    imageUrl: "https://linktoimage.com/image.jpg",
    rating: 4
  });