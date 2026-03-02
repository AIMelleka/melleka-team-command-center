import React, { useState } from "react";
import { Login } from "./pages/Login.tsx";
import { Chat } from "./pages/Chat.tsx";
import { getMemberName, isLoggedIn } from "./lib/auth.ts";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);
  const [memberName, setMemberName] = useState<string>(getMemberName() ?? "");

  function handleLogin(name: string) {
    setMemberName(name);
    setLoggedIn(true);
  }

  function handleLogout() {
    setMemberName("");
    setLoggedIn(false);
  }

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return <Chat memberName={memberName} onLogout={handleLogout} />;
}
