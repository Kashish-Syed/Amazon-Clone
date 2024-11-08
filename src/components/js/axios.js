import axios from "axios";

const instance = axios.create({
    baseURL: 'https://us-central1-clone-72e22.cloudfunctions.net/api'
    // 'http://127.0.0.1:5001/clone-72e22/us-central1/api' // The API (cloud function) url
});

export default instance;
