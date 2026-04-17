import axios from "./axios";

export const searchProducts = (query) =>
  axios.get(`products/search/?q=${query}`);

export const createProduct = (data) =>
  axios.post("products/create/", data);

export const generateBarcode = () =>
  axios.get("products/generate-barcode/");