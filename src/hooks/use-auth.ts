import { useState } from "react";

export interface User {
  username: string;
  email: string;
  is_admin?: boolean;
  chat_enabled?: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>({
    username: "Ludovic",
    email: "nludoviic@gmail.com",
    is_admin: true,
    chat_enabled: 1,
  });

  const logout = () => {
    setUser(null);
  };

  return { user, logout };
}
