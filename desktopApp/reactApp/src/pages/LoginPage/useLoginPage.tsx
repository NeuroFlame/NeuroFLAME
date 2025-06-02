import { useUserState } from "../../contexts/UserStateContext";

export function useLoginPage() {
    const { username, clearUserData } = useUserState();
    
    return {
        isLoggedIn: !!username,
        logout: clearUserData
    };
}