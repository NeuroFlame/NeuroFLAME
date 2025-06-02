import { useUserState } from "../../contexts/UserStateContext";

export function useHomePage() {
    const { username, clearUserData } = useUserState();
    
    return {
        isLoggedIn: !!username,
        logout: clearUserData
    };
}