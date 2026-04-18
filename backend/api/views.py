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
    DirectSaleMaster, DirectSale, StockAdjustmentRequest, StockTransfer
)
from .serializers import (
    CustomTokenObtainPairSerializer, UserSerializer, VendorSerializer,
    ProductSerializer, PurchaseBillSerializer, PurchaseBillListSerializer,
    PurchaseItemSerializer,
    SaleBillSerializer, SaleBillListSerializer,
    ReturnItemSerializer, InternalSaleMasterSerializer, InternalSaleSerializer,
    PurchaseReturnSerializer, DirectSaleMasterSerializer, DirectSaleSerializer,
    StockAdjustmentRequestSerializer, StockTransferSerializer
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
            rows.append({'id': p.id, 'barcode': p.barcode, 'name': p.name,
                'selling_price': str(p.selling_price), 'selling_unit': p.selling_unit,
                'stock_quantity': '0', 'is_active': p.is_active,
                'batch_id': None, 'batch_mrp': None, 'multi_batch': False})
        elif len(batches) == 1:
            b = batches[0]
            rows.append({'id': p.id, 'barcode': p.barcode, 'name': p.name,
                'selling_price': str(b.mrp), 'selling_unit': p.selling_unit,
                'stock_quantity': str(b.quantity), 'is_active': p.is_active,
                'batch_id': b.id, 'batch_mrp': str(b.mrp), 'multi_batch': False})
        else:
            for b in batches:
                rows.append({'id': p.id, 'barcode': p.barcode, 'name': p.name,
                    'selling_price': str(b.mrp), 'selling_unit': p.selling_unit,
                    'stock_quantity': str(b.quantity), 'is_active': p.is_active,
                    'batch_id': b.id, 'batch_mrp': str(b.mrp), 'multi_batch': True})
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
        if not query: return Response([])
        products = Product.objects.filter(
            Q(name__icontains=query) | Q(barcode__icontains=query), is_active=True
        ).prefetch_related('batches')[:20]
        return Response(product_to_batch_rows(list(products)))

    @action(detail=False, methods=['get'])
    def by_barcode(self, request):
        barcode = request.query_params.get('barcode', '')
        if not barcode: return Response({'error': 'Barcode required'}, status=400)
        try:
            product = Product.objects.prefetch_related('batches').get(barcode=barcode, is_active=True)
            return Response(product_to_batch_rows([product]))
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)

    @action(detail=False, methods=['get'])
    def stock_status(self, request):
        return Response(ProductSerializer(
            Product.objects.filter(is_active=True).order_by('name').prefetch_related('batches'),
            many=True).data)


