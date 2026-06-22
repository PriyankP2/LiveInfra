import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AlertsClient from './AlertsClient'

export const metadata = { title: 'Alerts — LiveInfra' }

export default async function AlertsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  return <AlertsClient customerId="demo" />
}
