import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Public routes
  if (pathname === '/rangliste' || pathname.startsWith('/rangliste')) return response
  if (pathname === '/login' || pathname === '/passwort-reset') {
    if (user) return NextResponse.redirect(new URL('/dashboard-redirect', request.url))
    return response
  }

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()

  if (!profile) return NextResponse.redirect(new URL('/login', request.url))

  // Role-based routing
  if (pathname.startsWith('/admin') && profile.role !== 'admin') {
    return NextResponse.redirect(new URL(profile.role === 'setter' ? '/setter' : '/advisor', request.url))
  }
  if (pathname.startsWith('/setter') && profile.role !== 'setter') {
    return NextResponse.redirect(new URL(profile.role === 'admin' ? '/admin' : '/advisor', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
