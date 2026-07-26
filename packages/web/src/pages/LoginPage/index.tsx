import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Form, Input } from '@heroui/react';
import { Label, TextField } from 'react-aria-components';

import { ApiError } from '@/lib/apiClient';
import { useLogin } from '@/hooks/queries/auth';
import { strings } from '@/strings/pt-BR';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate('/'),
        onError: (err) => {
          setError(
            err instanceof ApiError && err.status === 401
              ? strings.auth.invalidCredentials
              : strings.auth.genericError,
          );
        },
      },
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-8 shadow-surface">
        <h1 className="mb-6 text-center text-2xl font-semibold text-surface-foreground">
          {strings.appName}
        </h1>

        <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField name="email" type="email" isRequired className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-foreground">{strings.auth.email}</Label>
            <Input fullWidth />
          </TextField>

          <TextField name="password" type="password" isRequired className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-foreground">{strings.auth.password}</Label>
            <Input fullWidth />
          </TextField>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" fullWidth isDisabled={login.isPending} className="mt-2">
            {strings.auth.login}
          </Button>
        </Form>
      </div>
    </div>
  );
}
