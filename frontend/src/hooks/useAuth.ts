const AUTH_TOKEN_KEY = "access_token"

export function isLoggedIn(): boolean {
  return localStorage.getItem(AUTH_TOKEN_KEY) !== null
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export { useAuth, AuthProvider } from "@/contexts/AuthContext"
export default useAuth
