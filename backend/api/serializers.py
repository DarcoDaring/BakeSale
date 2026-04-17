from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import (
    User, Vendor, Product, StockBatch, PurchaseBill, Purchase,
    SaleBill, SaleItem, ReturnItem,
    InternalSaleMaster, InternalSale, PurchaseReturn,
    DirectSaleMaster, DirectSale, StockAdjustmentRequest
)
from decimal import Decimal


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role']     = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['role']     = self.user.role
        data['username'] = self.user.username
        data['user_id']  = self.user.id
        return data


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model  = User
        fields = ['id', 'username', 'password', 'role', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Vendor
        fields = ['id', 'name', 'phone', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class StockBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model  = StockBatch
        fields = ['id', 'mrp', 'quantity', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    batches = StockBatchSerializer(many=True, read_only=True)

    class Meta:
        model  = Product
        fields = ['id', 'barcode', 'name', 'selling_price', 'selling_unit',
                  'stock_quantity', 'damaged_quantity', 'expired_quantity',
                  'is_active', 'created_at', 'batches']
        read_only_fields = ['id', 'created_at']


class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name    = serializers.CharField(source='product.name',    read_only=True)
    product_barcode = serializers.CharField(source='product.barcode', read_only=True)

    class Meta:
        model  = Purchase
        fields = ['id', 'product', 'product_name', 'product_barcode',
                  'purchase_unit', 'quantity', 'purchase_price', 'tax',
                  'mrp', 'selling_unit', 'selling_qty', 'date']
        read_only_fields = ['id', 'date']


class PurchaseBillListSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    total_value = serializers.SerializerMethodField()
    item_count  = serializers.SerializerMethodField()

    class Meta:
        model  = PurchaseBill
        fields = ['id', 'purchase_number', 'vendor', 'vendor_name',
                  'is_paid', 'date', 'total_value', 'item_count']
        read_only_fields = ['id', 'purchase_number', 'date']

    def get_total_value(self, obj):
        total = 0
        for item in obj.items.all():
            qty   = float(item.quantity) * float(item.selling_qty)
            price = float(item.purchase_price)
            tax   = float(item.tax)
            total += qty * price * (1 + tax / 100)
        return round(total, 2)

    def get_item_count(self, obj):
        return obj.items.count()


class PurchaseBillSerializer(serializers.ModelSerializer):
    items       = PurchaseItemSerializer(many=True)
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)

    class Meta:
        model  = PurchaseBill
        fields = ['id', 'purchase_number', 'vendor', 'vendor_name',
                  'is_paid', 'items', 'date']
        read_only_fields = ['id', 'purchase_number', 'date']

    def create(self, validated_data):
        items_data      = validated_data.pop('items')
        purchase_number = PurchaseBill.generate_purchase_number()
        bill = PurchaseBill.objects.create(
            purchase_number=purchase_number,
            **validated_data
        )

        for item_data in items_data:
            product      = item_data['product']
            quantity     = item_data['quantity']
            selling_qty  = item_data.get('selling_qty', 1)
            mrp          = item_data['mrp']
            selling_unit = item_data['selling_unit']

            Purchase.objects.create(bill=bill, **item_data)

            stock_to_add = Decimal(str(float(quantity) * float(selling_qty)))
            mrp_decimal  = Decimal(str(mrp)).quantize(Decimal('0.01'))

            existing_batch = None
            for b in StockBatch.objects.filter(product=product):
                if Decimal(str(b.mrp)).quantize(Decimal('0.01')) == mrp_decimal:
                    existing_batch = b
                    break

            if existing_batch:
                existing_batch.quantity = Decimal(str(existing_batch.quantity)) + stock_to_add
                existing_batch.save()
            else:
                StockBatch.objects.create(product=product, mrp=mrp_decimal, quantity=stock_to_add)

            product.stock_quantity = Decimal(str(product.stock_quantity)) + stock_to_add
            product.selling_unit   = selling_unit
            product.selling_price  = mrp_decimal
            product.save()

        return bill


class SaleItemSerializer(serializers.ModelSerializer):
    product_name    = serializers.CharField(source='product.name',    read_only=True)
    product_barcode = serializers.CharField(source='product.barcode', read_only=True)
    subtotal        = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    batch_id        = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model  = SaleItem
        fields = ['id', 'product', 'product_name', 'product_barcode',
                  'batch_id', 'quantity', 'price', 'subtotal']


class SaleBillSerializer(serializers.ModelSerializer):
    items               = SaleItemSerializer(many=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model  = SaleBill
        fields = ['id', 'bill_number', 'total_amount', 'payment_type',
                  'cash_amount', 'card_amount', 'upi_amount',
                  'items', 'created_at', 'created_by_username']
        read_only_fields = ['id', 'bill_number', 'created_at']

    def create(self, validated_data):
        items_data  = validated_data.pop('items')
        bill_number = SaleBill.generate_bill_number()
        bill        = SaleBill.objects.create(bill_number=bill_number, **validated_data)

        for item_data in items_data:
            product  = item_data['product']
            qty      = Decimal(str(item_data['quantity']))
            price    = item_data['price']
            batch_id = item_data.pop('batch_id', None)
            batch    = None

            if batch_id:
                try:
                    batch = StockBatch.objects.get(id=batch_id, product=product)
                except StockBatch.DoesNotExist:
                    pass

            if batch:
                if batch.quantity < qty:
                    bill.delete()
                    raise serializers.ValidationError(
                        f"Insufficient stock in batch ₹{batch.mrp} for {product.name}"
                    )
                batch.quantity = Decimal(str(batch.quantity)) - qty
                batch.save()
            else:
                remaining = qty
                batches = StockBatch.objects.filter(
                    product=product, quantity__gt=0
                ).order_by('mrp', 'created_at')
                for b in batches:
                    if remaining <= 0: break
                    deduct = min(Decimal(str(b.quantity)), remaining)
                    b.quantity = Decimal(str(b.quantity)) - deduct
                    b.save()
                    remaining -= deduct
                if remaining > Decimal('0.001'):
                    bill.delete()
                    raise serializers.ValidationError(f"Insufficient stock for {product.name}")

            SaleItem.objects.create(bill=bill, batch=batch, **item_data)
            product.stock_quantity = Decimal(str(product.stock_quantity)) - qty
            if product.stock_quantity < 0:
                product.stock_quantity = Decimal('0')
            product.save()

        return bill


class SaleBillListSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model  = SaleBill
        fields = ['id', 'bill_number', 'total_amount', 'payment_type',
                  'cash_amount', 'card_amount', 'upi_amount',
                  'created_at', 'item_count']

    def get_item_count(self, obj):
        return obj.items.count()


class ReturnItemSerializer(serializers.ModelSerializer):
    product_name    = serializers.CharField(source='product.name',    read_only=True)
    product_barcode = serializers.CharField(source='product.barcode', read_only=True)

    class Meta:
        model  = ReturnItem
        fields = ['id', 'product', 'product_name', 'product_barcode',
                  'return_type', 'quantity', 'date']
        read_only_fields = ['id', 'date']

    def create(self, validated_data):
        return_item = ReturnItem.objects.create(**validated_data)
        product     = return_item.product
        qty         = Decimal(str(return_item.quantity))

        if return_item.return_type == 'customer_return':
            product.stock_quantity = Decimal(str(product.stock_quantity)) + qty
            latest_batch = StockBatch.objects.filter(product=product).order_by('-mrp', '-created_at').first()
            if latest_batch:
                latest_batch.quantity = Decimal(str(latest_batch.quantity)) + qty
                latest_batch.save()
            else:
                StockBatch.objects.create(product=product, mrp=product.selling_price, quantity=qty)
        elif return_item.return_type == 'damaged':
            product.damaged_quantity = Decimal(str(product.damaged_quantity)) + qty
            remaining = qty
            for b in StockBatch.objects.filter(product=product, quantity__gt=0).order_by('-mrp'):
                if remaining <= 0: break
                deduct = min(Decimal(str(b.quantity)), remaining)
                b.quantity = Decimal(str(b.quantity)) - deduct; b.save(); remaining -= deduct
            product.stock_quantity = Decimal(str(product.stock_quantity)) - qty
            if product.stock_quantity < 0: product.stock_quantity = Decimal('0')
        elif return_item.return_type == 'expired':
            product.expired_quantity = Decimal(str(product.expired_quantity)) + qty
            remaining = qty
            for b in StockBatch.objects.filter(product=product, quantity__gt=0).order_by('mrp'):
                if remaining <= 0: break
                deduct = min(Decimal(str(b.quantity)), remaining)
                b.quantity = Decimal(str(b.quantity)) - deduct; b.save(); remaining -= deduct
            product.stock_quantity = Decimal(str(product.stock_quantity)) - qty
            if product.stock_quantity < 0: product.stock_quantity = Decimal('0')

        product.save()
        return return_item


class InternalSaleMasterSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model  = InternalSaleMaster
        fields = ['id', 'name', 'is_active', 'created_at', 'created_by_username']
        read_only_fields = ['id', 'created_at']


class InternalSaleSerializer(serializers.ModelSerializer):
    product_name     = serializers.CharField(source='product.name',     read_only=True)
    product_barcode  = serializers.CharField(source='product.barcode',  read_only=True)
    destination_name = serializers.CharField(source='destination.name', read_only=True)

    class Meta:
        model  = InternalSale
        fields = ['id', 'product', 'product_name', 'product_barcode',
                  'destination', 'destination_name', 'quantity', 'price', 'date']
        read_only_fields = ['id', 'date']

    def create(self, validated_data):
        internal = InternalSale.objects.create(**validated_data)
        product  = internal.product
        qty      = Decimal(str(internal.quantity))
        if Decimal(str(product.stock_quantity)) < qty:
            internal.delete()
            raise serializers.ValidationError(f"Insufficient stock for {product.name}")
        remaining = qty
        for b in StockBatch.objects.filter(product=product, quantity__gt=0).order_by('mrp', 'created_at'):
            if remaining <= 0: break
            deduct = min(Decimal(str(b.quantity)), remaining)
            b.quantity = Decimal(str(b.quantity)) - deduct; b.save(); remaining -= deduct
        product.stock_quantity = Decimal(str(product.stock_quantity)) - qty
        if product.stock_quantity < 0: product.stock_quantity = Decimal('0')
        product.save()
        return internal


class PurchaseReturnSerializer(serializers.ModelSerializer):
    product_name    = serializers.CharField(source='product.name',    read_only=True)
    product_barcode = serializers.CharField(source='product.barcode', read_only=True)
    item_cost       = serializers.FloatField(read_only=True)

    class Meta:
        model  = PurchaseReturn
        fields = ['id', 'product', 'product_name', 'product_barcode',
                  'quantity', 'purchase_price', 'tax', 'item_cost',
                  'reason', 'status', 'date']
        read_only_fields = ['id', 'date', 'purchase_price', 'tax']

    def create(self, validated_data):
        pr      = PurchaseReturn.objects.create(**validated_data)
        product = pr.product
        qty     = Decimal(str(pr.quantity))
        remaining = qty
        for b in StockBatch.objects.filter(product=product, quantity__gt=0).order_by('mrp'):
            if remaining <= 0: break
            deduct = min(Decimal(str(b.quantity)), remaining)
            b.quantity = Decimal(str(b.quantity)) - deduct; b.save(); remaining -= deduct
        product.stock_quantity = Decimal(str(product.stock_quantity)) - qty
        if product.stock_quantity < 0: product.stock_quantity = Decimal('0')
        product.save()
        return pr


class DirectSaleMasterSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model  = DirectSaleMaster
        fields = ['id', 'name', 'is_active', 'created_at', 'created_by_username']
        read_only_fields = ['id', 'created_at']


class DirectSaleSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model  = DirectSale
        fields = ['id', 'item', 'item_name', 'price', 'payment_type',
                  'cash_amount', 'card_amount', 'upi_amount', 'date']
        read_only_fields = ['id', 'date']


class StockAdjustmentRequestSerializer(serializers.ModelSerializer):
    product_name         = serializers.CharField(source='product.name',           read_only=True)
    product_barcode      = serializers.CharField(source='product.barcode',         read_only=True)
    requested_by_name    = serializers.CharField(source='requested_by.username',   read_only=True)
    reviewed_by_name     = serializers.CharField(source='reviewed_by.username',    read_only=True)

    class Meta:
        model  = StockAdjustmentRequest
        fields = ['id', 'product', 'product_name', 'product_barcode',
                  'system_stock', 'physical_stock', 'status', 'reason',
                  'requested_by_name', 'reviewed_by_name',
                  'created_at', 'reviewed_at']
        read_only_fields = ['id', 'status', 'created_at', 'reviewed_at']