import { appConfig } from './app';

const API_BASE_URL = appConfig.apiUrl;

export const api = {
  base: API_BASE_URL,
  url: (path) => `${API_BASE_URL}${path}`,
};

export default API_BASE_URL;
