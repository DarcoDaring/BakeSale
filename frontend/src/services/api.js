import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/token/refresh/`, { refresh });
          localStorage.setItem('access_token', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (username, password) =>
  axios.post(`${API_BASE}/token/`, { username, password });

// Vendors
export const getVendors   = ()      => api.get('/vendors/');
export const createVendor = d       => api.post('/vendors/', d);
export const updateVendor = (id, d) => api.patch(`/vendors/${id}/`, d);
export const deleteVendor = id      => api.delete(`/vendors/${id}/`);

// Products
export const searchProducts      = q       => api.get(`/products/search/?q=${q}`);
export const getProductByBarcode = bc      => api.get(`/products/by_barcode/?barcode=${bc}`);
export const createProduct       = d       => api.post('/products/', d);
export const updateProduct       = (id, d) => api.patch(`/products/${id}/`, d);
export const getProducts         = ()      => api.get('/products/');
export const getStockStatus      = ()      => api.get('/products/stock_status/');

// Purchases
export const createPurchaseBill = d      => api.post('/purchases/', d);
export const getPurchases       = ()     => api.get('/purchases/');
export const getPurchaseBill    = id     => api.get(`/purchases/${id}/`);
export const getPurchaseReport  = params => api.get('/purchases/report/', { params });

// Bills
export const createBill        = d       => api.post('/bills/', d);
export const getBills          = ()      => api.get('/bills/');
export const getBill           = id      => api.get(`/bills/${id}/`);
export const getSaleReport     = params  => api.get('/bills/sale_report/',      { params });
export const getItemWiseReport = params  => api.get('/bills/item_wise_report/', { params });
export const editBillPayment   = (id, d) => api.patch(`/bills/${id}/edit_payment/`, d);
export const deleteBill        = id      => api.delete(`/bills/${id}/`);

// Customer Returns
export const createReturn = d  => api.post('/returns/', d);
export const getReturns   = () => api.get('/returns/');

// Purchase Returns
export const createPurchaseReturn    = d      => api.post('/purchase-returns/', d);
export const getPurchaseReturnReport = params => api.get('/purchase-returns/report/', { params });
export const markPurchaseReturned    = id     => api.patch(`/purchase-returns/${id}/mark_returned/`, {});

// Internal Sale Masters
export const getInternalMasters   = ()      => api.get('/internal-masters/');
export const createInternalMaster = d       => api.post('/internal-masters/', d);
export const updateInternalMaster = (id, d) => api.patch(`/internal-masters/${id}/`, d);
export const deleteInternalMaster = id      => api.delete(`/internal-masters/${id}/`);

// Internal Sales
export const createInternalSale    = d      => api.post('/internal-sales/', d);
export const getInternalSaleReport = params => api.get('/internal-sales/report/', { params });

// Direct Sale Masters
export const getDirectMasters   = ()      => api.get('/direct-masters/');
export const createDirectMaster = d       => api.post('/direct-masters/', d);
export const updateDirectMaster = (id, d) => api.patch(`/direct-masters/${id}/`, d);

// Direct Sales
export const createDirectSale = d => api.post('/direct-sales/', d);

// Stock Adjustments
export const createStockAdjustment  = d  => api.post('/stock-adjustments/', d);
export const getStockAdjustments    = () => api.get('/stock-adjustments/');
export const approveStockAdjustment = id => api.patch(`/stock-adjustments/${id}/approve/`, {});
export const rejectStockAdjustment  = id => api.patch(`/stock-adjustments/${id}/reject/`, {});

// Users
export const getUsers   = ()      => api.get('/users/');
export const createUser = d       => api.post('/users/', d);
export const updateUser = (id, d) => api.patch(`/users/${id}/`, d);
export const deleteUser = id      => api.delete(`/users/${id}/`);
export const getMe      = ()      => api.get('/users/me/');

export default api;