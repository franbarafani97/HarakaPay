import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000/api/v1`;

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

export const apiBaseURL = baseURL;
