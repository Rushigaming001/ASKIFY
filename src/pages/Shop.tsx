import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Search, ShoppingCart, Star, Plus, Minus, Trash2, Loader2,
  Package, CheckCircle, MapPin, X, Filter
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  rating: number;
  rating_count: number;
  stock: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Order {
  id: string;
  items: any[];
  total: number;
  address: string | null;
  status: string;
  created_at: string;
}

const categories = ['All', 'Electronics', 'Clothes', 'Shoes', 'Accessories', 'Other'];

const Shop = () => {
  useRequireAuth();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('shop_cart') || '[]'); } catch { return []; }
  });

  // Dialogs
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [address, setAddress] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Add product form
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', image_url: '', category: 'other' });
  const [addingProduct, setAddingProduct] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      setProducts((data as Product[]) || []);
      setLoading(false);

      if (user) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
        setIsAdmin(roles?.some(r => ['owner', 'admin'].includes(r.role)) || false);
      }
    };
    load();
  }, [user]);

  // Persist cart
  useEffect(() => {
    localStorage.setItem('shop_cart', JSON.stringify(cart));
  }, [cart]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchCategory = category === 'All' || p.category.toLowerCase() === category.toLowerCase();
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [products, category, search]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.product.price * i.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: `${product.name} added to cart 🛒` });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const placeOrder = async () => {
    if (!user || !address.trim()) {
      toast({ title: 'Please enter delivery address', variant: 'destructive' });
      return;
    }
    try {
      const orderItems = cart.map(i => ({ name: i.product.name, price: i.product.price, quantity: i.quantity, image_url: i.product.image_url }));
      await supabase.from('orders').insert({
        user_id: user.id,
        items: orderItems,
        total: cartTotal,
        address: address.trim(),
        status: 'pending',
      });
      setCart([]);
      setShowCheckout(false);
      setOrderPlaced(true);
      setAddress('');
    } catch (err: any) {
      toast({ title: 'Error placing order', description: err.message, variant: 'destructive' });
    }
  };

  const loadOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    const { data } = await supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setOrdersLoading(false);
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      toast({ title: 'Name and price required', variant: 'destructive' });
      return;
    }
    setAddingProduct(true);
    try {
      const { data, error } = await supabase.from('products').insert({
        name: newProduct.name.trim(),
        description: newProduct.description.trim() || null,
        price: parseFloat(newProduct.price),
        image_url: newProduct.image_url.trim() || null,
        category: newProduct.category,
        created_by: user?.id,
      }).select().single();
      if (error) throw error;
      setProducts(prev => [data as Product, ...prev]);
      setNewProduct({ name: '', description: '', price: '', image_url: '', category: 'other' });
      setShowAddProduct(false);
      toast({ title: 'Product added! ✅' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAddingProduct(false);
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`h-3 w-3 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">Shop</h1>
          <Button variant="ghost" size="icon" className="relative" onClick={() => { setShowOrders(true); loadOrders(); }}>
            <Package className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="relative" onClick={() => setShowCart(true)}>
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
        {/* Search + Filters */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map(c => (
            <Button key={c} variant={category === c ? 'default' : 'outline'} size="sm" className="rounded-full text-xs whitespace-nowrap" onClick={() => setCategory(c)}>
              {c}
            </Button>
          ))}
          {isAdmin && (
            <Button size="sm" variant="secondary" className="rounded-full text-xs whitespace-nowrap" onClick={() => setShowAddProduct(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Product
            </Button>
          )}
        </div>
      </header>

      {/* Product Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">No products found</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(product => (
                <Card key={product.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedProduct(product)}>
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Package className="h-10 w-10" />
                      </div>
                    )}
                    <Badge className="absolute top-2 left-2 text-[10px] capitalize">{product.category}</Badge>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      {renderStars(product.rating)}
                      <span className="text-[10px] text-muted-foreground">({product.rating_count})</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-base">₹{product.price}</span>
                      <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={e => { e.stopPropagation(); addToCart(product); }}>
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <div className="aspect-square bg-muted rounded-lg overflow-hidden mb-4">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Package className="h-16 w-16 text-muted-foreground" /></div>
                )}
              </div>
              <Badge className="capitalize mb-2">{selectedProduct.category}</Badge>
              <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {renderStars(selectedProduct.rating)}
                <span className="text-sm text-muted-foreground">({selectedProduct.rating_count} ratings)</span>
              </div>
              <p className="text-2xl font-black mt-3">₹{selectedProduct.price}</p>
              {selectedProduct.description && (
                <p className="text-sm text-muted-foreground mt-3">{selectedProduct.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {selectedProduct.stock > 0 ? `${selectedProduct.stock} in stock` : 'Out of stock'}
              </p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>
                  Add to Cart
                </Button>
                <Button className="flex-1" onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); setShowCart(true); }}>
                  Buy Now
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Dialog */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Cart ({cartCount})</DialogTitle>
          </DialogHeader>
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Cart is empty</p>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="h-14 w-14 rounded-md bg-muted overflow-hidden flex-shrink-0">
                      {item.product.image_url ? (
                        <img src={item.product.image_url} className="w-full h-full object-cover" />
                      ) : <Package className="w-full h-full p-3 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      <p className="font-bold text-sm">₹{(item.product.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(item.product.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQty(item.product.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>
              <Button className="w-full mt-3" onClick={() => { setShowCart(false); setShowCheckout(true); }}>
                Proceed to Checkout
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">Items: {cartCount}</p>
              <p className="text-xl font-black">Total: ₹{cartTotal.toFixed(2)}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Delivery Address</label>
              <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter your full delivery address..." rows={3} maxLength={500} />
            </div>
            <Button className="w-full" onClick={placeOrder} disabled={!address.trim()}>
              Confirm Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Placed Dialog */}
      <Dialog open={orderPlaced} onOpenChange={setOrderPlaced}>
        <DialogContent className="max-w-sm text-center">
          <div className="py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Order Placed! 🎉</h2>
            <p className="text-muted-foreground">Your order has been placed successfully. You can track it in your orders.</p>
            <Button className="mt-6" onClick={() => { setOrderPlaced(false); setShowOrders(true); loadOrders(); }}>
              View Orders
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Orders Dialog */}
      <Dialog open={showOrders} onOpenChange={setShowOrders}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> My Orders</DialogTitle>
          </DialogHeader>
          {ordersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders yet</p>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <Card key={order.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                        <p className="font-bold">₹{order.total}</p>
                      </div>
                      <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="capitalize">
                        {order.status}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {(order.items as any[]).map((item: any, idx: number) => (
                        <p key={idx} className="text-sm text-muted-foreground">{item.name} × {item.quantity}</p>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog (Admin) */}
      <Dialog open={showAddProduct} onOpenChange={setShowAddProduct}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} />
            <Textarea placeholder="Description" value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} rows={2} />
            <Input type="number" placeholder="Price (₹)" value={newProduct.price} onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))} />
            <Input placeholder="Image URL" value={newProduct.image_url} onChange={e => setNewProduct(p => ({ ...p, image_url: e.target.value }))} />
            <Select value={newProduct.category} onValueChange={v => setNewProduct(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.filter(c => c !== 'All').map(c => (
                  <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleAddProduct} disabled={addingProduct} className="w-full">
              {addingProduct ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shop;
