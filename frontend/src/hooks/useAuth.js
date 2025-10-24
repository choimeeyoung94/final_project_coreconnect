import { useState, useEffect } from "react";
import { getAccessToken, clearAccessToken } from "../utils/tokenUtils";

export default function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!getAccessToken());

  useEffect(() => {
    const token = getAccessToken();
    setIsLoggedIn(!!token);
  }, []);

  const logout = () => {
    clearAccessToken();
    setIsLoggedIn(false);
  };

  return { isLoggedIn, setIsLoggedIn, logout };
}
