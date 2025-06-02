import { useState } from 'react';
import { useCentralApi } from "../../../apis/centralApi/centralApi";

export function useCreateUser() {
    const { userCreate } = useCentralApi();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleUserCreate = async (username: string, password: string) => {
        try {
            setLoading(true);
            setError(null);
            // request to the central api
            await userCreate({ username, password });

        } catch (err) {
            setError('Create user failed, please try again.');
        } finally {
            setLoading(false);
            setSuccess(true);
        }
    };

    return { handleUserCreate, loading, error, success };
};
