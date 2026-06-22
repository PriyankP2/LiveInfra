import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import AccountsClient from './AccountsClient'

export const metadata = {
  title: 'AWS Accounts — LiveInfra',
  description: 'Manage connected AWS accounts and scan configurations',
}

export default async function AccountsPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return <AccountsClient customerId="demo" />
}
