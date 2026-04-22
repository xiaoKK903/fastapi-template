import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react"
import { useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"

import {
  type Body_login_login_access_token as AccessToken,
  LoginService,
  type UserPublic,
  type UserRegister,
  UsersService,
} from "@/client"
import { PermissionsService, type UserWithRoles } from "@/services/permissions"
import { handleError } from "@/utils"
import useCustomToast from "@/hooks/useCustomToast"

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated"

interface AuthContextType {
  user: UserPublic | null | undefined
  userFullInfo: UserWithRoles | null | undefined
  userPermissions: string[] | undefined
  status: AuthStatus
  isAuthenticated: boolean
  isLoading: boolean
  loginMutation: ReturnType<typeof useMutation>
  signUpMutation: ReturnType<typeof useMutation>
  logout: () => void
  refreshUser: () => Promise<void>
  getUserRoles: () => string[]
  isSuperuser: () => boolean
  hasRole: (roleCode: string) => boolean
  hasPermission: (permissionCode: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const [status, setStatus] = useState<AuthStatus>(() => {
    return isLoggedIn() ? "loading" : "unauthenticated"
  })

  const {
    data: user,
    isLoading: userLoading,
    refetch: refetchUser,
    error: userError,
  } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        const result = await UsersService.readUserMe()
        return result
      } catch (error) {
        clearAuthToken()
        setStatus("unauthenticated")
        throw error
      }
    },
    enabled: isLoggedIn(),
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const {
    data: userFullInfo,
    isLoading: userInfoLoading,
  } = useQuery<UserWithRoles | null, Error>({
    queryKey: ["userFullInfo"],
    queryFn: PermissionsService.readMyFullInfo,
    enabled: isLoggedIn(),
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const {
    data: userPermissions,
    isLoading: permissionsLoading,
  } = useQuery<string[], Error>({
    queryKey: ["userPermissions"],
    queryFn: PermissionsService.readMyPermissions,
    enabled: isLoggedIn(),
    retry: 1,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!isLoggedIn()) {
      setStatus("unauthenticated")
      return
    }

    if (userError) {
      setStatus("unauthenticated")
      return
    }

    if (user) {
      setStatus("authenticated")
    } else if (userLoading) {
      setStatus("loading")
    }
  }, [user, userLoading, userError])

  const login = useCallback(async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      formData: data,
    })
    setAuthToken(response.access_token)
    setStatus("loading")
  }, [])

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      await queryClient.invalidateQueries({ queryKey: ["userFullInfo"] })
      await queryClient.invalidateQueries({ queryKey: ["userPermissions"] })
      navigate({ to: "/" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegister) =>
      UsersService.registerUser({ requestBody: data }),
    onSuccess: () => {
      navigate({ to: "/login" })
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const logout = useCallback(() => {
    clearAuthToken()
    setStatus("unauthenticated")
    queryClient.clear()
    navigate({ to: "/login" })
  }, [navigate, queryClient])

  const refreshUser = useCallback(async () => {
    if (isLoggedIn()) {
      setStatus("loading")
      await refetchUser()
    }
  }, [refetchUser])

  const getUserRoles = useCallback((): string[] => {
    if (!userFullInfo?.roles) return []
    return userFullInfo.roles.map((r) => r.code)
  }, [userFullInfo])

  const isSuperuser = useCallback((): boolean => {
    return user?.is_superuser || false
  }, [user])

  const hasRole = useCallback(
    (roleCode: string): boolean => {
      return getUserRoles().includes(roleCode)
    },
    [getUserRoles]
  )

  const hasPermission = useCallback(
    (permissionCode: string): boolean => {
      if (!userPermissions) return false
      if (userPermissions.includes("*:*")) return true
      return userPermissions.includes(permissionCode)
    },
    [userPermissions]
  )

  const value: AuthContextType = {
    user,
    userFullInfo,
    userPermissions,
    status,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    loginMutation,
    signUpMutation,
    logout,
    refreshUser,
    getUserRoles,
    isSuperuser,
    hasRole,
    hasPermission,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
