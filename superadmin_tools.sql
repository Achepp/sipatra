-- Postgres helper functions for Superadmin operations.
-- Execute this script in the Supabase Dashboard SQL Editor (https://supabase.com)

-- 1. Function to reset user password to the default ('sisteminformasi')
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges to allow auth.users updates
AS $$
BEGIN
  -- Security check: Only allow users with the 'superadmin' role in public.profiles to run this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only superadmins can reset passwords.';
  END IF;

  -- Update target user's password and reset password_changed metadata flag
  UPDATE auth.users
  SET encrypted_password = crypt('sisteminformasi', gen_salt('bf')),
      raw_user_meta_data = raw_user_meta_data || '{"password_changed": false}'::jsonb
  WHERE id = target_user_id;
END;
$$;

-- 2. Function to delete user record from auth.users
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges to allow auth.users deletion
AS $$
BEGIN
  -- Security check: Only allow users with the 'superadmin' role in public.profiles to run this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only superadmins can delete user accounts.';
  END IF;

  -- Delete from auth.users (Cascade delete automatically clears public.profiles and public.members)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
