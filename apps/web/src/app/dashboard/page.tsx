import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const metadata = {
  title: 'Dashboard — LiveInfra',
  description: 'Real-time AWS infrastructure dependency graph',
}

export default async function DashboardPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  // Pass Clerk user ID to the client so it can resolve the customer UUID.
  // The "demo" customerId is kept as a fallback for existing seeded Neo4j data.
  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress

  return (
    <DashboardClient
      clerkUserId={userId}
      email={email}
      // Demo seed account — override via NEXT_PUBLIC_DEMO_ACCOUNT_ID in production
      defaultAccountId={process.env['NEXT_PUBLIC_DEMO_ACCOUNT_ID'] ?? '975050024946'}
    />
  )
}
