
import * as React from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function LoginPage() {
  return (
    // Centering is now handled by RootLayout for auth pages
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Welcome Back!</CardTitle>
        <CardDescription>Sign in to continue to ChronoChimp</CardDescription>
      </CardHeader>
      <CardContent>
        <React.Suspense fallback={
          <div className="flex items-center justify-center py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          </div>
        }>
          <LoginForm />
        </React.Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className="font-medium text-primary hover:underline">
            Sign Up
          </Link>
        </p>
         <p className="mt-2 text-center text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" className="font-medium text-primary hover:underline">
            Forgot Password?
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
