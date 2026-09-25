# Login privado — Efímero Content Engine

## 1. Crear tu usuario
En Supabase: Authentication → Users → Add user → Create new user.
Crea únicamente la cuenta que usarás para entrar a Efímero.

## 2. Desactivar registros públicos
En Supabase: Authentication → Providers → Email.
Desactiva la opción que permita nuevos registros/sign ups públicos.
La app tampoco muestra un botón de registro.

## 3. Variables locales
En `.env.local` agrega:

```env
AUTH_ALLOWED_EMAILS=tu-correo@dominio.com
```

Puedes autorizar más de un correo separándolos por coma.
No uses `NEXT_PUBLIC_` en esta variable.

## 4. Activar RLS
Ejecuta `supabase/schema.sql` nuevamente en SQL Editor.
La migración habilita Row Level Security en las tablas de Efímero y solo permite operaciones al rol `authenticated`.

## 5. Reiniciar Next.js
```bash
npm run dev
```
Abre `http://localhost:3000`. Sin sesión te enviará a `/login`.

## Seguridad implementada
- No hay registro público en la interfaz.
- Allowlist de correos en servidor.
- Cookie HttpOnly para proteger páginas y endpoints `/api/*`.
- El token se valida contra Supabase Auth en middleware.
- La cookie se sincroniza cuando Supabase renueva la sesión.
- RLS bloquea el acceso anónimo directo a la base.
- Cerrar sesión elimina la sesión de Supabase y la cookie del servidor.
