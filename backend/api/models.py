from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
import random
import string


class UserManager(BaseUserManager):
    def create_user(self, username, password=None, role='general'):
        if not username:
            raise ValueError('Username is required')
        user = self.model(username=username, role=role)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None):
        user = self.create_user(username, password, role='admin')
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [('admin', 'Admin'), ('general', 'General')]
    username   = models.CharField(max_length=150, unique=True)
    role       = models.CharField(max_length=20, choices=ROLE_CHOICES, default='general')
    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = []
    objects = UserManager()

    def __str__(self):
        return self.username


def generate_barcode():
    while True:
        barcode = ''.join(random.choices(string.digits, k=12))
        if not Product.objects.filter(barcode=barcode).exists():
            return barcode


class Vendor(models.Model):
    name       = models.CharField(max_length=200)
    phone      = models.CharField(max_length=20, blank=True, null=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    UNIT_CHOICES = [
        ('nos',    'Nos'),
        ('kg',     'Kg'),
        ('carton', 'Carton'),
    ]
    barcode          = models.CharField(max_length=50, unique=True, blank=True)
    name             = models.CharField(max_length=200)
    selling_price    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    selling_unit     = models.CharField(max_length=10, choices=UNIT_CHOICES, default='nos')
    # Total stock = sum of all active batch quantities
    # Kept for quick reference / backward compat
    stock_quantity   = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    damaged_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    expired_quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.barcode:
            self.barcode = generate_barcode()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.barcode})"


class StockBatch(models.Model):
    """
    Represents a batch of stock at a specific selling price.
    Every purchase that introduces a new MRP creates a new batch.
    If the MRP matches an existing active batch, quantity is added to that batch.
    """
    product      = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='batches')
    mrp          = models.DecimalField(max_digits=10, decimal_places=2)
    quantity     = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['mrp', 'created_at']

    def __str__(self):
        return f"{self.product.name} @ ₹{self.mrp} — {self.quantity} left"


class PurchaseBill(models.Model):
    vendor     = models.ForeignKey(Vendor, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    date       = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Purchase #{self.id} — {self.vendor}"


class Purchase(models.Model):
    UNIT_CHOICES = [
        ('nos',    'Nos'),
        ('kg',     'Kg'),
        ('carton', 'Carton'),
    ]
    bill           = models.ForeignKey(PurchaseBill, on_delete=models.CASCADE, related_name='items', null=True, blank=True)
    product        = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchases')
    purchase_unit  = models.CharField(max_length=10, choices=UNIT_CHOICES, default='nos')
    quantity       = models.DecimalField(max_digits=12, decimal_places=3)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax            = models.DecimalField(max_digits=5,  decimal_places=2, default=0)
    mrp            = models.DecimalField(max_digits=10, decimal_places=2)
    selling_unit   = models.CharField(max_length=10, choices=UNIT_CHOICES, default='nos')
    selling_qty    = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    date           = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Purchase: {self.product.name} x{self.quantity} @ ₹{self.mrp}"


class SaleBill(models.Model):
    PAYMENT_CHOICES = [
        ('cash',      'Cash'),
        ('card',      'Card'),
        ('upi',       'UPI'),
        ('cash_card', 'Cash & Card'),
        ('cash_upi',  'Cash & UPI'),
    ]
    bill_number  = models.CharField(max_length=20, unique=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_type = models.CharField(max_length=10, choices=PAYMENT_CHOICES)
    cash_amount  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    card_amount  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    upi_amount   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at   = models.DateTimeField(auto_now_add=True)
    created_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Bill #{self.bill_number}"

    @classmethod
    def generate_bill_number(cls):
        last = cls.objects.order_by('-id').first()
        if last:
            try:
                num = int(last.bill_number.replace('BS', '')) + 1
            except ValueError:
                num = 1
        else:
            num = 1
        return f"BS{num:06d}"


class SaleItem(models.Model):
    bill     = models.ForeignKey(SaleBill, on_delete=models.CASCADE, related_name='items')
    product  = models.ForeignKey(Product, on_delete=models.CASCADE)
    batch    = models.ForeignKey(StockBatch, on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    price    = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def subtotal(self):
        return self.quantity * self.price

    def __str__(self):
        return f"{self.product.name} x{self.quantity} @ ₹{self.price}"


class ReturnItem(models.Model):
    RETURN_TYPE_CHOICES = [
        ('customer_return', 'Customer Return'),
        ('damaged',         'Damaged'),
        ('expired',         'Expired'),
    ]
    product      = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='returns')
    return_type  = models.CharField(max_length=20, choices=RETURN_TYPE_CHOICES)
    quantity     = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    date         = models.DateTimeField(auto_now_add=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Return: {self.product.name} - {self.return_type}"


class InternalSaleMaster(models.Model):
    name       = models.CharField(max_length=100, unique=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name


class InternalSale(models.Model):
    product     = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='internal_sales')
    destination = models.ForeignKey(InternalSaleMaster, on_delete=models.CASCADE, related_name='items')
    quantity    = models.DecimalField(max_digits=12, decimal_places=3, default=1)
    price       = models.DecimalField(max_digits=10, decimal_places=2)
    date        = models.DateTimeField(auto_now_add=True)
    created_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.product.name} → {self.destination.name} x{self.quantity}"


class PurchaseReturn(models.Model):
    product        = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_returns')
    quantity       = models.DecimalField(max_digits=12, decimal_places=3)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax            = models.DecimalField(max_digits=5,  decimal_places=2, default=0)
    reason         = models.TextField(blank=True)
    date           = models.DateTimeField(auto_now_add=True)
    created_by     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    @property
    def item_cost(self):
        price_with_tax = float(self.purchase_price) * (1 + float(self.tax) / 100)
        return price_with_tax * float(self.quantity)

    def __str__(self):
        return f"PurchaseReturn: {self.product.name} x{self.quantity}"


class DirectSaleMaster(models.Model):
    name       = models.CharField(max_length=200)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name


class DirectSale(models.Model):
    PAYMENT_CHOICES = [
        ('cash',      'Cash'),
        ('card',      'Card'),
        ('upi',       'UPI'),
        ('cash_card', 'Cash & Card'),
        ('cash_upi',  'Cash & UPI'),
    ]
    item         = models.ForeignKey(DirectSaleMaster, on_delete=models.CASCADE, related_name='sales')
    price        = models.DecimalField(max_digits=10, decimal_places=2)
    payment_type = models.CharField(max_length=10, choices=PAYMENT_CHOICES)
    cash_amount  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    card_amount  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    upi_amount   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    date         = models.DateTimeField(auto_now_add=True)
    created_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"DirectSale: {self.item.name} — ₹{self.price}"