"use client";

import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import {
  PrinterIcon,
  PlusCircleIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import useIsNarrow from '../../lib/useIsNarrow';

  // ultra-narrow detection (very small phones)
  function useIsUltraNarrow() {
    const [isUltra, setIsUltra] = useState(false);
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const mq = window.matchMedia('(max-width: 360px)');
      const onChange = () => setIsUltra(mq.matches);
      onChange();
      mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
      return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange); };
    }, []);
    return isUltra;
  }
import { notifySuccess, modalAlert, modalConfirm } from '../../../lib/swal';

const initialDish = {
  name: '',
  description: '',
  price: 0,
  category: '',
  photo_url: '',
  isAvailable: true,
};

const dishCategories = [
  "All",
  "Main Course",
  "Appetizer",
  "Dessert",
  "Beverage",
  "Pasta",
  "Salad",
  "Snacks",
  "Rice Meal",
  "Soup",
  "Side Dish"
];

export default function Home() {
  const [dishes, setDishes] = useState([]);
  const [newDish, setNewDish] = useState(initialDish);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const isNarrow = useIsNarrow();
  const isUltraNarrow = useIsUltraNarrow();

  // Validate dish data
  const validateDish = useCallback((dish) => {
    if (!dish.name.trim()) return 'Dish name is required';
    if (dish.name.length > 100) return 'Dish name is too long';
    if (!dish.description.trim()) return 'Description is required';
    if (dish.description.length > 500) return 'Description is too long';
    if (isNaN(dish.price) || dish.price < 0) return 'Price must be a valid positive number';
    if (!dish.category) return 'Category is required';
    if (dish.photo_url && !/^data:image\/(png|jpeg);base64,.+/i.test(dish.photo_url)) return 'Invalid image format';
    return null;
  }, []);

  // Handle file upload for dish image (with basic size/type guard)
  const handleImageUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
        modalAlert('Invalid image', 'Only PNG/JPEG images are allowed', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        // simple client-side size guard (~500KB)
        if (typeof dataUrl === 'string' && dataUrl.length > 1024 * 500) {
          modalAlert('Image too large', 'Please use an image smaller than ~500KB', 'error');
          return;
        }
        setNewDish({ ...newDish, photo_url: reader.result });
      };
      reader.readAsDataURL(file);
    }
  }, [newDish]);

  // Fetch dishes
  const fetchDishes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cafe_dishes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dishes');
      }

      const data = await response.json();
      const formattedData = Array.isArray(data) ? data.map(dish => ({
        ...dish,
        isAvailable: dish.is_available === true || dish.is_available === 'true',
        price: parseFloat(dish.price) || 0,
      })) : [];

      setDishes(formattedData);
    } catch (error) {
      console.error('Error fetching dishes:', error);
      setDishes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDishes();
  }, [fetchDishes]);

  // Handle add dish
  const handleAddDish = useCallback(async (e) => {
    e.preventDefault();
    const validationError = validateDish(newDish);
    if (validationError) {
      return;
    }

    setLoading(true);
    try {
      const apiData = {
        name: newDish.name.trim(),
        description: newDish.description.trim(),
        price: parseFloat(newDish.price),
        category: newDish.category,
        photo_url: newDish.photo_url,
        is_available: newDish.isAvailable,
      };

      const response = await fetch('/api/cafe_dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        throw new Error('Failed to add dish');
      }

  await fetchDishes();
  notifySuccess('added', 'Dish added', 'The dish was added successfully');
      setNewDish(initialDish);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error adding dish:', error);
    } finally {
      setLoading(false);
    }
  }, [newDish, fetchDishes]);

  // Handle edit dish
  const handleEditDish = useCallback(async (e) => {
    e.preventDefault();
    const validationError = validateDish(newDish);
    if (validationError) {
      return;
    }

    setLoading(true);
    try {
      const apiData = {
        name: newDish.name.trim(),
        description: newDish.description.trim(),
        price: parseFloat(newDish.price),
        category: newDish.category,
        photo_url: newDish.photo_url,
        is_available: newDish.isAvailable,
      };

      const response = await fetch(`/api/cafe_dishes/${editingDish.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        throw new Error('Failed to update dish');
      }

    await fetchDishes();
    setNewDish(initialDish);
    setEditingDish(null);
    setIsModalOpen(false);
  // show a modal popup confirming the update
  modalAlert('Updated successfully', '', 'success');
    } catch (error) {
      console.error('Error updating dish:', error);
    } finally {
      setLoading(false);
    }
  }, [newDish, editingDish, fetchDishes]);

  // Handle delete dish
  const handleDeleteDish = useCallback(async (id, dishName) => {
    const conf = await modalConfirm({
      title: 'Remove dish?',
      text: `Are you sure you want to remove "${dishName || 'this dish'}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
    });
    if (!conf.isConfirmed) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/cafe_dishes/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete dish');
      }

  await fetchDishes();
  notifySuccess('deleted', `Dish deleted`, `"${dishName || 'Dish'}" was deleted`);
    } catch (error) {
      console.error('Error deleting dish:', error);
      modalAlert('Delete failed', error.message || 'Failed to delete dish', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchDishes]);

  // Print dishes
  const printDishes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cafe_dishes', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dishes for printing');
      }

      const data = await response.json();
      const availableDishes = Array.isArray(data) ? data.filter(dish => 
        dish.is_available === true || dish.is_available === 'true'
      ) : [];

      if (availableDishes.length === 0) {
        setLoading(false);
        return;
      }

      const groupedDishes = availableDishes.reduce((acc, dish) => {
        const category = dish.category || 'Uncategorized';
        if (!acc[category]) acc[category] = [];
        acc[category].push(dish);
        return acc;
      }, {});

      const sortedCategories = Object.keys(groupedDishes).sort();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Failed to open print window');
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Menu - Available Dishes</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
                line-height: 1.6;
              }
              h1 {
                color: #04820aff;
                text-align: center;
                margin-bottom: 30px;
                font-size: 2em;
              }
              h2 {
                color: #04820aff;
                font-size: 1.5em;
                margin-top: 20px;
                margin-bottom: 10px;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 5px;
              }
              .category-section {
                margin-bottom: 20px;
              }
              .dishes-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 15px;
              }
              .dish {
                padding: 10px;
                border-bottom: 1px solid #e5e7eb;
              }
              .dish-content {
                flex: 1;
              }
              .dish-content h3 {
                color: #04820aff;
                margin: 0 0 5px 0;
                font-size: 1.1em;
              }
              .category {
                background: #dbeafe;
                color: #04820aff;
                padding: 2px 8px;
                border-radius: 12px;
                display: inline-block;
                font-size: 0.8em;
                margin-bottom: 5px;
              }
              .description {
                color: #4b5563;
                font-size: 0.85em;
                margin-bottom: 5px;
              }
              .price {
                color: #1f2937;
                font-weight: bold;
                font-size: 0.9em;
              }
              @page { size: A4; margin: 15mm; }
              @media print {
                body {
                  padding: 10px;
                  width: 210mm;
                  min-height: 297mm;
                }
                .no-print {
                  display: none;
                }
                .dishes-grid {
                  grid-template-columns: repeat(2, 1fr);
                  gap: 10px;
                }
              }
            </style>
          </head>
          <body>
            <h1>Menu - Available Dishes</h1>
            ${sortedCategories.map(category => `
              <div class="category-section">
                <h2>${category}</h2>
                <div class="dishes-grid">
                  ${groupedDishes[category].map(dish => `
                    <div class="dish">
                      <div class="dish-content">
                        <h3>${dish.name}</h3>
                        <span class="category">${dish.category}</span>
                        <p class="description">${dish.description || 'No description available'}</p>
                        <p class="price">₱${Number(dish.price).toFixed(2)}</p>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (error) {
      console.error('Error printing dishes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Open edit modal
  const openEditModal = useCallback((dish) => {
    setEditingDish(dish);
    setNewDish({
      name: dish.name || '',
      description: dish.description || '',
      price: dish.price || 0,
      category: dish.category || '',
      photo_url: dish.photo_url || '',
      isAvailable: dish.isAvailable || false,
    });
    setIsModalOpen(true);
  }, []);

  // Filter and paginate dishes
  const filteredDishes = dishes.filter(dish => {
    const matchesCategory = selectedCategory === 'All' || dish.category === selectedCategory;
    const matchesSearch = dish.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dish.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalPages = Math.ceil(filteredDishes.length / itemsPerPage);
  const paginatedDishes = filteredDishes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
  <div className="min-h-full bg-white">
      <Head>
        <title>Restaurant Management</title>
        <meta name="description" content="Restaurant dish management system" />
      </Head>

  <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Search and Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search dishes..."
              className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            {!isNarrow && (
              <button
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-all duration-200"
                onClick={printDishes}
                disabled={loading}
              >
                <PrinterIcon className="h-5 w-5" />
                <span className="hidden sm:inline">Print Menu</span>
              </button>
            )}
            <button
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 transition-all duration-200"
              onClick={() => {
                setEditingDish(null);
                setNewDish(initialDish);
                setIsModalOpen(true);
              }}
              disabled={loading}
            >
              <PlusCircleIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Add Dish</span>
            </button>
          </div>
        </div>

        {/* Category selector: dropdown on narrow screens, horizontal buttons on larger */}
        {isNarrow ? (
          <div className="mb-6">
            <label htmlFor="category-select" className="sr-only">Select category</label>
            {isUltraNarrow ? (
              /* ultra-compact select */
              <select
                id="category-select"
                className="compact-select p-2 border border-gray-300 rounded-md text-sm bg-white text-black"
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                disabled={loading}
                aria-label="Select category"
              >
                {dishCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            ) : (
              <select
                id="category-select"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                disabled={loading}
              >
                {dishCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex gap-2 mb-6 overflow-x-auto sm:overflow-visible px-2 -mx-2 snap-x snap-mandatory">
            {dishCategories.map(category => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 snap-center ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={loading}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {/* Dishes Grid */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg">Loading dishes...</p>
          </div>
        ) : paginatedDishes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {paginatedDishes.map((dish) => (
              <div
                key={dish.id}
                className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex flex-col"
              >
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-xl font-semibold text-blue-700">{dish.name}</h2>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {dish.category}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-3">{dish.description}</p>
                  <p className="text-gray-800 font-bold mt-2">
                    ₱{Number(dish.price).toFixed(2)}
                  </p>
                  <p className="text-sm mt-2">
                    <span className="font-medium text-black">Availability: </span>
                    <span className={dish.isAvailable ? 'text-blue-600' : 'text-red-600'}>
                      {dish.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </p>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button
                    className="flex-1 px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-all duration-200 touch-manipulation"
                    onClick={() => openEditModal(dish)}
                    disabled={loading}
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    className="flex-1 px-4 py-3 sm:py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-all duration-200 touch-manipulation"
                    onClick={() => handleDeleteDish(dish.id, dish.name)}
                    disabled={loading}
                  >
                    <TrashIcon className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg">
              No dishes found{searchTerm ? ` matching "${searchTerm}"` : ''}
            </p>
            {selectedCategory !== 'All' && (
              <p className="text-gray-400">in {selectedCategory} category</p>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center space-x-2">
            <button
              onClick={handlePreviousPage}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentPage === 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={currentPage === 1 || loading}
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={loading}
              >
                {page}
              </button>
            ))}
            <button
              onClick={handleNextPage}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                currentPage === totalPages
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={currentPage === totalPages || loading}
            >
              Next
            </button>
          </div>
        )}

        {/* Add/Edit Dish Modal */}
        {isModalOpen && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white p-4 sm:p-6 rounded-lg w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6 text-blue-700">
                {editingDish ? 'Edit Dish' : 'Add New Dish'}
              </h2>
              <form onSubmit={editingDish ? handleEditDish : handleAddDish}>
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">Name</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    value={newDish.name}
                    onChange={(e) => setNewDish({ ...newDish, name: e.target.value })}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">Description</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    value={newDish.description}
                    onChange={(e) => setNewDish({ ...newDish, description: e.target.value })}
                    required
                    rows={4}
                    disabled={loading}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      value={newDish.price}
                      onChange={(e) => setNewDish({ ...newDish, price: e.target.value })}
                      required
                      min="0"
                      disabled={loading}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Category</label>
                    <select
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                      value={newDish.category}
                      onChange={(e) => setNewDish({ ...newDish, category: e.target.value })}
                      required
                      disabled={loading}
                    >
                      <option value="">Select category</option>
                      {dishCategories.filter(c => c !== 'All').map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 font-medium mb-2">Availability</label>
                  <select
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    value={newDish.isAvailable ? 'true' : 'false'}
                    onChange={(e) => setNewDish({ ...newDish, isAvailable: e.target.value === 'true' })}
                    disabled={loading}
                  >
                    <option value="true">Available</option>
                    <option value="false">Unavailable</option>
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                  <button
                    type="button"
                    className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-all duration-200"
                    onClick={() => {
                      setIsModalOpen(false);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all duration-200"
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : editingDish ? 'Update Dish' : 'Add Dish'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
