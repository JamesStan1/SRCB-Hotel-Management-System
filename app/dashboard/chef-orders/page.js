"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  BellAlertIcon,
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

export default function ChefOrdersPage() {
  const { user, isInitialized, token, logoutCurrent } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, preparing, ready, all
  const [refreshing, setRefreshing] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  // Redirect if not chef
  useEffect(() => {
    if (isInitialized && (!user || user.role !== 'Chef')) {
      router.push('/dashboard');
    }
  }, [user, isInitialized, router]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    
    try {
      const url = filter === 'all' 
        ? '/api/chef-orders'
        : `/api/chef-orders?status=${filter}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching chef orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isUserDropdownOpen && !event.target.closest('.user-dropdown')) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserDropdownOpen]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // Handle logout
  const handleLogout = () => {
    logoutCurrent();
    router.push('/components/sign-in');
  };

  // Update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch('/api/chef-orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: orderId, status: newStatus })
      });
      
      if (response.ok) {
        fetchOrders();
        
        // Play notification sound when marking as ready
        if (newStatus === 'ready') {
          try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {});
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-blue-100 text-blue-800';
      case 'served': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <ClockIcon className="h-5 w-5" />;
      case 'preparing': return <ArrowPathIcon className="h-5 w-5 animate-spin" />;
      case 'ready': return <CheckCircleIcon className="h-5 w-5" />;
      case 'served': return <CheckCircleIcon className="h-5 w-5" />;
      default: return null;
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeElapsed = (orderTime) => {
    const now = new Date();
    const order = new Date(orderTime);
    const diffMinutes = Math.floor((now - order) / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m ago`;
  };

  if (!isInitialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'Chef') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Chef Orders</h1>
              <p className="text-gray-600 mt-1">Manage incoming food orders from the café</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 transition-colors ${
                  refreshing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              
              {/* User Dropdown */}
              <div className="relative user-dropdown">
                <button
                  onClick={() => setIsUserDropdownOpen((prev) => !prev)}
                  className="flex items-center text-gray-600 hover:text-gray-800 focus:outline-none p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="User menu"
                >
                  <UserCircleIcon className="h-7 w-7" />
                  <ChevronDownIcon className="h-4 w-4 ml-1" />
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
                    <div className="py-2 px-3 border-b">
                      <div className="text-sm font-semibold text-gray-800">{user?.name || 'User'}</div>
                      <div className="text-xs text-gray-500 capitalize">{user?.role || 'Chef'}</div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                      >
                        <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
              { value: 'preparing', label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
              { value: 'ready', label: 'Ready', count: orders.filter(o => o.status === 'ready').length },
              { value: 'all', label: 'All', count: orders.length }
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    filter === tab.value ? 'bg-blue-700' : 'bg-gray-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Grid */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <BellAlertIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? "No orders yet. They'll appear here when customers place food orders."
                : `No ${filter} orders at the moment.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => {
              const items = typeof order.items === 'string' 
                ? JSON.parse(order.items) 
                : order.items;
              
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
                >
                  {/* Order Header */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">
                        Invoice: {order.invoice_id}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {order.customer_name || 'Guest'}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Ordered: {formatTime(order.order_time)} ({getTimeElapsed(order.order_time)})
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Items:</h4>
                    <ul className="space-y-2">
                      {items.map((item, index) => (
                        <li key={index} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{item.name}</div>
                            {item.notes && (
                              <div className="text-xs text-gray-500 mt-1">Note: {item.notes}</div>
                            )}
                          </div>
                          <div className="ml-3 text-right">
                            <div className="font-semibold text-gray-900">x{item.quantity}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-gray-50 border-t border-gray-200">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                      >
                        Start Preparing
                      </button>
                    )}
                    
                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                        Mark as Ready
                      </button>
                    )}
                    
                    {order.status === 'ready' && (
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 text-blue-600 font-medium mb-2">
                          <CheckCircleIcon className="h-5 w-5" />
                          Ready for Serving
                        </div>
                        <p className="text-xs text-gray-600">
                          Completed: {formatTime(order.completed_time)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats Footer */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {orders.filter(o => o.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {orders.filter(o => o.status === 'preparing').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Preparing</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {orders.filter(o => o.status === 'ready').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Ready</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">
                {orders.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Orders</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
