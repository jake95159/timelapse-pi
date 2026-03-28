import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ConnectionState, PiStatus } from '../api/client';

const AP_GATEWAY = 'http://10.42.0.1:8000';
const MDNS_HOST = 'http://timelapse-pi.local:8000';
const HEARTBEAT_INTERVAL = 5000;
const MAX_FAILURES = 3;
const STORAGE_KEY_PI_ADDRESS = '@pi_address';
const STORAGE_KEY_LAST_STATUS = '@last_status';

interface ConnectionContextValue {
  state: ConnectionState;
  piAddress: string | null;
  lastStatus: PiStatus | null;
  connect: (address?: string) => Promise<void>;
  disconnect: () => void;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  state: 'searching',
  piAddress: null,
  lastStatus: null,
  connect: async () => {},
  disconnect: () => {},
});

export function useConnection() {
  return useContext(ConnectionContext);
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConnectionState>('searching');
  const [piAddress, setPiAddress] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<PiStatus | null>(null);
  const failureCount = useRef(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tryConnect = useCallback(async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${url}/api/status`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const status: PiStatus = await res.json();
        api.setBaseUrl(url);
        setPiAddress(url);
        setLastStatus(status);
        setState('connected');
        failureCount.current = 0;
        await AsyncStorage.setItem(STORAGE_KEY_PI_ADDRESS, url);
        await AsyncStorage.setItem(STORAGE_KEY_LAST_STATUS, JSON.stringify(status));
        return true;
      }
    } catch {}
    return false;
  }, []);

  const discover = useCallback(async () => {
    setState('searching');

    const lastAddress = await AsyncStorage.getItem(STORAGE_KEY_PI_ADDRESS);
    if (lastAddress && await tryConnect(lastAddress)) return;

    if (await tryConnect(MDNS_HOST)) return;

    if (await tryConnect(AP_GATEWAY)) return;

    const cached = await AsyncStorage.getItem(STORAGE_KEY_LAST_STATUS);
    if (cached) {
      setLastStatus(JSON.parse(cached));
    }

    setState('disconnected');
  }, [tryConnect]);

  const connect = useCallback(async (address?: string) => {
    if (address) {
      const url = address.startsWith('http') ? address : `http://${address}:8000`;
      if (await tryConnect(url)) return;
      setState('disconnected');
    } else {
      await discover();
    }
  }, [tryConnect, discover]);

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    setState('disconnected');
    setPiAddress(null);
  }, []);

  useEffect(() => {
    if (state !== 'connected' || !piAddress) return;

    heartbeatRef.current = setInterval(async () => {
      try {
        const status = await api.get<PiStatus>('/api/status');
        setLastStatus(status);
        failureCount.current = 0;
        await AsyncStorage.setItem(STORAGE_KEY_LAST_STATUS, JSON.stringify(status));
      } catch {
        failureCount.current++;
        if (failureCount.current >= MAX_FAILURES) {
          setState('disconnected');
        }
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [state, piAddress]);

  useEffect(() => {
    discover();
  }, [discover]);

  return (
    <ConnectionContext.Provider value={{ state, piAddress, lastStatus, connect, disconnect }}>
      {children}
    </ConnectionContext.Provider>
  );
}
