import axios from "axios";

const instance = axios.create({
    baseURL: 'http://127.0.0.1:5001/clone-72e22/us-central1/api' // The API (cloud function) url
});

export default instance;