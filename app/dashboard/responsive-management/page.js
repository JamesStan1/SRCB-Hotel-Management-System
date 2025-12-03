"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { MagnifyingGlassIcon, HomeIcon, ChartBarIcon, ShoppingCartIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import Loading from '@/app/components/Loading';

function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="flex bg-gray-100 rounded-full p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 text-sm py-2 rounded-full font-medium transition ${
            value === opt.value
              ? "bg-blue-600 text-white"
              : "text-gray-700 bg-transparent"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function ResponsiveManagement() {
  const { token } = useAuth();
  const [tab, setTab] = useState("inventory");
  const [query, setQuery] = useState("");

  const [inventory, setInventory] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [invRes, dishesRes, roomsRes] = await Promise.all([
          fetch('/api/inventory', { headers }),
          fetch('/api/dishes', { headers }),
          fetch('/api/room', { headers }),
        ]);

        if (invRes.ok) setInventory(await invRes.json());
        if (dishesRes.ok) setDishes(await dishesRes.json());
        if (roomsRes.ok) setRooms(await roomsRes.json());
      } catch (err) {
        console.error('Fetch error:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [token]);

  const filterList = (items, keys = []) => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((it) => keys.some((k) => String(it[k] ?? "").toLowerCase().includes(q)));
  };

  const InventoryView = () => {
    const list = filterList(inventory, ['name', 'sku', 'category']);
    return (
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No inventory items</div>
        ) : (
          list.map((item) => (
            <div key={item.id} className="bg-white rounded-lg p-4 shadow flex items-start gap-3">
              <div className="flex-1">
                <div className="font-semibold text-sm truncate">{item.name || 'Unnamed'}</div>
                <div className="text-xs text-gray-500">SKU: {item.sku || '—'}</div>
                <div className="text-xs text-gray-500">Category: {item.category || '—'}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${item.quantity > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {item.quantity ?? 0}
                </div>
                <div className="text-xs text-gray-500">qty</div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const CafeView = () => {
    const list = filterList(dishes, ['name', 'category']);
    return (
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No dishes available</div>
        ) : (
          list.map((dish) => (
            <div key={dish.id} className="bg-white rounded-lg p-4 shadow flex items-center gap-3">
              <div className="flex-1">
                <div className="font-semibold text-sm">{dish.name}</div>
                <div className="text-xs text-gray-500">{dish.category || 'Menu'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">₱{Number(dish.price || 0).toFixed(2)}</div>
                <div className="text-xs text-gray-500">price</div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const RoomView = () => {
    const list = filterList(rooms, ['room_number', 'type']);
    return (
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No room data</div>
        ) : (
          list.map((r) => (
            <div key={r.id} className="bg-white rounded-lg p-4 shadow flex items-start gap-3">
              <div className="flex-1">
                <div className="font-semibold text-sm">Room {r.room_number || '—'}</div>
                <div className="text-xs text-gray-500">{r.type || '—'}</div>
                <div className="text-xs text-gray-500">Status: {r.status || '—'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{r.price ? `₱${r.price}` : '—'}</div>
                <div className="text-xs text-gray-500">price</div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  return (
  <div className="min-h-full bg-gray-50 text-gray-800 pb-20">
      <div className="max-w-lg mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-xs text-gray-500">Overview</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center text-white font-semibold text-sm">J</div>
        </div>

        {/* Tabbed content area */}
        {tab === 'inventory' && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Total Products</div>
                <div className="text-xl font-bold text-black">{inventory?.length ?? 0}</div>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 bg-blue-600" style={{ width: `${Math.min(100, (inventory?.length ?? 0) * 2)}%` }} />
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Low Stock</div>
                <div className="text-xl font-bold text-black">{(inventory || []).filter(i => (i.quantity ?? 0) <= (i.reorder_level ?? 5)).length}</div>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 bg-red-400" style={{ width: `40%` }} />
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Categories</div>
                <div className="text-xl font-bold text-black">{[...new Set((inventory||[]).map(i=>i.category).filter(Boolean))].length}</div>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 bg-pink-400" style={{ width: `30%` }} />
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Value</div>
                <div className="text-xl font-bold text-black">₱{(inventory || []).slice(0,10).reduce((s,i)=>s + ((Number(i.unit_cost)||0)*(i.quantity||0)),0).toFixed(2)}</div>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 bg-rose-400" style={{ width: `40%` }} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow mb-4">
              <div className="text-sm font-semibold mb-2">Inventory List</div>
              <InventoryView />
            </div>
          </>
        )}

        {tab === 'cafe' && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Total Dishes</div>
                <div className="text-xl font-bold text-black">{dishes?.length ?? 0}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Top Seller</div>
                <div className="text-xl font-bold text-black">{(dishes[0]?.name) ?? '—'}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Avg Price</div>
                <div className="text-xl font-bold text-black">₱{((dishes||[]).reduce((s,d)=>s + (Number(d.price)||0),0)/Math.max(1,(dishes||[]).length)).toFixed(2)}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Weekly Sales</div>
                <div className="text-xl font-bold text-black">{(dishes||[]).slice(0,5).reduce((s,d)=>s + (Number(d.sales)||0),0)}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow mb-4">
              <div className="text-sm font-semibold mb-2">Menu</div>
              <CafeView />
            </div>
          </>
        )}

        {tab === 'rooms' && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Total Rooms</div>
                <div className="text-xl font-bold text-black">{rooms?.length ?? 0}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Occupied</div>
                <div className="text-xl font-bold text-black">{(rooms||[]).filter(r=>r.status==='Occupied').length}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Available</div>
                <div className="text-xl font-bold text-black">{(rooms||[]).filter(r=>r.status==='Available').length}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="text-sm text-gray-500">Revenue</div>
                <div className="text-xl font-bold text-black">₱{(rooms||[]).slice(0,5).reduce((s,r)=>s + (Number(r.price)||0),0).toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 shadow mb-4">
              <div className="text-sm font-semibold mb-2">Rooms</div>
              <RoomView />
            </div>
          </>
        )}
      </div>

        {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-lg mx-auto flex justify-between px-2 py-2">
          <button onClick={() => setTab('inventory')} className={`flex-1 flex flex-col items-center text-xs ${tab === 'inventory' ? 'text-blue-600' : 'text-gray-600'}`}>
            <HomeIcon className="h-6 w-6 mb-1" />
            Inventory
          </button>
          <button onClick={() => setTab('cafe')} className={`flex-1 flex flex-col items-center text-xs ${tab === 'cafe' ? 'text-blue-600' : 'text-gray-600'}`}>
            <ChartBarIcon className="h-6 w-6 mb-1" />
            Cafe
          </button>
          <button onClick={() => setTab('rooms')} className={`flex-1 flex flex-col items-center text-xs ${tab === 'rooms' ? 'text-blue-600' : 'text-gray-600'}`}>
            <ShoppingCartIcon className="h-6 w-6 mb-1" />
            Rooms
          </button>
          <button onClick={() => setTab('settings')} className={`flex-1 flex flex-col items-center text-xs ${tab === 'settings' ? 'text-blue-600' : 'text-gray-600'}`}>
            <Cog6ToothIcon className="h-6 w-6 mb-1" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}
