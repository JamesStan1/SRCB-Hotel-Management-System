"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Loading from '../components/Loading';
import Image from 'next/image';
import { defaultPageForRole } from '../lib/rbac';

export const LoadingComponent = () => (
  <div className="flex justify-center items-center h-screen bg-white">
      <div className="animate-pulse p-8 bg-white">
        <Image
          src="/SRCB.png"
          alt="Hotel Logo"
          width={350}
          height={350}
          className="object-contain"
          loading="lazy"
        />
      </div>
    </div>
);

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [sessions, setSessions] = useState([]); // [{ id, user, token, remember, createdAt }]
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Support new multi-session storage: 'sessions' (JSON) and 'activeSessionId'
        // Fallback/migration from old single 'user'/'token' keys if present.
        const rawSessions = localStorage.getItem('sessions');
        const rawActive = localStorage.getItem('activeSessionId');

        let loadedSessions = [];
        let loadedActive = rawActive || null;

        if (rawSessions) {
          try {
            loadedSessions = JSON.parse(rawSessions) || [];
          } catch (err) {
            console.error('Invalid sessions JSON, clearing:', err);
            localStorage.removeItem('sessions');
            localStorage.removeItem('activeSessionId');
            loadedSessions = [];
            loadedActive = null;
          }
        } else {
          // Migration: check old single-session keys
          const legacyToken = localStorage.getItem('token') || sessionStorage.getItem('token');
          const legacyUserRaw = localStorage.getItem('user') || sessionStorage.getItem('user');
          if (legacyToken && legacyUserRaw) {
            try {
              const parsedUser = JSON.parse(legacyUserRaw);
              const id = `s_${Date.now()}`;
              loadedSessions = [{ id, user: parsedUser, token: legacyToken, remember: true, createdAt: new Date().toISOString() }];
              loadedActive = id;
              // persist to new shape
              localStorage.setItem('sessions', JSON.stringify(loadedSessions));
              localStorage.setItem('activeSessionId', id);
              // remove legacy
              localStorage.removeItem('user');
              localStorage.removeItem('token');
              sessionStorage.removeItem('user');
              sessionStorage.removeItem('token');
            } catch (err) {
              console.error('Failed to parse legacy user, clearing legacy storage', err);
              localStorage.removeItem('user');
              localStorage.removeItem('token');
              sessionStorage.removeItem('user');
              sessionStorage.removeItem('token');
            }
          }
        }

        setSessions(loadedSessions);
        setActiveSessionId(loadedActive);

        // If there's no active session, don't force a redirect from public pages.
        // Only redirect automatically when on a protected route (dashboard).
        const isProtectedPath = pathname && pathname.startsWith('/dashboard');
        if (!loadedActive || !loadedSessions.length) {
          setIsInitialized(true);
          if (isProtectedPath) router.push('/components/sign-in');
          return;
        }

        // Verify the active session token
        const active = loadedSessions.find(s => s.id === loadedActive);
        if (!active) {
          setIsInitialized(true);
          if (isProtectedPath) router.push('/components/sign-in');
          return;
        }

        try {
          const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${active.token}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            // update stored user info from server in sessions
            const updated = loadedSessions.map(s => s.id === active.id ? { ...s, user: data.user } : s);
            setSessions(updated);
            localStorage.setItem('sessions', JSON.stringify(updated));
          } else {
            console.error('Token verification failed for active session, removing it');
            // remove the invalid session
            const remaining = loadedSessions.filter(s => s.id !== active.id);
            setSessions(remaining);
            localStorage.setItem('sessions', JSON.stringify(remaining));
            if (remaining.length) {
              const next = remaining[0];
              setActiveSessionId(next.id);
              localStorage.setItem('activeSessionId', next.id);
            } else {
              localStorage.removeItem('activeSessionId');
              if (isProtectedPath) router.push('/components/sign-in');
            }
          }
        } catch (err) {
          console.error('Error verifying token:', err);
          if (isProtectedPath) router.push('/components/sign-in');
        }
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeAuth();
  }, [router]);

  // Track page views: whenever active session or pathname changes, emit a page_view
  useEffect(() => {
    if (!activeSessionId) return;
    try {
      const active = sessions.find(s => s.id === activeSessionId);
      if (!active || !active.token) return;
      // Best-effort POST to system-logs
      (async () => {
        try {
          await fetch('/api/system-logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${active.token}`,
            },
            body: JSON.stringify({
              action: 'page_view',
              entity: 'page',
              entity_id: pathname || null,
              details: { path: pathname },
            }),
          });
        } catch (e) {
          // ignore
        }
      })();
    } catch (e) {
      // ignore
    }
  }, [activeSessionId, pathname, sessions]);

  const login = async (userData, authToken, rememberMe = false, redirectTo = null) => {
    try {
      const { password, ...safeUserData } = userData;
      const id = `s_${Date.now()}`;
      const newSession = { id, user: safeUserData, token: authToken, remember: !!rememberMe, createdAt: new Date().toISOString() };
      const updated = [newSession, ...sessions];
      setSessions(updated);
      setActiveSessionId(id);
      try { localStorage.setItem('sessions', JSON.stringify(updated)); localStorage.setItem('activeSessionId', id); } catch (_) {}

      // Log login action (best-effort)
      try {
        await fetch('/api/auth/log-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ userId: userData.id }),
        });
      } catch (e) { console.warn('Failed to log login action', e); }

      setError(null);
      let targetPage = redirectTo;
      if (!targetPage) {
        try { targetPage = defaultPageForRole(userData.role); } catch (_) { targetPage = 'overview'; }
      }
      try { localStorage.setItem('activePage', targetPage); } catch (_) {}
      router.push('/dashboard');
      return id;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
      throw err;
    }
  };

  const logoutCurrent = () => {
    if (!activeSessionId) return;
    // Remove the current session from the stored sessions
    const remaining = sessions.filter(s => s.id !== activeSessionId);
    setSessions(remaining);
    try { localStorage.setItem('sessions', JSON.stringify(remaining)); } catch (_) {}

    // Do NOT auto-switch to another account. Signing out should go to the sign-in page.
    setActiveSessionId(null);
    try { localStorage.removeItem('activeSessionId'); } catch (_) {}

    // Keep remaining sessions in localStorage for possible reuse, but redirect to the public homepage
    router.push('/');
  };

  const logoutAll = () => {
    setSessions([]);
    setActiveSessionId(null);
    setError(null);
    try { localStorage.removeItem('sessions'); localStorage.removeItem('activeSessionId'); } catch (_) {}
    router.push('/');
  };

  const switchSession = (id) => {
    const found = sessions.find(s => s.id === id);
    if (!found) return false;
    setActiveSessionId(id);
    try { localStorage.setItem('activeSessionId', id); } catch (_) {}
    return true;
  };

  const removeSession = (id) => {
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    try { localStorage.setItem('sessions', JSON.stringify(remaining)); } catch (_) {}
    if (activeSessionId === id) {
      if (remaining.length) {
        setActiveSessionId(remaining[0].id);
        try { localStorage.setItem('activeSessionId', remaining[0].id); } catch (_) {}
      } else {
        setActiveSessionId(null);
        localStorage.removeItem('activeSessionId');
        router.push('/');
      }
    }
  };

  if (!isInitialized) {
    return <Loading fullScreen message="Initializing..." size="xl" />;
  }

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  return (
    <AuthContext.Provider
      value={{
        user: activeSession?.user || null,
        token: activeSession?.token || null,
        sessions,
        activeSessionId,
        isInitialized,
        error,
        login,
        logoutCurrent,
        logoutAll,
        switchSession,
        removeSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}