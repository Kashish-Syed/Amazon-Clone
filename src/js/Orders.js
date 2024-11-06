import React, { useEffect, useState } from 'react';
import '../css/Orders.css';
import { db } from './firebase';
import { useStateValue } from './StateProvider';
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import Order from './Order';

function Orders() {
    const [{ basket, user }, dispatch] = useStateValue();
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        if (user) {
            const ordersRef = collection(db, 'users', user.uid, 'orders');
            const ordersQuery = query(ordersRef, orderBy('created', 'desc'));
    
            const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
                setOrders(snapshot.docs.map(doc => ({
                    id: doc.id,
                    data: doc.data()
                })));
            });
    
            // Cleanup listener on unmount
            return () => unsubscribe();
        } else {
            setOrders([]);
        }
    }, [user]);

  return (
    <div className='orders'>
      <h1>Your Orders</h1>
      <div className="orders_order">
        {orders?.map(order => (
            <Order order={order} />
        ))}
      </div>
    </div>
  )
}

export default Orders
