import React, { useState } from 'react';
import '../css/Login.css';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../database/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const signIn = e => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                navigate('/');
        })
        .catch((error) => {
            alert(error.message);
        })
    }

    const register = e => {
        e.preventDefault();
        createUserWithEmailAndPassword(auth, email, password).then((userCredential) => {
            // if things come here it has succefully created a user with email and password
            if (userCredential) {
                navigate('/');
            }
        })
        .catch(error => alert(error.message));
    }

  return (
    <div className='login'>
      <Link to='/'>
        <img 
            className='login_logo' 
            src='./images/Amazon_logo.svg.png' 
            alt='' 
        />
      </Link>

      <div className='login_container'>
        <h1>Sign In</h1>

        <form>
            <h5>Email</h5>
            <input type='text' value={email} onChange={e => setEmail(e.target.value)}/>
            <h5>Password</h5>
            <input type='password' value={password} onChange={e => setPassword(e.target.value)}/>
            <button type='submit' onClick={signIn}
            className='login_signInButton'>Sign In</button>
        </form>

        <p>
            By signing in you agree to 
            Amazon FAKE CLONE's Conditions 
            for use & sale... blah blahblah
        </p>

        <button onClick={register} className='login_registerButton'>Create your Amazon account</button>
      </div>
    </div>
  )
}

export default Login
