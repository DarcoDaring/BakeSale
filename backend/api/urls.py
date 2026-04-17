from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'users',             views.UserViewSet)
router.register(r'vendors',           views.VendorViewSet)
router.register(r'products',          views.ProductViewSet)
router.register(r'purchases',         views.PurchaseBillViewSet)
router.register(r'bills',             views.SaleBillViewSet)
router.register(r'returns',           views.ReturnItemViewSet)
router.register(r'internal-masters',  views.InternalSaleMasterViewSet)
router.register(r'internal-sales',    views.InternalSaleViewSet)
router.register(r'purchase-returns',  views.PurchaseReturnViewSet)
router.register(r'direct-masters',    views.DirectSaleMasterViewSet)
router.register(r'direct-sales',      views.DirectSaleViewSet)
router.register(r'stock-adjustments', views.StockAdjustmentRequestViewSet)

urlpatterns = [
    path('', include(router.urls)),
]