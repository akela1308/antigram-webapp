drop policy if exists "Moments files can be deleted from own folder or by admin" on storage.objects;

create policy "Moments files can be deleted from own folder or by admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'moments'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin_user(auth.uid())
    )
  );
