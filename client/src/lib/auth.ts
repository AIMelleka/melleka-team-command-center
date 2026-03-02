const TOKEN_KEY = "melleka_hub_token";
const NAME_KEY = "melleka_hub_name";

export function saveAuth(token: string, name: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(NAME_KEY, name);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getMemberName(): string | null {
  return localStorage.getItem(NAME_KEY);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
