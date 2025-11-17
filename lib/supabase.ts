import { createClient } from '@supabase/supabase-js';
import 'expo-sqlite/localStorage/install'; // gives us a localStorage polyfill in RN
import 'react-native-url-polyfill/auto';

export const SUPABASE_URL = 'https://yasmlwkbexfsvxmgwmgn.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlhc21sd2tiZXhmc3Z4bWd3bWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NDAwOTEsImV4cCI6MjA3ODExNjA5MX0.nV_DD_ntjyyCChBSYnA2ySXEy0kEjYrIrszBRtZ1cac';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
