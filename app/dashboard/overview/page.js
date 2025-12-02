"use client"

import { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UsersIcon, CalendarIcon, ClipboardDocumentIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import StatCard from '../../components/StatCard';

// Lazy load chart components
const Line = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));
const Pie = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Pie })));
const Bar = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, BarElement, Title, Tooltip, Legend);

import Loading from '../../components/Loading';
import { apiFetch } from '../../lib/apiClient';

export default function Overview({ setActivePage }) {
  const { token, isInitialized } = useAuth();
  // State definitions (unchanged)
  const [staffCount, setStaffCount] = useState(0);
  const [lowInventoryCount, setLowInventoryCount] = useState(0);
  const [roomData, setRoomData] = useState({
    labels: ['Single Room', 'Standard Room', 'Double Standard', 'Triple Room', 'Family Room', 'Barkadahan Room'],
    datasets: [
      {
        label: 'Room Revenue (₱)',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: ['#4B5EAA', '#A3BFFA', '#2F3B6E', '#6B7280', '#FBBF24', '#EF4444'],
        borderColor: ['#FFFFFF'],
        borderWidth: 1,
      },
    ],
  });
  const [eventData, setEventData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Package Revenue (₱)',
        data: [],
        backgroundColor: [
          '#2ECC71', '#A9DFBF', '#27AE60', '#6EE7B7', '#34D399',
          '#10B981', '#059669', '#047857', '#065F46', '#064E3B',
          '#14B8A6', '#22D3EE', '#0EA5E9', '#0284C7', '#1E40AF'
        ],
        borderColor: ['#FFFFFF'],
        borderWidth: 1,
      },
    ],
  });
  const [dishData, setDishData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Dish Revenue (₱)',
        data: [],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FFCD56', '#4BC0C0', '#36A2EB', '#FF6384'],
        borderColor: ['#FFFFFF'],
        borderWidth: 1,
      },
    ],
  });
  const [monthlySales, setMonthlySales] = useState(0);
  const [eventMonthly, setEventMonthly] = useState(0);
  const [roomMonthly, setRoomMonthly] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryRevenueData, setCategoryRevenueData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Events Revenue (₱)',
        data: [],
        borderColor: '#2ECC71',
        backgroundColor: 'rgba(46, 204, 113, 0.3)',
        pointBackgroundColor: '#27AE60',
        pointBorderColor: '#145A32',
        pointRadius: 4,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Rooms Revenue (₱)',
        data: [],
        borderColor: '#4B5EAA',
        backgroundColor: 'rgba(75, 94, 170, 0.3)',
        pointBackgroundColor: '#4B5EAA',
        pointBorderColor: '#2F3B6E',
        pointRadius: 4,
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Cafe Dishes Revenue (₱)',
        data: [],
        borderColor: '#FF6384',
        backgroundColor: 'rgba(255, 99, 132, 0.3)',
        pointBackgroundColor: '#FF6384',
        pointBorderColor: '#C71585',
        pointRadius: 4,
        fill: true,
        tension: 0.3,
      },
    ],
  });
  const [predictiveRevenueData, setPredictiveRevenueData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Predicted Events Revenue (₱)',
        data: [],
        borderColor: '#2ECC71',
        backgroundColor: 'rgba(46, 204, 113, 0.2)',
        pointBackgroundColor: '#27AE60',
        pointBorderColor: '#145A32',
        pointRadius: 4,
        fill: true,
        tension: 0.3,
        borderDash: [5, 5],
      },
      {
        label: 'Predicted Rooms Revenue (₱)',
        data: [],
        borderColor: '#4B5EAA',
        backgroundColor: 'rgba(75, 94, 170, 0.2)',
        pointBackgroundColor: '#4B5EAA',
        pointBorderColor: '#2F3B6E',
        pointRadius: 4,
        fill: true,
        tension: 0.3,
        borderDash: [5, 5],
      },
      {
        label: 'Predicted Cafe Dishes Revenue (₱)',
        data: [],
        borderColor: '#FF6384',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        pointBackgroundColor: '#FF6384',
        pointBorderColor: '#C71585',
        pointRadius: 4,
        fill: true,
        tension: 0.3,
        borderDash: [5, 5],
      },
    ],
  });
  const [dataLoaded, setDataLoaded] = useState({
    staff: false,
    inventory: false,
    notifications: false,
    dishes: false,
    rooms: false,
    events: false,
    packages: false,
    receipts: false,
  });
  const [showRevenueChart, setShowRevenueChart] = useState(true);
  const [showPredictiveChart, setShowPredictiveChart] = useState(true);
  const [showPopularitySection, setShowPopularitySection] = useState(true);

  // Months and years
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i);

  // useEffect for data loading (unchanged)
  useEffect(() => {
    const allDataLoaded = Object.values(dataLoaded).every(status => status);
    if (allDataLoaded) {
      setLoading(false);
    }
  }, [dataLoaded]);

  // Fetch data logic (unchanged)
  useEffect(() => {
    if (!isInitialized) return; // wait for auth state
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setDataLoaded({
        staff: false,
        inventory: false,
        notifications: false,
        dishes: false,
        rooms: false,
        events: false,
        packages: false,
        receipts: false,
      });

      try {
        const usersResponse = await fetchWithTimeout('/api/users', { timeout: 1000000 });
        if (!usersResponse.ok) throw new Error(`Failed to fetch users: ${usersResponse.status}`);
        const usersData = await usersResponse.json();
        setStaffCount(usersData.length);
        setDataLoaded(prev => ({ ...prev, staff: true }));

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const newStaffCount = usersData.filter(u => new Date(u.created_at) > sevenDaysAgo).length;

        const inventoryResponse = await apiFetch('/api/inventory', { timeout: 1000000 }, token);
        if (!inventoryResponse.ok) throw new Error(`Failed to fetch inventory: ${inventoryResponse.status}`);
        const inventoryData = await inventoryResponse.json();
        const lowInventory = inventoryData.filter(item => item.quantity < item.threshold).length;
        setLowInventoryCount(lowInventory);
        setDataLoaded(prev => ({ ...prev, inventory: true }));

        let housekeepingNotificationsCount = 0;
        try {
          const notificationsResponse = await fetch('/api/notifications?role=housekeeping');
          if (notificationsResponse.ok) {
            const notificationsData = await notificationsResponse.json();
            housekeepingNotificationsCount = notificationsData.length;
          }
        } catch (err) {
          console.warn('Failed to fetch housekeeping notifications:', err);
        }
        setDataLoaded(prev => ({ ...prev, notifications: true }));

        let newDishesCount = 0;
        try {
          const dishesResponse = await fetch('/api/dishes');
          if (dishesResponse.ok) {
            const dishesData = await dishesResponse.json();
            newDishesCount = dishesData.filter(d => new Date(d.created_at) > sevenDaysAgo).length;
          }
        } catch (err) {
          console.warn('Failed to fetch dishes:', err);
        }
        setDataLoaded(prev => ({ ...prev, dishes: true }));

        let roomReservations = [];
        try {
          const roomResponse = await fetch('/api/reservation-history', { signal: AbortSignal.timeout(1000000) });
          if (!roomResponse.ok) throw new Error(`Failed to fetch room reservations: ${roomResponse.status}`);
          const data = await roomResponse.json();
          // reservation-history API now returns structured response: { roomReservations: [...], eventReservations: [...] }
          roomReservations = Array.isArray(data?.roomReservations) ? data.roomReservations : (Array.isArray(data) ? data : []);
        } catch (err) {
          console.warn('Failed to fetch room reservations:', err);
          throw err;
        }
        setDataLoaded(prev => ({ ...prev, rooms: true }));

        let eventReservations = [];
        try {
          // Fetch a window of months (last 6 months ending with the current month).
          // The aggregation below builds the monthly series based on the current date,
          // so align the fetch window to ensure we have matching data for the chart.
          const monthsWindow = 6;
          const now = new Date();
          const windowStartDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - monthsWindow + 1, 1, 0, 0, 0));
          const windowEndDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
          const windowStart = windowStartDate.toISOString();
          const endOfMonth = windowEndDate.toISOString();
          const eventResponse = await fetch(`/api/event_reservation_history?start_date=${windowStart}&end_date=${endOfMonth}`, {
            signal: AbortSignal.timeout(1000000),
          });
          if (!eventResponse.ok) throw new Error(`Failed to fetch event reservations: ${eventResponse.status}`);
          eventReservations = await eventResponse.json();
        } catch (err) {
          console.warn('Failed to fetch event reservations:', err);
          throw err;
        }
        setDataLoaded(prev => ({ ...prev, events: true }));

        let packageMap = {};
        try {
          const packagesResponse = await fetch('/api/event_packages', { signal: AbortSignal.timeout(1000000) });
          if (!packagesResponse.ok) throw new Error(`Failed to fetch event packages: ${packagesResponse.status}`);
          const packagesData = await packagesResponse.json();
          packagesData.forEach(p => {
            packageMap[p.id] = p.name;
          });
        } catch (err) {
          console.warn('Failed to fetch event packages:', err);
        }
        setDataLoaded(prev => ({ ...prev, packages: true }));

        let receiptsData = [];
        try {
          const receiptsResponse = await fetch('/api/receipts', {
            signal: AbortSignal.timeout(1000000),
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (receiptsResponse.ok) {
            receiptsData = await receiptsResponse.json();
          } else {
            console.warn(`Failed to fetch receipts: ${receiptsResponse.status} ${receiptsResponse.statusText}`);
          }
        } catch (err) {
          console.warn('Failed to fetch receipts:', err);
        }
        setDataLoaded(prev => ({ ...prev, receipts: true }));

        const filteredReceipts = receiptsData.filter(r => {
          const date = new Date(r.created_at);
          return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear;
        });

        let roomRevenues = {
          'Single Room': 0,
          'Standard Room': 0,
          'Double Standard': 0,
          'Triple Room': 0,
          'Family Room': 0,
          'Barkadahan Room': 0
        };
        const filteredRoomReservations = roomReservations.filter(r => {
          const date = new Date(r.checkout_date);
          return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear;
        });

        // Helper: compute revenue for a reservation
        function computeReservationRevenue(r) {
          // 1) prefer explicit total_price
          if (r.total_price) return Number(r.total_price) || 0;

          // 2) try parsing payment_details for a total or per-day price
          let pd = null;
          if (r.payment_details) {
            try {
              pd = typeof r.payment_details === 'string' ? JSON.parse(r.payment_details) : r.payment_details;
            } catch (err) {
              pd = null;
            }
          }

          if (pd && (pd.total || (pd.payment_details && pd.payment_details.total))) {
            return Number(pd.total || pd.payment_details.total) || 0;
          }

          // 3) compute using per-day price * reservedDays formula (Price x reserved days - 1 day)
          // Determine per-day price from pd.price or package_price or a 'price' field
          const perDay = Number((pd && (pd.price || pd.rate)) || r.package_price || r.price || 0) || 0;
          const checkIn = r.check_in_date ? new Date(r.check_in_date) : null;
          const checkOut = r.check_out_date ? new Date(r.check_out_date) : null;
          let days = 1;
          if (checkIn && checkOut && !isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
            const diff = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            days = Math.max(0, diff);
          }
          // Apply formula: Price x (reservedDays - 1)
          const chargedDays = Math.max(0, days - 1);
          if (perDay && chargedDays > 0) return perDay * chargedDays;

          // Fallback to package_price if nothing else
          return Number(r.package_price) || 0;
        }

        filteredRoomReservations.forEach(r => {
          const revenue = computeReservationRevenue(r);
          const packageName = r.package_name || 'Single Room';
          if (packageName.toLowerCase().includes('single room')) {
            roomRevenues['Single Room'] += revenue;
          } else if (packageName.toLowerCase().includes('standard room')) {
            roomRevenues['Standard Room'] += revenue;
          } else if (packageName.toLowerCase().includes('double standard')) {
            roomRevenues['Double Standard'] += revenue;
          } else if (packageName.toLowerCase().includes('triple room')) {
            roomRevenues['Triple Room'] += revenue;
          } else if (packageName.toLowerCase().includes('family room')) {
            roomRevenues['Family Room'] += revenue;
          } else if (packageName.toLowerCase().includes('barkadahan room')) {
            roomRevenues['Barkadahan Room'] += revenue;
          }
        });

        const roomRevenueDataArr = [
          roomRevenues['Single Room'],
          roomRevenues['Standard Room'],
          roomRevenues['Double Standard'],
          roomRevenues['Triple Room'],
          roomRevenues['Family Room'],
          roomRevenues['Barkadahan Room']
        ];
        setRoomData({
          labels: ['Single Room', 'Standard Room', 'Double Standard', 'Triple Room', 'Family Room', 'Barkadahan Room'],
          datasets: [
            {
              label: 'Room Revenue (₱)',
              data: roomRevenueDataArr.some(val => val > 0) ? roomRevenueDataArr : [30, 20, 10, 15, 25, 35],
              backgroundColor: ['#4B5EAA', '#A3BFFA', '#2F3B6E', '#6B7280', '#FBBF24', '#EF4444'],
              borderColor: ['#FFFFFF'],
              borderWidth: 1,
            },
          ],
        });

        const packageRevenues = {};
        // Compute package revenues for the selected month only (filter by event_date)
        const filteredEventReservationsForMonth = eventReservations.filter(r => {
          const date = new Date(r.event_date);
          return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear;
        });
        // Prefer the joined receipt total (when a POS receipt exists) otherwise fall back to the
        // event reservation's stored `total`.
        filteredEventReservationsForMonth.forEach(r => {
          const revenue = Number(r.receipt_total) || Number(r.total) || 0;
          const packageName = packageMap[r.event_package_id] || 'Unknown Package';
          packageRevenues[packageName] = (packageRevenues[packageName] || 0) + revenue;
        });

        const packageLabels = Object.keys(packageRevenues);
        const packageRevenueDataArr = Object.values(packageRevenues);
        setEventData({
          labels: packageLabels.length > 0 ? packageLabels : ['No Packages'],
          datasets: [
            {
              label: 'Package Revenue (₱)',
              data: packageRevenueDataArr.length > 0 ? packageRevenueDataArr : [1],
              backgroundColor: [
                '#2ECC71', '#A9DFBF', '#27AE60', '#6EE7B7', '#34D399',
                '#10B981', '#059669', '#047857', '#065F46', '#064E3B',
                '#14B8A6', '#22D3EE', '#0EA5E9', '#0284C7', '#1E40AF'
              ].slice(0, packageLabels.length || 1),
              borderColor: ['#FFFFFF'],
              borderWidth: 1,
            },
          ],
        });

        let dishRevenuesObj = {};
        filteredReceipts.forEach(r => {
          let items = r.items || [];
          if (typeof items === 'string') {
            try {
              items = JSON.parse(items);
            } catch (err) {
              console.warn(`Failed to parse items for receipt ${r.id}:`, err);
              return;
            }
          }
          items.forEach(i => {
            if (i.type !== 'room' && i.type !== 'event') {
              const name = i.name;
              const rev = (Number(i.quantity) || 1) * (Number(i.price) || 0);
              dishRevenuesObj[name] = (dishRevenuesObj[name] || 0) + rev;
            }
          });
        });

        const sortedDishes = Object.entries(dishRevenuesObj)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);
        const dishLabels = sortedDishes.map(([name]) => name);
        const dishValues = sortedDishes.map(([, rev]) => rev);
        setDishData({
          labels: dishLabels.length > 0 ? dishLabels : ['No Data'],
          datasets: [
            {
              label: 'Dish Revenue (₱)',
              data: dishValues.length > 0 ? dishValues : [1],
              backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FFCD56', '#4BC0C0', '#36A2EB', '#FF6384'],
              borderColor: ['#FFFFFF'],
              borderWidth: 1,
            },
          ],
        });

        let totalMonthlySales = 0;
        const currentDate = new Date();
        const monthsBack = 6;
        const categoryLabels = [];
        const eventRevenuesMonthly = [];
        const roomRevenuesMonthly = [];
        const dishRevenuesMonthly = [];
  let eventForSelectedMonth = 0;
  let roomForSelectedMonth = 0;

        for (let i = monthsBack - 1; i >= 0; i--) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const monthName = date.toLocaleString('default', { month: 'short' });
          const year = date.getFullYear();
          categoryLabels.push(`${monthName} ${year}`);

          const month = date.getMonth() + 1;
          const yearFilter = date.getFullYear();

          const monthlyRoomReservations = roomReservations.filter(r => {
            const resDate = new Date(r.checkout_date);
            return resDate.getMonth() + 1 === month && resDate.getFullYear() === yearFilter;
          });
          // Use explicit total when present, otherwise compute via computeReservationRevenue (per-day formula fallback)
          const monthlyRoomRevenue = monthlyRoomReservations.reduce((sum, r) => sum + (typeof computeReservationRevenue === 'function' ? computeReservationRevenue(r) : (Number(r.total_price) || Number(r.package_price) || 0)), 0);
          roomRevenuesMonthly.push(monthlyRoomRevenue);

          const monthlyEventReservations = eventReservations.filter(r => {
  const resDate = new Date(r.event_date);
  return resDate.getMonth() + 1 === month && resDate.getFullYear() === yearFilter;
});

          // Prefer POS receipt_total when available, otherwise use stored total
          const monthlyEventRevenue = monthlyEventReservations.reduce((sum, r) => sum + (Number(r.receipt_total) || Number(r.total) || 0), 0);
          eventRevenuesMonthly.push(monthlyEventRevenue);

          const monthlyReceipts = receiptsData.filter(r => {
            const recDate = new Date(r.created_at);
            return recDate.getMonth() + 1 === month && recDate.getFullYear() === yearFilter;
          });
          const monthlyDishRevenue = monthlyReceipts.reduce((sum, r) => {
            let items = r.items || [];
            if (typeof items === 'string') {
              try {
                items = JSON.parse(items);
              } catch (err) {
                return sum;
              }
            }
            return sum + items.reduce((dishSum, i) => {
              if (i.type !== 'room' && i.type !== 'event') {
                return dishSum + (Number(i.quantity) || 1) * (Number(i.price) || 0);
              }
              return dishSum;
            }, 0);
          }, 0);
          dishRevenuesMonthly.push(monthlyDishRevenue);

          if (month === selectedMonth && yearFilter === selectedYear) {
            totalMonthlySales = monthlyEventRevenue + monthlyRoomRevenue + monthlyDishRevenue;
            eventForSelectedMonth = monthlyEventRevenue;
            roomForSelectedMonth = monthlyRoomRevenue;
          }
        }

        setMonthlySales(totalMonthlySales);
        setEventMonthly(eventForSelectedMonth);
        setRoomMonthly(roomForSelectedMonth);

        setCategoryRevenueData({
          labels: categoryLabels,
          datasets: [
            {
              label: 'Events Revenue (₱)',
              data: eventRevenuesMonthly,
              borderColor: '#2ECC71',
              backgroundColor: 'rgba(46, 204, 113, 0.3)',
              pointBackgroundColor: '#27AE60',
              pointBorderColor: '#145A32',
              pointRadius: 4,
              fill: true,
              tension: 0.3,
            },
            {
              label: 'Rooms Revenue (₱)',
              data: roomRevenuesMonthly,
              borderColor: '#4B5EAA',
              backgroundColor: 'rgba(75, 94, 170, 0.3)',
              pointBackgroundColor: '#4B5EAA',
              pointBorderColor: '#2F3B6E',
              pointRadius: 4,
              fill: true,
              tension: 0.3,
            },
            {
              label: 'Cafe Dishes Revenue (₱)',
              data: dishRevenuesMonthly,
              borderColor: '#FF6384',
              backgroundColor: 'rgba(255, 99, 132, 0.3)',
              pointBackgroundColor: '#FF6384',
              pointBorderColor: '#C71585',
              pointRadius: 4,
              fill: true,
              tension: 0.3,
            },
          ],
        });

        // Deterministic linear regression forecast using explicit least-squares formula
        // Fits y = intercept + slope * x where x = 1..n (time index) and predicts for x = n+1..n+monthsOut
        // Uses the standard formula:
        // slope = (n*sum(x*y) - sum(x)*sum(y)) / (n*sum(x^2) - (sum(x))^2)
        // intercept = (sum(y) - slope*sum(x)) / n
        function linearForecast(series, monthsOut = 3) {
          const n = series.length;
          if (n === 0) return Array(monthsOut).fill(0);

          // Use 1-indexed time to avoid zero-centered edge cases (x = 1..n)
          const xs = Array.from({ length: n }, (_, i) => i + 1);
          const ys = series.map(v => Number(v) || 0);

          const sumX = xs.reduce((s, x) => s + x, 0);
          const sumY = ys.reduce((s, y) => s + y, 0);
          const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
          const sumX2 = xs.reduce((s, x) => s + x * x, 0);

          const denom = n * sumX2 - sumX * sumX;
          // If denom is zero (shouldn't happen for n>1) fallback to flat prediction
          if (!denom || Math.abs(denom) < 1e-12) {
            const avg = sumY / n;
            return Array(monthsOut).fill(Math.max(0, avg));
          }

          const slope = (n * sumXY - sumX * sumY) / denom;
          const intercept = (sumY - slope * sumX) / n;

          const results = [];
          for (let k = 1; k <= monthsOut; k++) {
            const t = n + k; // next time index (1-indexed)
            const pred = intercept + slope * t;
            // Clamp to zero to avoid negative revenue predictions
            results.push(Math.max(0, pred));
          }
          return results;
        }

        const predictiveEventRevenues = linearForecast(eventRevenuesMonthly, 3);
        const predictiveRoomRevenues = linearForecast(roomRevenuesMonthly, 3);
        const predictiveDishRevenues = linearForecast(dishRevenuesMonthly, 3);

        const predictiveLabels = [];
        for (let i = 1; i <= 3; i++) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
          const monthName = date.toLocaleString('default', { month: 'long' });
          const year = date.getFullYear();
          predictiveLabels.push(`${monthName} ${year}`);
        }

        setPredictiveRevenueData({
          labels: predictiveLabels,
          datasets: [
            {
              label: 'Predicted Events Revenue (₱)',
              data: predictiveEventRevenues,
              borderColor: '#2ECC71',
              backgroundColor: 'rgba(46, 204, 113, 0.2)',
              pointBackgroundColor: '#27AE60',
              pointBorderColor: '#145A32',
              pointRadius: 4,
              fill: true,
              tension: 0.3,
              borderDash: [5, 5],
            },
            {
              label: 'Predicted Rooms Revenue (₱)',
              data: predictiveRoomRevenues,
              borderColor: '#4B5EAA',
              backgroundColor: 'rgba(75, 94, 170, 0.2)',
              pointBackgroundColor: '#4B5EAA',
              pointBorderColor: '#2F3B6E',
              pointRadius: 4,
              fill: true,
              tension: 0.3,
              borderDash: [5, 5],
            },
            {
              label: 'Predicted Cafe Dishes Revenue (₱)',
              data: predictiveDishRevenues,
              borderColor: '#FF6384',
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              pointBackgroundColor: '#FF6384',
              pointBorderColor: '#C71585',
              pointRadius: 4,
              fill: true,
              tension: 0.3,
              borderDash: [5, 5],
            },
          ],
        });
      } catch (err) {
        console.error('Fetch error details:', err, err.stack);
        setError(`Failed to load data: ${err.message}`);
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, selectedYear, isInitialized, token]);

  async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 1000000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(id);
    }
  }

  const revenueOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { font: { size: 10, family: 'Arial' } } },
      tooltip: { enabled: true, bodyFont: { size: 10 } },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Revenue (₱)', font: { size: 10 } }, ticks: { font: { size: 10 } } },
      x: { title: { display: true, text: 'Month', font: { size: 10 } }, ticks: { font: { size: 10 } } },
    },
  };

  const predictiveOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { font: { size: 10, family: 'Arial' } } },
      tooltip: { enabled: true, bodyFont: { size: 10 } },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Predicted Revenue (₱)', font: { size: 10 } }, ticks: { font: { size: 10 } } },
      x: { title: { display: true, text: 'Month', font: { size: 10 } }, ticks: { font: { size: 10 } } },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 10, family: 'Arial' } } },
      tooltip: { enabled: true, bodyFont: { size: 10 } },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 10, family: 'Arial' } } },
      tooltip: { enabled: true, bodyFont: { size: 10 } },
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Revenue (₱)', font: { size: 10 } }, ticks: { font: { size: 10 } } },
      x: { title: { display: true, text: 'Dish', font: { size: 10 } }, ticks: { autoSkip: true, maxRotation: 45, minRotation: 45, font: { size: 10 } } },
    },
  };

  if (loading) {
    return <Loading message="Loading Dashboard..." fullScreen />;
  }

  return (
  <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header + Month/Year Filter (aligned right) */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Hotel Dashboard</h1>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600">Overview of key metrics and performance indicators</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative w-full sm:w-48">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm md:text-base text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="h-3 sm:h-4 w-3 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="relative w-full sm:w-32">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm md:text-base text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="h-3 sm:h-4 w-3 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-6 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <StatCard
            title="Total Staff"
            value={error ? 'Error' : staffCount}
            change="+2"
            icon={<UsersIcon className="h-4 sm:h-5 w-4 sm:w-5 text-indigo-600" />}
            iconBgClass="bg-indigo-50"
            onClick={() => setActivePage('staff-management')}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-2 sm:p-4 hover:bg-indigo-50 text-xs sm:text-sm"
          />
          <StatCard
            title="Upcoming Events"
            value="5"
            change="+1"
            icon={<CalendarIcon className="h-4 sm:h-5 w-4 sm:w-5 text-green-600" />}
            iconBgClass="bg-green-50"
            onClick={() => setActivePage('event-management')}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-2 sm:p-4 hover:bg-green-50 text-xs sm:text-sm"
          />
          <StatCard
            title="Low Inventory"
            value={error ? 'Error' : lowInventoryCount}
            change="-3"
            icon={<ClipboardDocumentIcon className="h-4 sm:h-5 w-4 sm:w-5 text-yellow-600" />}
            iconBgClass="bg-yellow-50"
            onClick={() => setActivePage('inventory-management')}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-2 sm:p-4 hover:bg-yellow-50 text-xs sm:text-sm"
          />
          <StatCard
            title="Event Revenue"
            value={error ? 'Error' : `₱${Number(eventMonthly).toFixed(2)}`}
            change=""
            icon={<CalendarIcon className="h-4 sm:h-5 w-4 sm:w-5 text-green-600" />}
            iconBgClass="bg-green-50"
            onClick={() => {
              try { localStorage.setItem('reservationHistoryActiveTab', 'event'); } catch (e) {}
              setActivePage('reservation-history');
            }}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-2 sm:p-4 hover:bg-green-50 text-xs sm:text-sm"
          />
          <StatCard
            title="Room Revenue"
            value={error ? 'Error' : `₱${Number(roomMonthly).toFixed(2)}`}
            change=""
            icon={<CurrencyDollarIcon className="h-4 sm:h-5 w-4 sm:w-5 text-indigo-600" />}
            iconBgClass="bg-indigo-50"
            onClick={() => setActivePage('reservation-history')}
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-2 sm:p-4 hover:bg-indigo-50 text-xs sm:text-sm"
          />
          <StatCard
            title="Overall Sales"
            value={error ? 'Error' : `₱${Number(monthlySales).toFixed(2)}`}
            change=""
            icon={<CurrencyDollarIcon className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />}
            iconBgClass="bg-purple-50"
            className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-2 sm:p-4 hover:bg-purple-50 text-xs sm:text-sm"
          />
        </div>

        {/* Revenue Trends and Predictive Analysis Side by Side */}
        <div className="mb-6 sm:mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800">Revenue Trends by Category</h3>
              <button
                onClick={() => setShowRevenueChart(!showRevenueChart)}
                className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
              >
                {showRevenueChart ? 'Hide' : 'Show'}
                <svg className={`ml-1 sm:ml-2 h-3 sm:h-4 w-3 sm:w-4 transform ${showRevenueChart ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {showRevenueChart && (
              <div className="h-40 sm:h-48 md:h-64">
                <h4 className="text-xs sm:text-sm md:text-base font-medium text-gray-600 mb-3 sm:mb-4">Monthly Revenue by Events, Rooms, and Cafe Dishes</h4>
                <Suspense fallback={<Loading message="Loading chart..." overlay /> }>
                  {error ? (
                    <p className="text-red-500 text-xs sm:text-sm">Error: {error}</p>
                  ) : categoryRevenueData.labels.length === 0 ? (
                    <p className="text-gray-500 text-xs sm:text-sm">No revenue data available</p>
                  ) : (
                    <Line data={categoryRevenueData} options={revenueOptions} />
                  )}
                </Suspense>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800">Predictive Analysis</h3>
              <button
                onClick={() => setShowPredictiveChart(!showPredictiveChart)}
                className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
              >
                {showPredictiveChart ? 'Hide' : 'Show'}
                <svg className={`ml-1 sm:ml-2 h-3 sm:h-4 w-3 sm:w-4 transform ${showPredictiveChart ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {showPredictiveChart && (
              <div className="h-40 sm:h-48 md:h-64">
                <h4 className="text-xs sm:text-sm md:text-base font-medium text-gray-600 mb-3 sm:mb-4">Forecasted Revenue (Next 3 Months)</h4>
                <Suspense fallback={<Loading message="Loading chart..." overlay /> }>
                  {error ? (
                    <p className="text-red-500 text-xs sm:text-sm">Error: {error}</p>
                  ) : predictiveRevenueData.labels.length === 0 ? (
                    <p className="text-gray-500 text-xs sm:text-sm">No predictive data available</p>
                  ) : (
                    <Line data={predictiveRevenueData} options={predictiveOptions} />
                  )}
                </Suspense>
              </div>
            )}
          </div>
        </div>

        {/* Popularity Analysis */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800">Popularity Analysis</h3>
            <button
              onClick={() => setShowPopularitySection(!showPopularitySection)}
              className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              {showPopularitySection ? 'Hide' : 'Show'}
              <svg className={`ml-1 sm:ml-2 h-3 sm:h-4 w-3 sm:w-4 transform ${showPopularitySection ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          {showPopularitySection && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <h4 className="text-xs sm:text-sm md:text-base font-medium text-gray-600 mb-2 sm:mb-3">Room Distribution</h4>
                <div className="h-40 sm:h-48 md:h-64">
                  <Suspense fallback={<Loading message="Loading chart..." overlay /> }>
                    {error ? (
                      <p className="text-red-500 text-xs sm:text-sm">Error: {error}</p>
                    ) : roomData.datasets[0].data.every(val => val === 0) ? (
                      <p className="text-gray-500 text-xs sm:text-sm">No room revenue data available</p>
                    ) : (
                      <Pie data={roomData} options={pieOptions} />
                    )}
                  </Suspense>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <h4 className="text-xs sm:text-sm md:text-base font-medium text-gray-600 mb-2 sm:mb-3">Package Distribution</h4>
                <div className="h-40 sm:h-48 md:h-64">
                  <Suspense fallback={<Loading message="Loading chart..." overlay /> }>
                    {error ? (
                      <p className="text-red-500 text-xs sm:text-sm">Error: {error}</p>
                    ) : eventData.labels.length === 0 || eventData.datasets[0].data.every(val => val === 0) ? (
                      <p className="text-gray-500 text-xs sm:text-sm">No package revenue data available</p>
                    ) : (
                      <Pie data={eventData} options={pieOptions} />
                    )}
                  </Suspense>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                <h4 className="text-xs sm:text-sm md:text-base font-medium text-gray-600 mb-2 sm:mb-3">Top Cafe Dishes</h4>
                <div className="h-40 sm:h-48 md:h-64">
                  <Suspense fallback={<Loading message="Loading chart..." overlay /> }>
                    {error ? (
                      <p className="text-red-500 text-xs sm:text-sm">Error: {error}</p>
                    ) : dishData.labels.length === 0 ? (
                      <p className="text-gray-500 text-xs sm:text-sm">No cafe dish data available</p>
                    ) : (
                      <Bar data={dishData} options={barOptions} />
                    )}
                  </Suspense>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}