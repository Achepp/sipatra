-- Postgres function to clean up all member accounts, profiles and transaction data
-- Run this script in the Supabase Dashboard SQL Editor (https://supabase.com)

CREATE OR REPLACE FUNCTION public.cleanup_member_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges to allow auth.users deletion
AS $$
BEGIN
  -- 1. Security check: Only allow users with the 'admin' role in public.members to run this
  IF NOT EXISTS (
    SELECT 1 FROM public.members 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can clean up member accounts.';
  END IF;

  -- 2. Clear all transactional data (sessions, attendees, expenses, payments)
  DELETE FROM public.payments;
  DELETE FROM public.session_attendees;
  DELETE FROM public.session_expenses;
  DELETE FROM public.sessions;

  -- 3. Delete member authentication accounts from auth.users
  -- (Cascade delete will automatically clean public.profiles and public.members if foreign keys match)
  DELETE FROM auth.users 
  WHERE id IN (
    SELECT user_id 
    FROM public.members 
    WHERE role = 'member' AND user_id IS NOT NULL
  );

  -- 4. Delete any remaining orphaned profiles
  DELETE FROM public.profiles
  WHERE id NOT IN (
    SELECT user_id 
    FROM public.members 
    WHERE role = 'admin' AND user_id IS NOT NULL
  );

  -- 5. Delete member listings from public.members
  DELETE FROM public.members
  WHERE role = 'member';
END;
$$;
