import { useState } from 'react';
import { useCentralApi } from "../../../apis/centralApi/centralApi";
import { useEdgeApi } from "../../../apis/edgeApi/edgeApi";
import { useUserState } from "../../../contexts/UserStateContext";
import { useNavigate } from 'react-router-dom';

export function useLogin() {
  const { login } = useCentralApi();
  const { connectAsUser } = useEdgeApi();
  const { setUserData } = useUserState();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (username: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      // request to the central api
      const userData = await login({ username, password });
      await setUserData(userData);
      await connectAsUser();
      navigate('/home');
    } catch (err) {
      setError('Login failed, please try again.');
    } finally {
      setLoading(false);
    }
  };

  return { handleLogin, loading, error };
};
