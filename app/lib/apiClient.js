"use client";

export async function apiFetch(path, options = {}, token) {
  const { method = 'GET', body = null, headers = {}, timeout = 0 } = options;

  const fetchOptions = { method, headers: { ...headers }, credentials: 'same-origin' };

  if (token) {
    fetchOptions.headers.Authorization = `Bearer ${token}`;
  }

  if (body != null) {
    if (body instanceof FormData) {
      fetchOptions.body = body;
    } else {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }
  }

  let controller;
  let timeoutId;
  if (timeout && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    fetchOptions.signal = controller.signal;
    // capture controller in closure so later nulling does not cause a crash
    const ctrl = controller;
    timeoutId = setTimeout(() => {
      try { ctrl?.abort?.(); } catch (_) { /* ignore */ }
    }, timeout);
  }

  try {
    const res = await fetch(path, fetchOptions);
    if (res.status === 401) {
      // Only redirect to sign-in if the error indicates an actual authentication failure
      // Check if the response contains a message about invalid/expired token
      try {
        const errorData = await res.clone().json();
        const errorMessage = errorData?.error?.toLowerCase() || errorData?.message?.toLowerCase() || '';
        
        // Only logout on actual auth failures, not permission issues
        const isAuthFailure = errorMessage.includes('token') || 
                            errorMessage.includes('expired') || 
                            errorMessage.includes('invalid') ||
                            errorMessage.includes('no token') ||
                            errorMessage.includes('authentication');
        
        if (isAuthFailure && typeof window !== 'undefined') {
          try { 
            // Clear any stored auth data
            localStorage.removeItem('sessions');
            localStorage.removeItem('activeSessionId');
            window.location.href = '/components/sign-in'; 
          } catch (_) {}
        }
      } catch (parseError) {
        // If we can't parse the response, don't auto-logout
        console.warn('Could not parse 401 response:', parseError);
      }
    }
    return res;
  } catch (err) {
    // Rethrow to be handled by callers
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    // don't mutate controller here; let it be GC'd
  }
}
