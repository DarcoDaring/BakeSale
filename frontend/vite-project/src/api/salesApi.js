import axios from "./axios";

// ✅ CREATE SALE
export const createSale = (data) =>
  axios.post("sales/create/", data);

// ✅ GET ALL SALES
export const getAllSales = () =>
  axios.get("sales/");

// ✅ DELETE SALE
export const deleteSale = (id) =>
  axios.delete(`sales/${id}/`);

// ✅ UPDATE SALE
export const updateSale = (id, data) =>
  axios.put(`sales/${id}/`, data);

// ✅ GET SINGLE SALE
export const getSaleById = (id) =>
  axios.get(`sales/${id}/`);