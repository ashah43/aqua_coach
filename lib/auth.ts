// lib/auth.ts
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// Helps close the browser on web
WebBrowser.maybeCompleteAuthSession();

// This MUST match a redirect URL you added in Supabase auth settings
// e.g. exp://.../--/auth/callback when running in dev
const redirectTo = makeRedirectUri({
  path: '/auth/callback',
});

async function createSessionFromUrl(url: string) {
    const { params, errorCode } = QueryParams.getQueryParams(url);
  
    if (errorCode) {
      console.log('OAuth errorCode:', errorCode);
      return;
    }
  
    const { access_token, refresh_token } = params as {
      access_token?: string;
      refresh_token?: string;
    };
  
    if (!access_token) {
      console.log('No access_token in callback URL');
      return;
    }
  
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token: refresh_token ?? '',
    });
  
    if (error) {
      console.log('Error setting Supabase session:', error);
    } else {
      console.log('Supabase session set from OAuth redirect');
    }
  }
  

// Call this from your Settings button
export async function signInWithGoogle() {
  // Ask Supabase to generate the Google OAuth URL
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // we will open the browser ourselves with WebBrowser
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.log('Error starting Google OAuth:', error);
    return;
  }

  const authUrl = data?.url ?? '';
  if (!authUrl) {
    console.log('No auth URL returned from Supabase');
    return;
  }

  // Open system browser and wait for the redirect back
  const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);

  if (res.type === 'success' && res.url) {
    await createSessionFromUrl(res.url);
  } else {
    console.log('Google sign-in cancelled or failed:', res);
  }
}
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log('Error signing out:', error);
    } else {
      console.log('Signed out');
    }
  }
  