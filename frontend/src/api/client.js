import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true
});

client.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default client;
