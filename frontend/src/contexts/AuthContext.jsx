import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [accessToken, setAccessToken] = useState(() => {
    return sessionStorage.getItem('accessToken') || null;
  });
  const [loading, setLoading] = useState(true);

  // Set auth state
  const setAuthState = (token, userInfo) => {
    if (token) {
      const decoded = parseJwt(token);
      const combinedUser = { ...userInfo, ...decoded };
      setAccessToken(token);
      setUser(combinedUser);
      sessionStorage.setItem('accessToken', token);
      sessionStorage.setItem('user', JSON.stringify(combinedUser));
    } else {
      setAccessToken(null);
      setUser(null);
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('user');
    }
  };

  // Login handler
  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setAuthState(data.accessToken, data.user);
    return data.user;
  };

  // Logout handler
  const logout = async () => {
    try {
      if (accessToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    } catch (e) {
      console.error('Logout API call failed', e);
    } finally {
      setAuthState(null, null);
    }
  };

  // Silent refresh handler
  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        // Since refresh doesn't return user info, we merge with existing user state
        setAuthState(data.accessToken, user);
        return data.accessToken;
      } else {
        // Refresh token expired or invalid
        setAuthState(null, null);
      }
    } catch (e) {
      console.error('Silent refresh failed', e);
      setAuthState(null, null);
    }
    return null;
  };

  // Auto-refresh timer before access token expires (15 mins)
  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    const decoded = parseJwt(accessToken);
    if (!decoded) {
      setLoading(false);
      return;
    }

    // Refresh 60 seconds before expiry
    const expiryTime = decoded.exp * 1000;
    const timeUntilExpiry = expiryTime - Date.now();
    const refreshDelay = Math.max(timeUntilExpiry - 60000, 0);

    const timer = setTimeout(() => {
      refresh();
    }, refreshDelay);

    setLoading(false);
    return () => clearTimeout(timer);
  }, [accessToken]);

  // Initial check on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (accessToken) {
        // Try validating/refreshing token
        await refresh();
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout, refresh }}>
      {!loading && children}
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
