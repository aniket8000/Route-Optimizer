import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function optimizeRoute(stops) {
  const { data } = await axios.post(`${BASE_URL}/routes/optimize`, { stops });
  return data; // { stops, order, legs, totalDuration, totalDistance }
}

export async function saveRoute({ driverName, stops, order, legs, totalDuration, totalDistance }, token) {
  const { data } = await axios.post(
    `${BASE_URL}/routes`,
    { driverName, stops, order, legs, totalDuration, totalDistance },
    authHeaders(token)
  );
  return data;
}

export async function listRoutes(token) {
  const { data } = await axios.get(`${BASE_URL}/routes`, authHeaders(token));
  return data;
}

export async function deleteRoute(id, token) {
  await axios.delete(`${BASE_URL}/routes/${id}`, authHeaders(token));
}

export async function registerUser({ name, email, password }) {
  const { data } = await axios.post(`${BASE_URL}/auth/register`, { name, email, password });
  return data; // { token, user }
}

export async function loginUser({ email, password }) {
  const { data } = await axios.post(`${BASE_URL}/auth/login`, { email, password });
  return data; // { token, user }
}
