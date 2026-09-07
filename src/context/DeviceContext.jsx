import React, { createContext, useContext, useEffect, useState } from 'react';
import API_BASE_URL from '../config/api';

const DEVICE_UUID_KEY = 'hamzabi_device_uuid';

const DeviceContext = createContext();

export const useDevice = () => useContext(DeviceContext);

export const DeviceProvider = ({ children }) => {
  const [deviceUuid, setDeviceUuid] = useState(() => {
    let uuid = localStorage.getItem(DEVICE_UUID_KEY);
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem(DEVICE_UUID_KEY, uuid);
    }
    return uuid;
  });

  useEffect(() => {
    if (!deviceUuid) return;
    document.cookie = `device_uuid=${deviceUuid}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    fetch(`${API_BASE_URL}/api/device/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_uuid: deviceUuid })
    }).catch(() => {});
  }, [deviceUuid]);

  return (
    <DeviceContext.Provider value={{ deviceUuid }}>
      {children}
    </DeviceContext.Provider>
  );
};

export default DeviceContext;
