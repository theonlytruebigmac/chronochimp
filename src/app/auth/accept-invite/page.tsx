"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Create a client component that uses the search params
function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [token, setToken] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    // Safely get token from URL
    const tokenParam = searchParams?.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      // Fetch the invite details
      fetchInviteDetails(tokenParam);
    } else {
      setInviteError('No invite token provided in the URL. Please check your invite link.');
      setIsLoading(false);
    }
  }, [searchParams]);

  const fetchInviteDetails = async (inviteToken: string) => {
    try {
      const response = await fetch(`/api/auth/verify-invite?token=${encodeURIComponent(inviteToken)}`);
      const data = await response.json();
      
      if (response.ok) {
        setEmail(data.email);
        setIsLoading(false);
      } else {
        setInviteError(data.error || 'Invalid or expired invite.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching invite details:', error);
      setInviteError('Failed to verify invite. Please try again or contact support.');
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submission started");
    
    if (!token) {
      toast({ title: "Error", description: "Invalid invite token", variant: "destructive" });
      return;
    }
    if (!name || !password || !confirmPassword) {
      toast({ title: "Error", description: "All fields are required", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    console.log("Submitting to /api/auth/complete-invite with token:", token.substring(0, 8) + "...");
    
    try {
      // Make sure correct API endpoint is called
      const response = await fetch('/api/auth/complete-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token, 
          name, 
          password,
          email // Include email for additional verification
        }),
      });
      
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);
      
      if (response.ok) {
        toast({ title: "Success!", description: "Your account has been created. You can now sign in." });
        setTimeout(() => router.push('/auth/signin' as any), 1500); // Give toast time to display
      } else {
        toast({ 
          title: "Error", 
          description: data.error || "Failed to create account", 
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error('Error accepting invite:', error);
      toast({ 
        title: "Error", 
        description: "An unexpected error occurred", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p>Verifying your invite...</p>
      </div>
    );
  }

  if (inviteError) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invite Error</CardTitle>
          <CardDescription>There was a problem with your invite link.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{inviteError}</p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => router.push('/auth/login')} className="w-full">
            Go to Login
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Complete Your Registration</CardTitle>
        <CardDescription>
          Set up your account to accept the invitation sent to {email}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Choose a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// Main page component with Suspense boundary
export default function AcceptInvitePage() {
  return (
    <div className="w-full max-w-md mx-auto">
      <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
