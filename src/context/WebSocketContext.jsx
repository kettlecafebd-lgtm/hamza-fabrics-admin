import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { appConfig } from '../config/app';

const WebSocketContext = createContext(null);

const WS_RECONNECT_DELAY = 3000;
const WS_MAX_RECONNECT_DELAY = 30000;

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const listenersRef = useRef(new Map());
  const reconnectTimerRef = useRef(null);
  const reconnectDelayRef = useRef(WS_RECONNECT_DELAY);

  const getWsUrl = useCallback(() => {
    const apiUrl = appConfig.apiUrl;
    const protocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const token = localStorage.getItem('adminToken');
    if (!token) return null;
    return `${protocol}://${apiUrl.replace(/^https?:\/\//, '')}/ws?token=${token}`;
  }, []);

  const connect = useCallback(() => {
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectDelayRef.current = WS_RECONNECT_DELAY;
    };

    ws.onmessage = (event) => {
      try {
        const { event: eventName, data } = JSON.parse(event.data);
        const callbacks = listenersRef.current.get(eventName);
        if (callbacks) callbacks.forEach(cb => cb(data));
        const allCallbacks = listenersRef.current.get('*');
        if (allCallbacks) allCallbacks.forEach(cb => cb(eventName, data));
      } catch (_) {}
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimerRef.current = setTimeout(() => {
        connect();
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 1.5,
          WS_MAX_RECONNECT_DELAY
        );
      }, reconnectDelayRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [getWsUrl]);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  const subscribe = useCallback((event, callback) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event).add(callback);
    return () => listenersRef.current.get(event)?.delete(callback);
  }, []);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export default WebSocketContext;
