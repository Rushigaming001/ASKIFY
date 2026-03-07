import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Mail, Lock, User, Zap, Check, X, Eye, EyeOff, Shield, KeyRound, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import askifyLogoNew from '@/assets/askify-logo-new.png';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

type AuthStep = 'credentials' | 'otp';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // OTP state
  const [authStep, setAuthStep] = useState<AuthStep>('credentials');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Store credentials temporarily for post-OTP login
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string; name?: string } | null>(null);

  const { login, register, session, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    if (session?.user) {
      navigate('/', { replace: true });
    }
  }, [authLoading, session?.user?.id, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score, label: 'Fair', color: 'bg-orange-500' };
    if (score <= 4) return { score, label: 'Good', color: 'bg-yellow-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  }, [password]);

  const sendOTP = async (emailAddr: string, purpose: string) => {
    console.log('Sending OTP to:', emailAddr, 'purpose:', purpose);

    const invokePromise = supabase.functions.invoke('send-otp', {
      body: { email: emailAddr.trim().toLowerCase(), purpose },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), 12000);
    });

    try {
      const { data, error } = await Promise.race([invokePromise, timeoutPromise]);
      console.log('OTP response:', { data, error });

      if (error) {
        console.error('OTP invoke error:', error);
        throw new Error(typeof error === 'object' && error?.message ? error.message : 'Failed to send verification code');
      }

      if (data?.error) throw new Error(data.error);
      return data;
    } catch (err: any) {
      console.error('OTP send failed:', err);
      throw new Error(err?.message || 'Failed to send verification code');
    }
  };

  const verifyOTP = async (emailAddr: string, code: string, purpose: string) => {
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: { email: emailAddr, code, purpose },
    });

    if (error) throw new Error('Verification failed');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!email || !password || (!isLogin && !name)) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (!isLogin && !acceptTerms) {
      toast({ title: 'Error', description: 'Please accept the terms and conditions', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    console.log('handleSubmit: sending OTP...', { email, isLogin });
    try {
      const purpose = isLogin ? 'login' : 'register';
      await sendOTP(email, purpose);
      
      console.log('handleSubmit: OTP sent successfully');
      setPendingCredentials({ email, password, name: isLogin ? undefined : name });
      setAuthStep('otp');
      setResendCooldown(60);
      toast({ title: 'Code Sent', description: 'A 6-digit verification code has been sent to your email.' });
    } catch (error: any) {
      console.error('handleSubmit error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to send verification code', variant: 'destructive' });
    } finally {
      console.log('handleSubmit: done, resetting isLoading');
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6 || !pendingCredentials) return;
    
    setOtpLoading(true);
    try {
      const purpose = isLogin ? 'login' : 'register';
      await verifyOTP(pendingCredentials.email, otpCode, purpose);

      // OTP verified, now complete auth
      if (isLogin) {
        const result = await login(pendingCredentials.email, pendingCredentials.password);
        if (!result.success) {
          toast({ title: 'Login Failed', description: result.error || 'Invalid email or password', variant: 'destructive' });
          setAuthStep('credentials');
          setPendingCredentials(null);
          setOtpCode('');
          return;
        }
        toast({ title: 'Welcome back!', description: 'Logged in successfully!' });
        navigate('/', { replace: true });
      } else {
        const result = await register(pendingCredentials.email, pendingCredentials.password, pendingCredentials.name!);
        if (!result.success) {
          toast({ title: 'Registration Failed', description: result.error || 'Could not create account', variant: 'destructive' });
          setAuthStep('credentials');
          setPendingCredentials(null);
          setOtpCode('');
          return;
        }
        toast({ title: 'Welcome!', description: 'Account created successfully!' });
        // For registration, switch to login
        setIsLogin(true);
        setPassword('');
        setAuthStep('credentials');
        setPendingCredentials(null);
        setOtpCode('');
      }
    } catch (error: any) {
      toast({ title: 'Verification Failed', description: error.message || 'Invalid or expired code', variant: 'destructive' });
      setOtpCode('');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0 || !pendingCredentials) return;
    
    setOtpLoading(true);
    try {
      const purpose = isLogin ? 'login' : 'register';
      await sendOTP(pendingCredentials.email, purpose);
      setResendCooldown(60);
      setOtpCode('');
      toast({ title: 'Code Resent', description: 'A new verification code has been sent.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to resend code', variant: 'destructive' });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://minequest.fun/auth' }
      });
      if (error) {
        toast({ title: 'Google Sign-in Failed', description: error.message || 'Google sign-in failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Google Sign-in Failed', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      toast({ title: 'Error', description: 'Please enter your email address', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Password reset link sent to your email' });
        setShowForgotPassword(false);
        setResetEmail('');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send reset email', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "pl-12 h-12 bg-white border-blue-100 text-slate-800 placeholder:text-slate-400 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm";
  const iconClass = "h-5 w-5 text-blue-400 group-focus-within:text-blue-600 transition-colors";

  // OTP Verification Screen
  if (authStep === 'otp') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 animate-gradient-shift" style={{ backgroundSize: '400% 400%' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-blue-100/30" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/6 w-80 h-80 bg-blue-300/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-300/20 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: '2s' }} />
        </div>

        <Card className="relative z-10 w-full max-w-md shadow-2xl shadow-blue-200/40 border border-blue-100/50 bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardHeader className="text-center space-y-4 pb-4 pt-8">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-3 bg-gradient-to-r from-blue-400 via-cyan-400 to-sky-400 blur-2xl opacity-20 rounded-full" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 shadow-lg">
                  <KeyRound className="h-10 w-10 text-blue-500" />
                </div>
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-800">Email Verification</CardTitle>
              <CardDescription className="text-sm text-slate-500 mt-2">
                Enter the 6-digit code sent to<br />
                <span className="font-semibold text-blue-600">{pendingCredentials?.email}</span>
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pb-8 px-6 space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="h-14 w-12 text-xl font-bold border-blue-200" />
                  <InputOTPSlot index={1} className="h-14 w-12 text-xl font-bold border-blue-200" />
                  <InputOTPSlot index={2} className="h-14 w-12 text-xl font-bold border-blue-200" />
                  <InputOTPSlot index={3} className="h-14 w-12 text-xl font-bold border-blue-200" />
                  <InputOTPSlot index={4} className="h-14 w-12 text-xl font-bold border-blue-200" />
                  <InputOTPSlot index={5} className="h-14 w-12 text-xl font-bold border-blue-200" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button 
              onClick={handleVerifyOTP} 
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/30 rounded-xl"
              disabled={otpCode.length !== 6 || otpLoading}
            >
              {otpLoading ? 'Verifying...' : 'Verify & Continue'}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-sm text-slate-500">
                Didn't receive the code?{' '}
                {resendCooldown > 0 ? (
                  <span className="text-blue-400">Resend in {resendCooldown}s</span>
                ) : (
                  <button onClick={handleResendOTP} className="text-blue-600 hover:underline font-semibold" disabled={otpLoading}>
                    Resend Code
                  </button>
                )}
              </p>
              <button 
                onClick={() => {
                  setAuthStep('credentials');
                  setPendingCredentials(null);
                  setOtpCode('');
                }}
                className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to {isLogin ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </CardContent>
        </Card>

        <style>{`
          @keyframes gradient-shift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
          @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
          @keyframes float-slow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-25px); } }
          .animate-gradient-shift { animation: gradient-shift 10s ease infinite; }
          .animate-float { animation: float 6s ease-in-out infinite; }
          .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Blue-white gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 animate-gradient-shift" style={{ backgroundSize: '400% 400%' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-blue-100/30" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/6 w-80 h-80 bg-blue-300/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-300/20 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-sky-200/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-1/3 left-1/4 w-48 h-48 bg-blue-200/20 rounded-full blur-2xl animate-float-slow" style={{ animationDelay: '3s' }} />
        <div className="absolute top-20 left-20 w-2 h-2 bg-blue-400/40 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-cyan-400/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 bg-blue-300/30 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-8 lg:gap-12 animate-scale-in">
        
        <Card className="w-full max-w-md shadow-2xl shadow-blue-200/40 border border-blue-100/50 bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardHeader className="text-center space-y-4 pb-6 pt-8">
            <div className="flex justify-center">
              <div className="relative animate-float">
                <div className="absolute -inset-3 bg-gradient-to-r from-blue-400 via-cyan-400 to-sky-400 blur-2xl opacity-20 rounded-full" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 shadow-lg">
                  <img src={askifyLogoNew} alt="Askify" className="h-16 w-16 object-contain" />
                </div>
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl sm:text-4xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent">
                  ASKIFY
                </span>
              </CardTitle>
              <CardDescription className="text-sm text-slate-500 font-medium flex items-center justify-center gap-2 mt-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Your Intelligent AI Companion
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pb-8 px-6">
            {showForgotPassword ? (
              <div className="space-y-5">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-slate-800 mb-1">Reset Password</h3>
                  <p className="text-sm text-slate-500">Enter your email to receive a reset link</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-semibold text-slate-700">Email</Label>
                  <div className="relative group">
                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${iconClass}`} />
                    <Input id="reset-email" type="email" placeholder="you@example.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <Button onClick={handleForgotPassword} className="w-full h-12 text-base font-bold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/30 rounded-xl" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <Button onClick={() => setShowForgotPassword(false)} variant="ghost" className="w-full text-slate-500 hover:text-slate-700">
                  Back to Login
                </Button>
              </div>
            ) : (
              <Tabs value={isLogin ? 'login' : 'register'} onValueChange={(v) => setIsLogin(v === 'login')}>
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-blue-50 p-1 rounded-full border border-blue-100">
                  <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 font-semibold transition-all">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="register" className="rounded-full data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-500 font-semibold transition-all">
                    Sign Up
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-sm font-semibold text-slate-700">Email</Label>
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 ${iconClass}`} />
                        <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password" className="text-sm font-semibold text-slate-700">Password</Label>
                        <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors">
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative group">
                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 ${iconClass}`} />
                        <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-bold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/30 hover:shadow-blue-500/40 transition-all hover:scale-[1.02] rounded-xl" size="lg" disabled={isLoading}>
                      {isLoading ? 'Sending code...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name" className="text-sm font-semibold text-slate-700">Full Name</Label>
                      <div className="relative group">
                        <User className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 ${iconClass}`} />
                        <Input id="register-name" type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-sm font-semibold text-slate-700">Email</Label>
                      <div className="relative group">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 ${iconClass}`} />
                        <Input id="register-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-sm font-semibold text-slate-700">Password</Label>
                      <div className="relative group">
                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 ${iconClass}`} />
                        <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {password && (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= passwordStrength.score ? passwordStrength.color : 'bg-slate-200'}`} />
                            ))}
                          </div>
                          <p className={`text-xs ${passwordStrength.score <= 2 ? 'text-red-500' : passwordStrength.score <= 3 ? 'text-orange-500' : passwordStrength.score <= 4 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {passwordStrength.label}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm" className="text-sm font-semibold text-slate-700">Confirm Password</Label>
                      <div className="relative group">
                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 ${iconClass}`} />
                        <Input id="register-confirm" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClass} pr-12`} />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {confirmPassword && (
                        <div className="flex items-center gap-1 text-xs">
                          {password === confirmPassword ? (
                            <><Check className="h-3 w-3 text-green-500" /><span className="text-green-600">Passwords match</span></>
                          ) : (
                            <><X className="h-3 w-3 text-red-500" /><span className="text-red-500">Passwords don't match</span></>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                      <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(checked) => setAcceptTerms(checked as boolean)} className="mt-0.5 border-blue-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                      <label htmlFor="terms" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                        I agree to the{' '}
                        <button type="button" onClick={() => setShowRules(true)} className="text-blue-500 hover:underline font-medium">
                          Terms of Service & Privacy Policy
                        </button>
                        . I confirm that I am at least 13 years old.
                      </label>
                    </div>
                    <Button type="submit" className="w-full h-12 text-base font-bold bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-400/30 hover:shadow-blue-500/40 transition-all hover:scale-[1.02] rounded-xl" size="lg" disabled={isLoading}>
                      {isLoading ? 'Sending code...' : 'Sign Up'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="px-4 text-slate-400 bg-white/90">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <Button type="button" variant="outline" onClick={handleGoogleSignIn} disabled={isLoading} className="w-full h-12 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-semibold rounded-xl shadow-sm hover:shadow-md transition-all">
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
          </CardContent>
        </Card>

        {/* Right - Welcome panel */}
        <div className="hidden lg:flex flex-col items-center justify-center flex-1 text-center px-8">
          <div className="relative mb-8">
            <div className="absolute -inset-8 bg-gradient-to-r from-blue-400/20 via-cyan-400/20 to-sky-400/20 blur-3xl rounded-full" />
            <div className="relative">
              <img src={askifyLogoNew} alt="Askify" className="h-32 w-32 object-contain animate-float drop-shadow-2xl" />
            </div>
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent mb-4">
            Welcome to Askify
          </h2>
          <p className="text-lg text-slate-500 max-w-sm leading-relaxed">
            Your all-in-one AI platform for chat, learning, gaming and more. Join thousands of users today.
          </p>
          <div className="flex gap-3 mt-8">
            {['AI Chat', 'Games', 'Voice Calls', 'Community'].map((feature) => (
              <span key={feature} className="px-4 py-2 bg-white/70 border border-blue-100 rounded-full text-sm font-medium text-blue-600 shadow-sm">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Rules & Policy Dialog */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-blue-500" />
              Askify Rules & Privacy Policy
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm text-slate-700 leading-relaxed">
            <section>
              <h3 className="font-bold text-base text-slate-900 mb-2">1. Community Rules</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Be respectful and kind to all users. Harassment, bullying, or hate speech will result in an immediate ban.</li>
                <li>Do not share inappropriate, offensive, or NSFW content in any chat or public space.</li>
                <li>Do not spam messages, images, or links in public or private chats.</li>
                <li>Do not impersonate other users, moderators, or administrators.</li>
                <li>Do not attempt to exploit bugs, vulnerabilities, or hack any part of the platform.</li>
                <li>Keep personal information private. Do not share others' personal data without consent.</li>
                <li>Follow moderator instructions at all times. Moderator decisions are final.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-base text-slate-900 mb-2">2. Account Rules</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>You must be at least 13 years old to use Askify.</li>
                <li>Each user may only create one account. Multiple accounts will be banned.</li>
                <li>You are responsible for keeping your login credentials secure.</li>
                <li>Do not share your account or password with anyone.</li>
                <li>Accounts involved in fraudulent activity will be permanently suspended.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-base text-slate-900 mb-2">3. AI Usage Policy</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>AI features are provided for legitimate, constructive purposes only.</li>
                <li>Do not use AI to generate harmful, illegal, or deceptive content.</li>
                <li>AI-generated responses are not guaranteed to be accurate. Use at your own discretion.</li>
                <li>Excessive or abusive API usage may result in rate limiting or account suspension.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-base text-slate-900 mb-2">4. Privacy Policy</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>We collect your email, name, and usage data to provide and improve our services.</li>
                <li>Your messages and data are stored securely and are not shared with third parties.</li>
                <li>We use cookies and similar technologies for session management and analytics.</li>
                <li>You can request deletion of your account and data at any time by contacting support.</li>
                <li>We may update this policy from time to time. Continued use implies acceptance.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-base text-slate-900 mb-2">5. Content & Intellectual Property</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>You retain ownership of content you create. By posting, you grant Askify a license to display it within the platform.</li>
                <li>Do not upload copyrighted material without proper authorization.</li>
                <li>Askify reserves the right to remove any content that violates these rules.</li>
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-base text-slate-900 mb-2">6. Enforcement</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Violations may result in warnings, temporary mutes, timeouts, or permanent bans.</li>
                <li>Severe violations (threats, illegal activity) will be reported to relevant authorities.</li>
                <li>The Owner and Admin team have full discretion over moderation actions.</li>
              </ul>
            </section>
            <p className="text-xs text-slate-400 pt-4 border-t border-slate-200">
              Last updated: February 2026. By using Askify, you agree to abide by these rules and policies.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Animations */}
      <style>{`
        @keyframes gradient-shift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-25px); } }
        @keyframes scale-in { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        .animate-gradient-shift { animation: gradient-shift 10s ease infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-scale-in { animation: scale-in 0.5s ease-out; }
      `}</style>
    </div>
  );
};

export default Auth;
