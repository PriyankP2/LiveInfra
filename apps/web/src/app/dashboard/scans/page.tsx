import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import ScansClient from './ScansClient'

export const metadata = {
  title: 'Scan History — LiveInfra',
  description: 'Timeline of automated AWS infrastructure discovery runs',
}

export default async function ScansPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return <ScansClient customerId="demo" />
}
