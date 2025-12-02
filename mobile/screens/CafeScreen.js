import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, TextInput, Modal } from 'react-native';
import { API_BASE_URL } from '../lib/config'; // Assuming you have a config file

const CafeScreen = () => {
  const [dishes, setDishes] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [showBillModal, setShowBillModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDishes();
  }, []);

  const fetchDishes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dishes`);
      const data = await response.json();
      setDishes(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load menu');
    }
  };

  const addToCart = (dish) => {
    const existing = cart.find(item => item.id === dish.id);
    if (existing) {
      setCart(cart.map(item =>
        item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...dish, quantity: 1 }]);
    }
  };

  const removeFromCart = (dishId) => {
    setCart(cart.filter(item => item.id !== dishId));
  };

  const updateQuantity = (dishId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(dishId);
    } else {
      setCart(cart.map(item =>
        item.id === dishId ? { ...item, quantity } : item
      ));
    }
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const checkActiveReservation = async (name) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/room?scope=billing`);
      const data = await response.json();
      const activeReservations = data.roomReservations.filter(res =>
        res.customer_name.toLowerCase() === name.toLowerCase() &&
        res.status === 'confirmed' &&
        new Date(res.check_out_date) > new Date()
      );
      return activeReservations.length > 0 ? activeReservations[0] : null;
    } catch (error) {
      console.error('Error checking reservation:', error);
      return null;
    }
  };

  const generateBill = async (addToRoomBill = false) => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    setLoading(true);
    try {
      const total = getTotal();
      let reservation = null;

      if (addToRoomBill && customerName.trim()) {
        reservation = await checkActiveReservation(customerName.trim());
        if (!reservation) {
          Alert.alert('No Active Reservation', 'No active room reservation found for this customer. Bill will be generated without room charge.');
          addToRoomBill = false;
        }
      }

      // Create receipt/payment record
      const receiptData = {
        customer: customerName || 'Walk-in',
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity
        })),
        total: total,
        cashier: 'POS Staff', // You might want to get from auth
        created_at: new Date().toISOString()
      };

      // Post to receipts API (assuming it exists)
      const receiptResponse = await fetch(`${API_BASE_URL}/api/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receiptData)
      });

      if (!receiptResponse.ok) {
        throw new Error('Failed to create receipt');
      }

      // If adding to room bill, create payment record
      if (addToRoomBill && reservation) {
        const paymentData = {
          reservationId: reservation.id,
          amount: total,
          type: 'cafe',
          method: 'cash', // or whatever method
          note: `Cafe order for ${customerName}`
        };

        const paymentResponse = await fetch(`${API_BASE_URL}/api/payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData)
        });

        if (!paymentResponse.ok) {
          Alert.alert('Warning', 'Receipt created but failed to add to room bill. Please inform management.');
        } else {
          Alert.alert('Success', `Bill generated and added to ${customerName}'s room bill.`);
        }
      } else {
        Alert.alert('Success', 'Bill generated successfully.');
      }

      // Clear cart and customer name
      setCart([]);
      setCustomerName('');
      setShowBillModal(false);

    } catch (error) {
      Alert.alert('Error', 'Failed to generate bill: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderDish = ({ item }) => (
    <View style={{ padding: 10, borderBottomWidth: 1, borderColor: '#ccc' }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{item.name}</Text>
      <Text style={{ color: '#666' }}>{item.description}</Text>
      <Text style={{ fontSize: 16, color: 'green' }}>₱{item.price}</Text>
      <TouchableOpacity
        style={{ backgroundColor: 'blue', padding: 10, marginTop: 5 }}
        onPress={() => addToCart(item)}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>Add to Cart</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCartItem = ({ item }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderColor: '#ccc' }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16 }}>{item.name}</Text>
        <Text>₱{item.price} x {item.quantity}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          style={{ backgroundColor: 'red', padding: 5, marginRight: 10 }}
          onPress={() => updateQuantity(item.id, item.quantity - 1)}
        >
          <Text style={{ color: 'white' }}>-</Text>
        </TouchableOpacity>
        <Text>{item.quantity}</Text>
        <TouchableOpacity
          style={{ backgroundColor: 'green', padding: 5, marginLeft: 10 }}
          onPress={() => updateQuantity(item.id, item.quantity + 1)}
        >
          <Text style={{ color: 'white' }}>+</Text>
        </TouchableOpacity>
      </View>
      <Text>₱{item.price * item.quantity}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Cafe POS</Text>

      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>Menu</Text>
          <FlatList
            data={dishes}
            renderItem={renderDish}
            keyExtractor={(item) => item.id.toString()}
            style={{ height: 300 }}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, marginBottom: 10 }}>Cart</Text>
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id.toString()}
            style={{ height: 200 }}
          />
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>Total: ₱{getTotal()}</Text>

          <TextInput
            placeholder="Customer Name (for room bill)"
            value={customerName}
            onChangeText={setCustomerName}
            style={{ borderWidth: 1, padding: 10, marginTop: 10 }}
          />

          <TouchableOpacity
            style={{ backgroundColor: 'orange', padding: 15, marginTop: 10 }}
            onPress={() => setShowBillModal(true)}
            disabled={cart.length === 0}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontSize: 18 }}>Generate Bill</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showBillModal} animationType="slide">
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>Generate Bill</Text>
          <Text>Total: ₱{getTotal()}</Text>
          <Text>Customer: {customerName || 'Walk-in'}</Text>

          <TouchableOpacity
            style={{ backgroundColor: 'green', padding: 15, marginTop: 20 }}
            onPress={() => generateBill(true)}
            disabled={loading}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>
              {loading ? 'Processing...' : 'Add to Room Bill & Generate'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: 'blue', padding: 15, marginTop: 10 }}
            onPress={() => generateBill(false)}
            disabled={loading}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>
              {loading ? 'Processing...' : 'Generate Bill Only'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: 'red', padding: 15, marginTop: 10 }}
            onPress={() => setShowBillModal(false)}
          >
            <Text style={{ color: 'white', textAlign: 'center' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

export default CafeScreen;