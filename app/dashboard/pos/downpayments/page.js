"use client";

import { useEffect, useState } from 'react';
import { useAuth } from "../../../context/AuthContext";

export default function DownpaymentsPage() {
  const { user, token } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [eventsMap, setEventsMap] = useState({});

  useEffect(() => {
    if (!user || !token) return;
    const load = async () => {
      setLoading(true);
      try {
        // fetch downpayments created by this user
        const res = await fetch(`/api/payments?type=downpayment&created_by=${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const paymentsData = data.payments || [];
          setPayments(paymentsData);

          // extract event ids from payments (use event_id if present or parse note for event:<id>)
          const eventIds = Array.from(new Set(paymentsData.map(p => p.event_id || (p.note && (p.note.match(/event:(\d+)/) || [])[1]) ).filter(Boolean)));
          if (eventIds.length > 0) {
            // fetch all events and map by id (we could fetch specific ids but /api/event returns full list)
            const evRes = await fetch('/api/event', { headers: { Authorization: `Bearer ${token}` } });
            if (evRes.ok) {
              const allEvents = await evRes.json();
              const map = {};
              for (const ev of allEvents) {
                if (eventIds.includes(String(ev.id)) || eventIds.includes(ev.id)) {
                  map[ev.id] = ev;
                }
              }
              setEventsMap(map);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, token]);

  return (
    <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">DP only</h1>
      {loading ? (
        <p  className='text=black' >Loading...</p>
      ) : payments.length === 0 ? (
      <p className='text=black'>No DP only records found.</p>
      ) : (
        <div className="space-y-3">
          {payments.map(p => {
            // determine event id
            const eventId = p.event_id || (p.note && (p.note.match(/event:(\d+)/) || [])[1]);
            const event = eventId ? eventsMap[Number(eventId)] : null;
            const eventUser = event ? (event.booked_by || event.booked_by_name || null) : null;
            return (
              <div key={p.id} className="p-3 bg-white rounded shadow-sm flex justify-between text-black">
                <div>
                  <div className="text-sm text-gray-600">Reservation: {p.reservation_id || 'N/A'}</div>
                  <div className="font-medium">₱{Number(p.amount).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{p.note}</div>
                  {event && (
                    <div className="text-sm text-gray-700 mt-1">Event: {event.name} {eventUser ? `- Booked by: ${eventUser}` : ''}</div>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500">
                  <div>{new Date(p.created_at).toLocaleString()}</div>
                  <div>Method: {p.method}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
