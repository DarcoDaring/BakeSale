from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django.db.models import Sum, Q
from django.utils import timezone

from .models import (
    User, Vendor, Product, StockBatch, PurchaseBill, Purchase,
    SaleBill, SaleItem, ReturnItem,
    InternalSaleMaster, InternalSale, PurchaseReturn,
    DirectSaleMaster, DirectSale, StockAdjustmentRequest
)
from .serializers import (
    CustomTokenObtainPairSerializer, UserSerializer, VendorSerializer,
    ProductSerializer, PurchaseBillSerializer, PurchaseBillListSerializer,
    PurchaseItemSerializer,
    SaleBillSerializer, SaleBillListSerializer,
    ReturnItemSerializer, InternalSaleMasterSerializer, InternalSaleSerializer,
    PurchaseReturnSerializer, DirectSaleMasterSerializer, DirectSaleSerializer,
    StockAdjustmentRequestSerializer
)
from .permissions import IsAdminUser


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class   = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class UserViewSet(viewsets.ModelViewSet):
    queryset           = User.objects.all().order_by('-created_at')
    serializer_class   = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        return Response(UserSerializer(request.user).data)


class VendorViewSet(viewsets.ModelViewSet):
    queryset           = Vendor.objects.all().order_by('name')
    serializer_class   = VendorSerializer
    permission_classes = [IsAuthenticated]


def product_to_batch_rows(products):
    rows = []
    for p in products:
        batches = list(p.batches.filter(quantity__gt=0).order_by('mrp', 'created_at'))
        if not batches:
            rows.append({
                'id': p.id, 'barcode': p.barcode, 'name': p.name,
                'selling_price': str(p.selling_price), 'selling_unit': p.selling_unit,
                'stock_quantity': '0', 'is_active': p.is_active,
                'batch_id': None, 'batch_mrp': None, 'multi_batch': False,
            })
        elif len(batches) == 1:
            b = batches[0]
            rows.append({
                'id': p.id, 'barcode': p.barcode, 'name': p.name,
                'selling_price': str(b.mrp), 'selling_unit': p.selling_unit,
                'stock_quantity': str(b.quantity), 'is_active': p.is_active,
                'batch_id': b.id, 'batch_mrp': str(b.mrp), 'multi_batch': False,
            })
        else:
            for b in batches:
                rows.append({
                    'id': p.id, 'barcode': p.barcode, 'name': p.name,
                    'selling_price': str(b.mrp), 'selling_unit': p.selling_unit,
                    'stock_quantity': str(b.quantity), 'is_active': p.is_active,
                    'batch_id': b.id, 'batch_mrp': str(b.mrp), 'multi_batch': True,
                })
    return rows


class ProductViewSet(viewsets.ModelViewSet):
    queryset           = Product.objects.all().order_by('name')
    serializer_class   = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter]
    search_fields      = ['name', 'barcode']

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        products = Product.objects.filter(
            Q(name__icontains=query) | Q(barcode__icontains=query),
            is_active=True
        ).prefetch_related('batches')[:20]
        return Response(product_to_batch_rows(list(products)))

    @action(detail=False, methods=['get'])
    def by_barcode(self, request):
        barcode = request.query_params.get('barcode', '')
        if not barcode:
            return Response({'error': 'Barcode required'}, status=400)
        try:
            product = Product.objects.prefetch_related('batches').get(
                barcode=barcode, is_active=True
            )
            return Response(product_to_batch_rows([product]))
        except Product.DoesNotExist:
            return Response({'error': 'Product not found or disabled'}, status=404)

    @action(detail=False, methods=['get'])
    def stock_status(self, request):
        return Response(
            ProductSerializer(
                Product.objects.filter(is_active=True).order_by('name').prefetch_related('batches'),
                many=True
            ).data
        )


