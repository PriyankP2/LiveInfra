import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  return (
    <OnboardingClient
      clerkUserId={user.id}
      email={user.emailAddresses[0]?.emailAddress}
    />
  )
}
