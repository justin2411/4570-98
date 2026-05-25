import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage = path.startsWith('/login') || path.startsWith('/passwort-reset')
  const isPublicAsset = path === '/' || path.startsWith('/_next') || path === '/manifest.json' || path === '/sw.js' || path === '/favicon.ico' || path.startsWith('/icons') || path.startsWith('/api/auth')
  const isProtected = path.startsWith('/admin') || path.startsWith('/setter') || path.startsWith('/advisor') || path.startsWith('/dashboard-redirect')

  // Nicht eingeloggt + geschützte Route → /login
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Eingeloggt + geschützte Route → is_active prüfen
  if (user && isProtected && !isAuthPage && !isPublicAsset) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active, role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.is_active === false) {
      // Account deaktiviert → ausloggen + zur Login-Seite
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('error', 'deactivated')
      return NextResponse.redirect(url)
    }
  }

  // Eingeloggt + auf /login → zum passenden Dashboard
  if (user && isAuthPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile) {
      const url = request.nextUrl.clone()
      url.pathname = profile.role === 'admin' ? '/admin' : profile.role === 'advisor' ? '/advisor' : '/setter'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf)$).*)',
  ],
}
