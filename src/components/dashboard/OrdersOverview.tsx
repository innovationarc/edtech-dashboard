// src/components/dashboard/OrdersOverview.tsx
import { CreditCard, ShoppingCart, Package, BellRing } from 'lucide-react';

interface OrdersOverviewProps {
  recentOrders: any[]; // Assuming Transaction[] from paymentService
}

const OrdersOverview = ({ recentOrders }: OrdersOverviewProps) => {
  const getTransactionIcon = (productName: string) => {
    if (productName.toLowerCase().includes('course')) return <ShoppingCart size={16} className="text-white" />;
    if (productName.toLowerCase().includes('design')) return <BellRing size={16} className="text-white" />;
    if (productName.toLowerCase().includes('payment')) return <CreditCard size={16} className="text-white" />;
    return <Package size={16} className="text-white" />;
  };

  const getTransactionColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-success-DEFAULT';
      case 'pending': return 'bg-warning-DEFAULT';
      case 'failed': return 'bg-error-DEFAULT';
      default: return 'bg-primary-500';
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800">
        <h3 className="text-white font-medium">Orders overview</h3>
        <p className="text-sm text-success-DEFAULT">(+30%) this month</p>
      </div>
      
      <div className="p-5">
        <ul className="space-y-6">
          {recentOrders.map((order, index) => (
            <li key={order.id} className="relative pl-6">
              <div className="flex items-center mb-1">
                <div className={`absolute left-0 top-0 h-6 w-6 rounded-full ${getTransactionColor(order.status)} flex items-center justify-center`}>
                  {getTransactionIcon(order.productName)}
                </div>
                <span className="text-white font-medium">${order.amount} {order.currency}, {order.productName}</span>
              </div>
              <p className="text-xs text-gray-400">{order.createdAt.toLocaleDateString()} {order.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              
              {index !== recentOrders.length - 1 && (
                <div className="absolute left-3 top-6 bottom-0 w-px bg-background-700"></div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default OrdersOverview;
