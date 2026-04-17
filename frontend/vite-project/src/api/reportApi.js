import axios from "./axios";

// 📅 Daily
export const getDailySales = (start, end) =>
  axios.get(`reports/daily/?start=${start || ""}&end=${end || ""}`);

// 📄 Sales report (FIXED)
export const getSalesReport = (start, end) =>
  axios.get(`reports/?start=${start || ""}&end=${end || ""}`);

// 📦 Item-wise
export const getItemSales = (start, end) =>
  axios.get(`reports/items/?start=${start || ""}&end=${end || ""}`);