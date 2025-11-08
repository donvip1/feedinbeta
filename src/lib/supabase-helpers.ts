import { supabase } from '@/integrations/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

export class SupabaseError extends Error {
  code?: string;
  details?: string;

  constructor(message: string, error?: PostgrestError) {
    super(message);
    this.name = 'SupabaseError';
    this.code = error?.code;
    this.details = error?.details;
  }
}

export const handleSupabaseError = (error: PostgrestError | null, context: string): void => {
  if (!error) return;

  console.error(`Supabase error in ${context}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
  });

  throw new SupabaseError(`${context}: ${error.message}`, error);
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  throw lastError!;
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    handleSupabaseError(error as any, 'getCurrentUser');
  }
  return user;
};

export const isUserAuthenticated = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch {
    return false;
  }
};
