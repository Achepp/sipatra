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

  -- Step 1: Delete related rows in public.members (no CASCADE FK to auth.users exists)
  DELETE FROM public.members WHERE user_id = target_user_id;

  -- Step 2: Delete the profile row in public.profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Step 3: Delete from auth.users (the source of truth for authentication)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- 3. Function to programmatically check and create the avatar_url column in profiles
CREATE OR REPLACE FUNCTION public.check_and_create_avatar_url_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges to allow table alteration
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;
END;
$$;