class PurchaseBillViewSet(viewsets.ModelViewSet):
    queryset           = PurchaseBill.objects.all().order_by('-date')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list': return PurchaseBillListSerializer
        return PurchaseBillSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def report(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        bills = PurchaseBill.objects.all().prefetch_related('items', 'vendor')
        if date_from: bills = bills.filter(date__date__gte=date_from)
        if date_to:   bills = bills.filter(date__date__lte=date_to)
        bills = bills.order_by('-date')

        result = []
        grand_total = 0
        for b in bills:
            total_purchase_price = 0
            total_tax_amount     = 0
            total_value          = 0
            for item in b.items.all():
                # FIX: quantity × purchase_price (NOT × selling_qty)
                qty   = float(item.quantity)
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

    @action(detail=False, methods=['get'])
    def purchase_tax_report(self, request):
        """Purchase tax report: CGST + SGST on purchase price."""
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        bills = PurchaseBill.objects.all().prefetch_related('items__product', 'vendor')
        if date_from: bills = bills.filter(date__date__gte=date_from)
        if date_to:   bills = bills.filter(date__date__lte=date_to)
        bills = bills.order_by('-date')

        result = []
        grand_taxable = 0; grand_cgst = 0; grand_sgst = 0; grand_total = 0
        for b in bills:
            taxable = 0; total_tax = 0
            for item in b.items.all():
                qty   = float(item.quantity)
                price = float(item.purchase_price)
                tax   = float(item.tax)
                base  = qty * price
                taxable   += base
                total_tax += base * tax / 100
            cgst = total_tax / 2
            sgst = total_tax / 2
            total = taxable + total_tax
            grand_taxable += taxable; grand_cgst += cgst
            grand_sgst += sgst; grand_total += total
            result.append({
                'purchase_number': b.purchase_number,
                'vendor_name':     b.vendor.name if b.vendor else '—',
                'date':            b.date,
                'taxable_amount':  round(taxable, 2),
                'cgst':            round(cgst, 2),
                'sgst':            round(sgst, 2),
                'total_tax':       round(total_tax, 2),
                'total_amount':    round(total, 2),
            })
        return Response({
            'bills': result,
            'grand_taxable': round(grand_taxable, 2),
            'grand_cgst':    round(grand_cgst, 2),
            'grand_sgst':    round(grand_sgst, 2),
            'grand_total':   round(grand_total, 2),
        })


class SaleBillViewSet(viewsets.ModelViewSet):
    queryset           = SaleBill.objects.all().order_by('-created_at')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list': return SaleBillListSerializer
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
        if payment_type not in ['cash', 'card', 'upi', 'cash_card', 'cash_upi']:
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
        if not date_from and not date_to:
            today     = timezone.localdate()
            date_from = str(today)
            date_to   = str(today)
        bills = SaleBill.objects.all()
        if date_from: bills = bills.filter(created_at__date__gte=date_from)
        if date_to:   bills = bills.filter(created_at__date__lte=date_to)
        bills = bills.order_by('-created_at')

        grand_total      = bills.aggregate(t=Sum('total_amount'))['t'] or 0
        pure_cash        = bills.filter(payment_type='cash').aggregate(t=Sum('total_amount'))['t'] or 0
        split_cash       = bills.filter(payment_type__in=['cash_card','cash_upi']).aggregate(t=Sum('cash_amount'))['t'] or 0
        cash_total       = float(pure_cash) + float(split_cash)
        pure_card        = bills.filter(payment_type='card').aggregate(t=Sum('total_amount'))['t'] or 0
        split_card       = bills.filter(payment_type='cash_card').aggregate(t=Sum('card_amount'))['t'] or 0
        card_total       = float(pure_card) + float(split_card)
        pure_upi         = bills.filter(payment_type='upi').aggregate(t=Sum('total_amount'))['t'] or 0
        split_upi        = bills.filter(payment_type='cash_upi').aggregate(t=Sum('upi_amount'))['t'] or 0
        upi_total        = float(pure_upi) + float(split_upi)

        return Response({
            'bills': SaleBillListSerializer(bills, many=True).data,
            'totals': {
                'grand_total': grand_total, 'cash_total': cash_total,
                'card_total': card_total, 'upi_total': upi_total,
            },
            'date_from': date_from, 'date_to': date_to,
        })

    @action(detail=False, methods=['get'])
    def item_wise_report(self, request):
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        items = SaleItem.objects.all()
        if date_from: items = items.filter(bill__created_at__date__gte=date_from)
        if date_to:   items = items.filter(bill__created_at__date__lte=date_to)
        report = items.values('product__id', 'product__name', 'product__barcode', 'price'
            ).annotate(total_qty=Sum('quantity')).order_by('product__name')
        return Response([{
            'product_id': r['product__id'], 'product_name': r['product__name'],
            'product_barcode': r['product__barcode'], 'mrp': r['price'],
            'quantity_sold': r['total_qty'],
            'total_amount': float(r['price']) * float(r['total_qty']),
        } for r in report])

    @action(detail=False, methods=['get'])
    def sales_tax_report(self, request):
        """
        Sales tax on COST PER ITEM = purchase_price ÷ selling_qty.
        CGST = SGST = (cost_per_item × qty_sold × tax%) ÷ 2
        """
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        bills = SaleBill.objects.all().prefetch_related('items__product__purchases')
        if date_from: bills = bills.filter(created_at__date__gte=date_from)
        if date_to:   bills = bills.filter(created_at__date__lte=date_to)
        bills = bills.order_by('-created_at')

        result = []
        grand_bill_total = 0; grand_taxable = 0
        grand_cgst = 0; grand_sgst = 0; grand_tax = 0

        for b in bills:
            taxable_amount = 0; total_tax = 0
            for item in b.items.all():
                qty = float(item.quantity)
                last_purchase = item.product.purchases.order_by('-date').first()
                if last_purchase:
                    purchase_price = float(last_purchase.purchase_price)
                    selling_qty    = float(last_purchase.selling_qty) or 1
                    tax_pct        = float(last_purchase.tax)
                    # Cost per selling unit = purchase_price ÷ selling_qty
                    cost_per_item  = purchase_price / selling_qty
                    item_taxable   = cost_per_item * qty
                    item_tax       = item_taxable * tax_pct / 100
                else:
                    item_taxable = 0; item_tax = 0
                taxable_amount += item_taxable
                total_tax      += item_tax

            cgst = total_tax / 2
            sgst = total_tax / 2
            bill_total = float(b.total_amount)
            grand_bill_total += bill_total
            grand_taxable    += taxable_amount
            grand_cgst       += cgst
            grand_sgst       += sgst
            grand_tax        += total_tax

            result.append({
                'bill_number':    b.bill_number,
                'date':           b.created_at,
                'total_amount':   round(bill_total, 2),
                'taxable_amount': round(taxable_amount, 2),
                'cgst':           round(cgst, 2),
                'sgst':           round(sgst, 2),
                'total_tax':      round(total_tax, 2),
            })

        return Response({
            'bills':             result,
            'grand_bill_total':  round(grand_bill_total, 2),
            'grand_taxable':     round(grand_taxable, 2),
            'grand_cgst':        round(grand_cgst, 2),
            'grand_sgst':        round(grand_sgst, 2),
            'grand_tax':         round(grand_tax, 2),
        })


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
        last    = Purchase.objects.filter(product=product).order_by('-date').first()
        if last:
            serializer.save(created_by=self.request.user, purchase_price=last.purchase_price, tax=last.tax)
        else:
            serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['patch'])
    def mark_returned(self, request, pk=None):
        pr = self.get_object()
        pr.status = 'returned'; pr.save()
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
                'id': r.id, 'product_name': r.product.name,
                'product_barcode': r.product.barcode,
                'quantity': float(r.quantity), 'purchase_price': float(r.purchase_price),
                'tax': float(r.tax), 'item_cost': round(price_with_tax * float(r.quantity), 2),
                'reason': r.reason, 'status': r.status, 'date': r.date,
            })
        pending_count = PurchaseReturn.objects.filter(status='pending').count()
        return Response({'returns': result, 'total_cost': sum(r['item_cost'] for r in result), 'pending_count': pending_count})


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
        adj = self.get_object()
        if adj.status != 'pending':
            return Response({'error': 'Already reviewed'}, status=400)
        product = adj.product
        new_qty = Decimal(str(adj.physical_stock))
        product.stock_quantity = new_qty; product.save()
        old_total = sum(Decimal(str(b.quantity)) for b in StockBatch.objects.filter(product=product, quantity__gt=0))
        if old_total > 0:
            ratio = new_qty / old_total
            for b in StockBatch.objects.filter(product=product):
                b.quantity = (Decimal(str(b.quantity)) * ratio).quantize(Decimal('0.001')); b.save()
        elif new_qty > 0:
            StockBatch.objects.create(product=product, mrp=product.selling_price, quantity=new_qty)
        adj.status = 'approved'; adj.reviewed_by = request.user; adj.reviewed_at = timezone.now(); adj.save()
        return Response(StockAdjustmentRequestSerializer(adj).data)

    @action(detail=True, methods=['patch'])
    def reject(self, request, pk=None):
        adj = self.get_object()
        if adj.status != 'pending':
            return Response({'error': 'Already reviewed'}, status=400)
        adj.status = 'rejected'; adj.reviewed_by = request.user; adj.reviewed_at = timezone.now(); adj.save()
        return Response(StockAdjustmentRequestSerializer(adj).data)


class StockTransferViewSet(viewsets.ModelViewSet):
    queryset           = StockTransfer.objects.all().order_by('-date')
    serializer_class   = StockTransferSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)