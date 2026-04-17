import axios from "./axios";

export const createPurchase = (data) =>
  axios.post("purchases/create/", data);

export const getSuppliers = () =>
  axios.get("purchases/suppliers/");

export const createSupplier = (data) =>
  axios.post("purchases/suppliers/create/", data);