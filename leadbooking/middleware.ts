import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Geschützte Routen
  const isProtected = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/setter') ||
    pathname.startsWith('/admin')

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Rollen-basierter Schutz
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Setter-Bereich nur für Setter + Admin
    if (pathname.startsWith('/setter') && profile.role === 'advisor') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Admin-Bereich nur für Admin
    if (pathname.startsWith('/admin') && profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Setter-Dashboard
    if (pathname.startsWith('/dashboard') && profile.role === 'setter') {
      return NextResponse.redirect(new URL('/setter', request.url))
    }

    // Inaktive Setter blockieren
    if (profile.role === 'setter' && !profile.is_active) {
      return NextResponse.redirect(new URL('/login?error=inactive', request.url))
    }
  }

  // Eingeloggte Nutzer von Auth-Seiten weglenken
  if (user && (pathname === '/login' || pathname === '/registrieren')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') return NextResponse.redirect(new URL('/admin', request.url))
    if (profile?.role === 'setter') return NextResponse.redirect(new URL('/setter', request.url))
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
