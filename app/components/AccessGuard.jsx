"use client";

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { can } from '../lib/rbac';

export default function AccessGuard({ role, moduleKey, action = 'view', fallback = null, children }) {
  const { user, isInitialized } = useAuth();

  if (!isInitialized) return null;

  const userRole = (user?.role || '').toLowerCase();
  const allowed = can(userRole, moduleKey, action);
  if (!allowed) return fallback;
  return children;
}


