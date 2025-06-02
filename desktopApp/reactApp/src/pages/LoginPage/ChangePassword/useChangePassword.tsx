// useChangePassword.ts
import { useState } from 'react';
import { useCentralApi } from '../../../apis/centralApi/centralApi';

export function useChangePassword() {
    const { userChangePassword } = useCentralApi();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChangePassword = async (newPassword: string) => {
        try {
            setLoading(true);
            setError(null);
            // Request to change the password without needing a username
            await userChangePassword({ password: newPassword });
        } catch (err) {
            setError('Reset password failed, please try again.');
        } finally {
            setLoading(false);
        }
    };

    return { handleChangePassword, loading, error };
}
