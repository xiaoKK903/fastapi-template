import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  type Body_login_login_access_token as AccessToken,
  LoginService,
  type UserPublic,
  type UserRegister,
  UsersService,
} from "@/client"
import { PermissionsService, type UserWithRoles } from "@/services/permissions"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const { data: user } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: UsersService.readUserMe,
    enabled: isLoggedIn(),
  })

  const { data: userFullInfo } = useQuery<UserWithRoles | null, Error>({
    queryKey: ["userFullInfo"],
    queryFn: PermissionsService.readMyFullInfo,
    enabled: isLoggedIn(),
  })

  const { data: userPermissions } = useQuery<string[], Error>({
    queryKey: ["userPermissions"],
    queryFn: PermissionsService.readMyPermissions,
    enabled: isLoggedIn(),
    retry: false,
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

  const login = async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      formData: data,
    })
    localStorage.setItem("access_token", response.access_token)
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      queryClient.invalidateQueries({ queryKey: ["userFullInfo"] })
      queryClient.invalidateQueries({ queryKey: ["userPermissions"] })
      navigate({ to: "/" })
    },
    onError: handleError.bind(showErrorToast),
  })

  const logout = () => {
    localStorage.removeItem("access_token")
    queryClient.clear()
    navigate({ to: "/login" })
  }

  const getUserRoles = (): string[] => {
    if (!userFullInfo?.roles) return []
    return userFullInfo.roles.map((r) => r.code)
  }

  const isSuperuser = (): boolean => {
    return user?.is_superuser || false
  }

  const hasRole = (roleCode: string): boolean => {
    return getUserRoles().includes(roleCode)
  }

  const hasPermission = (permissionCode: string): boolean => {
    if (!userPermissions) return false
    if (userPermissions.includes("*:*")) return true
    return userPermissions.includes(permissionCode)
  }

  return {
    signUpMutation,
    loginMutation,
    logout,
    user,
    userFullInfo,
    userPermissions,
    getUserRoles,
    isSuperuser,
    hasRole,
    hasPermission,
    isLoggedIn,
  }
}

export { isLoggedIn }
export default useAuth
