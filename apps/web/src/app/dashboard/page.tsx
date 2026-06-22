import { auth } from '@clerk/nextjs/server'
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

  return <DashboardClient customerId="demo" accountId="975050024946" />
}
