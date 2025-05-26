import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://knsrojdccxhmifyrddqu.supabase.co';
// It's best practice to use environment variables for keys,
// but for this task, we'll use the provided key directly.
// Make sure this key is for client-side (anon) use and has appropriate RLS policies.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtuc3JvamRjY3hobWlmeXJkZHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNzMyMjYsImV4cCI6MjA2Mzg0OTIyNn0.N6NInwkoFnaTyzz1doYf0TH4JuokZ5TI8b2BSxBHR2c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
