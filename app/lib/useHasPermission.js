"use client";

import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { can as canCheck, Permissions } from './rbac';

// React hook for components to check RBAC permissions easily
export default function useHasPermission() {
  const { user, isInitialized } = useAuth();

  const has = useMemo(() => {
    return (moduleKey, action = 'view') => {
      if (!isInitialized) return false;
      const role = (user?.role || '').toString();
      return canCheck(role, moduleKey, action);
    };
  }, [user, isInitialized]);

  return {
    hasPermission: has,
    Permissions,
  };
}
