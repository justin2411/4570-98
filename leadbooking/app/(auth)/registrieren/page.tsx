export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { RegisterForm } from './register-form'

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] to-[#2E75B6]" />}>
      <RegisterForm />
    </Suspense>
  )
}