class PurchaseBillViewSet(viewsets.ModelViewSet):
    queryset           = PurchaseBill.objects.all().order_by('-date')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return PurchaseBillListSerializer
        return PurchaseBillSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def report(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')

        bills = PurchaseBill.objects.all().prefetch_related('items', 'vendor')
        if date_from:
            bills = bills.filter(date__date__gte=date_from)
        if date_to:
            bills = bills.filter(date__date__lte=date_to)
        bills = bills.order_by('-date')

        result = []
        grand_total = 0
        for b in bills:
            total_purchase_price = 0
            total_tax_amount     = 0
            total_value          = 0
            for item in b.items.all():
                qty   = float(item.quantity) * float(item.selling_qty)
                price = float(item.purchase_price)
                tax   = float(item.tax)
                base  = qty * price
                tax_a = base * tax / 100
                total_purchase_price += base
                total_tax_amount     += tax_a
                total_value          += base + tax_a
            grand_total += total_value
            result.append({
                'id':                   b.id,
                'purchase_number':      b.purchase_number,
                'vendor_name':          b.vendor.name if b.vendor else '—',
                'is_paid':              b.is_paid,
                'date':                 b.date,
                'total_purchase_price': round(total_purchase_price, 2),
                'total_tax':            round(total_tax_amount, 2),
                'total_value':          round(total_value, 2),
                'item_count':           b.items.count(),
            })

        return Response({'bills': result, 'grand_total': round(grand_total, 2)})


class SaleBillViewSet(viewsets.ModelViewSet):
    queryset           = SaleBill.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return SaleBillListSerializer
        return SaleBillSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['patch'])
    def edit_payment(self, request, pk=None):
        bill         = self.get_object()
        payment_type = request.data.get('payment_type')
        cash_amount  = float(request.data.get('cash_amount', 0))
        card_amount  = float(request.data.get('card_amount', 0))
        upi_amount   = float(request.data.get('upi_amount',  0))
        valid_types  = ['cash', 'card', 'upi', 'cash_card', 'cash_upi']
        if payment_type not in valid_types:
            return Response({'error': 'Invalid payment type.'}, status=400)
        bill.payment_type = payment_type
        bill.cash_amount  = cash_amount
        bill.card_amount  = card_amount
        bill.upi_amount   = upi_amount
        bill.save()
        return Response(SaleBillListSerializer(bill).data)

    def destroy(self, request, *args, **kwargs):
        from decimal import Decimal
        bill = self.get_object()
        for item in bill.items.all():
            product = item.product
            qty     = Decimal(str(item.quantity))
            if item.batch:
                item.batch.quantity = Decimal(str(item.batch.quantity)) + qty
                item.batch.save()
            else:
                latest = StockBatch.objects.filter(product=product).order_by('-mrp', '-created_at').first()
                if latest:
                    latest.quantity = Decimal(str(latest.quantity)) + qty; latest.save()
                else:
                    StockBatch.objects.create(product=product, mrp=product.selling_price, quantity=qty)
            product.stock_quantity = Decimal(str(product.stock_quantity)) + qty
            product.save()
        bill.delete()
        return Response({'message': 'Bill deleted and stock restored'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def sale_report(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')

        # Default to today if no dates provided
        if not date_from and not date_to:
            today     = timezone.localdate()
            date_from = str(today)
            date_to   = str(today)

        bills = SaleBill.objects.all()
        if date_from: bills = bills.filter(created_at__date__gte=date_from)
        if date_to:   bills = bills.filter(created_at__date__lte=date_to)
        bills = bills.order_by('-created_at')

        grand_total      = bills.aggregate(t=Sum('total_amount'))['t'] or 0
        pure_cash_total  = bills.filter(payment_type='cash').aggregate(t=Sum('total_amount'))['t'] or 0
        split_cash_total = bills.filter(payment_type__in=['cash_card','cash_upi']).aggregate(t=Sum('cash_amount'))['t'] or 0
        cash_total       = float(pure_cash_total) + float(split_cash_total)
        pure_card_total  = bills.filter(payment_type='card').aggregate(t=Sum('total_amount'))['t'] or 0
        split_card_total = bills.filter(payment_type='cash_card').aggregate(t=Sum('card_amount'))['t'] or 0
        card_total       = float(pure_card_total) + float(split_card_total)
        pure_upi_total   = bills.filter(payment_type='upi').aggregate(t=Sum('total_amount'))['t'] or 0
        split_upi_total  = bills.filter(payment_type='cash_upi').aggregate(t=Sum('upi_amount'))['t'] or 0
        upi_total        = float(pure_upi_total) + float(split_upi_total)

        return Response({
            'bills': SaleBillListSerializer(bills, many=True).data,
            'totals': {
                'grand_total': grand_total,
                'cash_total':  cash_total,
                'card_total':  card_total,
                'upi_total':   upi_total,
            },
            'date_from': date_from,
            'date_to':   date_to,
        })

    @action(detail=False, methods=['get'])
    def item_wise_report(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        items = SaleItem.objects.all()
        if date_from: items = items.filter(bill__created_at__date__gte=date_from)
        if date_to:   items = items.filter(bill__created_at__date__lte=date_to)
        report = items.values(
            'product__id', 'product__name', 'product__barcode', 'price'
        ).annotate(total_qty=Sum('quantity')).order_by('product__name')
        return Response([{
            'product_id': r['product__id'], 'product_name': r['product__name'],
            'product_barcode': r['product__barcode'], 'mrp': r['price'],
            'quantity_sold': r['total_qty'],
            'total_amount': float(r['price']) * float(r['total_qty']),
        } for r in report])


class ReturnItemViewSet(viewsets.ModelViewSet):
    queryset           = ReturnItem.objects.all().order_by('-date')
    serializer_class   = ReturnItemSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(processed_by=self.request.user)


class InternalSaleMasterViewSet(viewsets.ModelViewSet):
    queryset           = InternalSaleMaster.objects.all().order_by('name')
    serializer_class   = InternalSaleMasterSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class InternalSaleViewSet(viewsets.ModelViewSet):
    queryset           = InternalSale.objects.all().order_by('-date')
    serializer_class   = InternalSaleSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def report(self, request):
        date_from    = request.query_params.get('date_from')
        date_to      = request.query_params.get('date_to')
        dest_ids_raw = request.query_params.get('destinations', '')
        items = InternalSale.objects.all()
        if date_from: items = items.filter(date__date__gte=date_from)
        if date_to:   items = items.filter(date__date__lte=date_to)
        if dest_ids_raw:
            dest_ids = [int(x) for x in dest_ids_raw.split(',') if x.strip().isdigit()]
            if dest_ids: items = items.filter(destination__id__in=dest_ids)
        report = items.values(
            'product__id', 'product__name', 'product__barcode',
            'destination__id', 'destination__name', 'price'
        ).annotate(total_qty=Sum('quantity')).order_by('destination__name', 'product__name')
        return Response([{
            'product_id': r['product__id'], 'product_name': r['product__name'],
            'product_barcode': r['product__barcode'], 'destination_id': r['destination__id'],
            'destination_name': r['destination__name'], 'mrp': r['price'],
            'quantity': r['total_qty'], 'total_amount': float(r['price']) * float(r['total_qty']),
        } for r in report])


class PurchaseReturnViewSet(viewsets.ModelViewSet):
    queryset           = PurchaseReturn.objects.all().order_by('-date')
    serializer_class   = PurchaseReturnSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        product = serializer.validated_data.get('product')
        last_purchase = Purchase.objects.filter(product=product).order_by('-date').first()
        if last_purchase:
            serializer.save(
                created_by=self.request.user,
                purchase_price=last_purchase.purchase_price,
                tax=last_purchase.tax,
            )
        else:
            serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['patch'])
    def mark_returned(self, request, pk=None):
        """Mark a purchase return as physically returned to vendor."""
        pr = self.get_object()
        pr.status = 'returned'
        pr.save()
        return Response(PurchaseReturnSerializer(pr).data)

    @action(detail=False, methods=['get'])
    def report(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        returns = PurchaseReturn.objects.all()
        if date_from: returns = returns.filter(date__date__gte=date_from)
        if date_to:   returns = returns.filter(date__date__lte=date_to)
        returns = returns.order_by('-date')

        result = []
        for r in returns:
            price_with_tax = float(r.purchase_price) * (1 + float(r.tax) / 100)
            result.append({
                'id':              r.id,
                'product_name':    r.product.name,
                'product_barcode': r.product.barcode,
                'quantity':        float(r.quantity),
                'purchase_price':  float(r.purchase_price),
                'tax':             float(r.tax),
                'item_cost':       round(price_with_tax * float(r.quantity), 2),
                'reason':          r.reason,
                'status':          r.status,
                'date':            r.date,
            })
        pending_count = PurchaseReturn.objects.filter(status='pending').count()
        return Response({
            'returns':       result,
            'total_cost':    sum(r['item_cost'] for r in result),
            'pending_count': pending_count,
        })


class DirectSaleMasterViewSet(viewsets.ModelViewSet):
    queryset           = DirectSaleMaster.objects.all().order_by('name')
    serializer_class   = DirectSaleMasterSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class DirectSaleViewSet(viewsets.ModelViewSet):
    queryset           = DirectSale.objects.all().order_by('-date')
    serializer_class   = DirectSaleSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class StockAdjustmentRequestViewSet(viewsets.ModelViewSet):
    queryset           = StockAdjustmentRequest.objects.all().order_by('-created_at')
    serializer_class   = StockAdjustmentRequestSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=['patch'])
    def approve(self, request, pk=None):
        from decimal import Decimal
        from django.utils import timezone
        adj = self.get_object()
        if adj.status != 'pending':
            return Response({'error': 'Already reviewed'}, status=400)

        product = adj.product
        new_qty = Decimal(str(adj.physical_stock))

        # Adjust product stock
        product.stock_quantity = new_qty
        product.save()

        # Adjust batches proportionally — simplest: clear and set single batch at current price
        old_total = sum(
            Decimal(str(b.quantity))
            for b in StockBatch.objects.filter(product=product, quantity__gt=0)
        )
        if old_total > 0:
            ratio = new_qty / old_total
            for b in StockBatch.objects.filter(product=product):
                b.quantity = (Decimal(str(b.quantity)) * ratio).quantize(Decimal('0.001'))
                b.save()
        elif new_qty > 0:
            StockBatch.objects.create(product=product, mrp=product.selling_price, quantity=new_qty)

        adj.status      = 'approved'
        adj.reviewed_by = request.user
        adj.reviewed_at = timezone.now()
        adj.save()
        return Response(StockAdjustmentRequestSerializer(adj).data)

    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        from django.utils import timezone
        adj = self.get_object()
        if adj.status != 'pending':
            return Response({'error': 'Already reviewed'}, status=400)
        adj.status      = 'rejected'
        adj.reviewed_by = request.user
        adj.reviewed_at = timezone.now()
        adj.save()
        return Response(StockAdjustmentRequestSerializer(adj).data)