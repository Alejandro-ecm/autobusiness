-- Actualiza las contraseñas de los usuarios demo con hash bcrypt correcto para "demo123"
UPDATE users
SET password_hash = '$2b$10$0HQlrTKVC8ITU6aVE1mlQO40P6kB3HMsgvZMaItaxonJrnqgc4doy'
WHERE email IN ('dueno@demo.com', 'cajero@demo.com');
