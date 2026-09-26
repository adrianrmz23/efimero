# Meta OAuth · Efímero Content Engine

Esta versión elimina la dependencia normal de Graph API Explorer. El flujo es:

1. Usuario privado de Efímero inicia sesión.
2. `GET /api/auth/meta/start` abre el login oficial de Facebook.
3. Meta redirige a `/api/auth/meta/callback` con un `code`.
4. El servidor intercambia el código por un token de usuario y lo amplía a larga duración.
5. El servidor consulta `/me/accounts` y guarda cada Page Access Token cifrado.
6. Los módulos de Efímero leen el Page Token únicamente en el servidor.

## 1. Supabase

Ejecuta `supabase/schema.sql` nuevamente. Crea dos tablas privadas:

- `efimero_meta_connections`
- `efimero_meta_pages`

Ambas tienen RLS activo y **no** tienen políticas para el cliente. Sólo las rutas server-side acceden mediante una clave privilegiada de Supabase.

En Supabase > Project Settings > API Keys copia la clave `service_role` / clave secreta de servidor y guárdala en Vercel como:

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

Nunca uses `NEXT_PUBLIC_` para esta clave.

## 2. Clave de cifrado

En tu terminal local ejecuta:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia el resultado completo y guárdalo como:

```env
META_TOKEN_ENCRYPTION_KEY=...
```

No cambies esta clave después de conectar Facebook. Si la pierdes o la cambias, tendrás que reconectar Facebook para volver a guardar los tokens.

## 3. Vercel

Agrega estas variables de producción:

```env
META_APP_ID=...
META_APP_SECRET=...
META_GRAPH_VERSION=v26.0
META_OAUTH_REDIRECT_URI=https://efimero-wheat.vercel.app/api/auth/meta/callback
META_TOKEN_ENCRYPTION_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Conserva también tus variables actuales de Supabase, OpenAI, Auth y Compliance.

`META_USER_ACCESS_TOKEN` deja de ser necesario una vez que el OAuth funcione. Puedes mantenerlo durante la primera prueba como fallback y borrarlo después.

## 4. Meta Developers

En tu app **Efimero Content Engine**, abre `Inicio de sesión con Facebook` y agrega exactamente esta URL entre los **Valid OAuth Redirect URIs**:

```text
https://efimero-wheat.vercel.app/api/auth/meta/callback
```

No agregues slash final si la variable tampoco lo tiene.

Los permisos que esta versión solicita son:

- `business_management`
- `pages_show_list`
- `pages_read_engagement`
- `pages_read_user_content`
- `pages_manage_posts`
- `pages_manage_engagement`
- `pages_manage_metadata`
- `read_insights`

## 5. Primera prueba

1. Haz deploy.
2. Entra a `https://efimero-wheat.vercel.app/` y autentícate con tu login privado.
3. Abre **Facebook > Meta** en el sidebar.
4. Pulsa **Conectar con Facebook**.
5. Autoriza las páginas.
6. Meta regresará automáticamente a Efímero > Meta.
7. Comprueba que aparecen todas tus páginas.
8. Elige una página: queda almacenada como página activa.
9. Pulsa **Actualizar páginas** cuando quieras refrescar la lista.

## 6. Seguridad

- `META_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `META_TOKEN_ENCRYPTION_KEY` y los tokens nunca deben ser `NEXT_PUBLIC_*`.
- Los Page Access Tokens se cifran con AES-256-GCM antes de guardarse.
- El navegador nunca recibe los tokens.
- Las APIs de Meta siguen protegidas por el login privado de Efímero.
- Si Meta invalida la sesión, la interfaz mostrará **Reconexión necesaria** y podrás repetir el login desde la propia plataforma.
