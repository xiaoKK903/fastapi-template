import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useCallback } from "react"

import {
  type Body_login_login_access_token as AccessToken,
  LoginService,
  type UserPublic,
  type UserRegister,
  UsersService,
} from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { PermissionsService, type UserWithRoles } from "@/services/permissions"
import { handleError } from "@/utils"

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

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const {
    data: user,
    isLoading: userLoading,
    refetch: refetchUser,
    isError: isUserError,
  } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        return await UsersService.readUserMe()
      } catch (error) {
        clearAuthToken()
        throw error
      }
    },
    enabled: isLoggedIn(),
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const { data: userFullInfo, isLoading: userInfoLoading } = useQuery<
    UserWithRoles | null,
    Error
  >({
    queryKey: ["userFullInfo"],
    queryFn: PermissionsService.readMyFullInfo,
    enabled: isLoggedIn(),
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const { data: userPermissions, isLoading: permissionsLoading } = useQuery<
    string[],
    Error
  >({
    queryKey: ["userPermissions"],
    queryFn: PermissionsService.readMyPermissions,
    enabled: isLoggedIn(),
    retry: 1,
    refetchOnWindowFocus: false,
  })

  const isLoading = userLoading || userInfoLoading || permissionsLoading
  const isAuthenticated = isLoggedIn() && !isUserError
  const status = isAuthenticated
    ? "authenticated"
    : isLoading
      ? "loading"
      : "unauthenticated"

  const login = useCallback(async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      formData: data,
    })
    setAuthToken(response.access_token)
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
    queryClient.clear()
    navigate({ to: "/login" })
  }, [navigate, queryClient])

  const refreshUser = useCallback(async () => {
    if (isLoggedIn()) {
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
    [getUserRoles],
  )

  const hasPermission = useCallback(
    (permissionCode: string): boolean => {
      if (!userPermissions) return false
      if (userPermissions.includes("*:*")) return true
      return userPermissions.includes(permissionCode)
    },
    [userPermissions],
  )

  return {
    user,
    userFullInfo,
    userPermissions,
    isAuthenticated,
    isLoading,
    userLoading,
    status,
    loginMutation,
    signUpMutation,
    logout,
    refreshUser,
    getUserRoles,
    isSuperuser,
    hasRole,
    hasPermission,
  }
}

// 移除 AuthProvider 导出，因为我们不再需要它
export { useAuth }
export default useAuth
