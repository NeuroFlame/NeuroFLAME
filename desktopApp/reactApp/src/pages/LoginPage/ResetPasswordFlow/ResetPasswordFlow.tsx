import { useState } from 'react';
import { RequestPasswordReset } from './RequestPasswordReset';
import { ResetPassword } from './ResetPassword';

export function ResetPasswordFlow() {
    const [formType, setFormType] = useState<'requestPasswordReset' | 'resetPassword'>('requestPasswordReset');

    if (formType === 'requestPasswordReset') {
        return <RequestPasswordReset onChangeFormType={() => setFormType('resetPassword')} />;
    }

    return <ResetPassword onChangeFormType={() => setFormType('requestPasswordReset')} />;
};
