# LiveInfra AWS Account Onboarding

LiveInfra connects to your AWS account via a **cross-account IAM role**. No agents are installed, no VPC changes are required, and no inbound network access is opened. LiveInfra assumes the role from its own AWS account and performs read-only API calls.

---

## What LiveInfra accesses

| Service | Actions |
|---------|---------|
| EC2 | DescribeInstances, DescribeVpcs, DescribeSubnets, DescribeSecurityGroups, DescribeNetworkInterfaces, DescribeRouteTables, DescribeInternetGateways, DescribeNatGateways |
| RDS | DescribeDBInstances, DescribeDBClusters, DescribeDBSubnetGroups |
| Lambda | ListFunctions, GetFunctionConfiguration |
| ELB v2 | DescribeLoadBalancers, DescribeTargetGroups, DescribeTargetHealth, DescribeListeners |
| ECS | ListClusters, DescribeClusters, ListServices, DescribeServices, ListTasks, DescribeTasks |
| CloudWatch | GetMetricStatistics, ListMetrics |
| CloudTrail | LookupEvents |

All actions are List/Describe/Get only. LiveInfra cannot create, modify, or delete any resource.

---

## Option A — CloudFormation (recommended)

Takes about 3 minutes. CloudFormation creates the role with the exact trust policy and permissions required.

**Step 1.** Copy your **ExternalId** from the LiveInfra dashboard:
- Dashboard > Settings > Add Account > copy the External ID shown

**Step 2.** Deploy the CloudFormation template:
- AWS Console > CloudFormation > Create Stack > With new resources
- Choose "Upload a template file" and upload [`cloudformation-role.yaml`](./cloudformation-role.yaml)
- Fill in the parameters:
  - `LiveInfraAccountId`: provided by LiveInfra on the Add Account page
  - `ExternalId`: the value you copied in Step 1
  - `RoleName`: leave as `LiveInfraScanner` unless you have a naming convention

**Step 3.** After the stack reaches `CREATE_COMPLETE`, go to the **Outputs** tab and copy the `RoleArn` value.

**Step 4.** In the LiveInfra dashboard:
- Dashboard > Settings > Add Account > paste the Role ARN > Save

LiveInfra will immediately attempt a test AssumeRole to validate the configuration.

---

## Option B — Manual IAM

Use this if your organization does not permit CloudFormation, or if you manage IAM via Terraform/CDK.

**Step 1.** Create an IAM role named `LiveInfraScanner` (or any name you prefer).

**Step 2.** Set the trust policy to the following. Replace `{LIVEINFRA_ACCOUNT_ID}` and `{YOUR_EXTERNAL_ID}` with the values from the LiveInfra dashboard:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowLiveInfraAssumeRole",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::{LIVEINFRA_ACCOUNT_ID}:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "{YOUR_EXTERNAL_ID}"
        }
      }
    }
  ]
}
```

**Step 3.** Create an inline policy on the role using the contents of [`iam-policy.json`](./iam-policy.json).

**Step 4.** Copy the Role ARN and paste it into the LiveInfra dashboard under Settings > Add Account.

---

## Security notes

**ExternalId prevents confused deputy attacks.**
Without an ExternalId condition, any party that knows your Role ARN could potentially trick a trusted service into assuming your role. The ExternalId is a secret shared only between you and LiveInfra — it is validated on every AssumeRole call.

**Read-only by design.**
The policy contains only List, Describe, and Get actions. There are no `*` wildcards on actions, no write permissions, and no `iam:*` permissions. LiveInfra cannot make any change to your infrastructure.

**Revocation.**
To immediately revoke LiveInfra's access, delete the CloudFormation stack or delete the IAM role. LiveInfra's credentials for your account become invalid within seconds.

**Principle of least privilege.**
The policy is scoped to the specific API calls required for graph construction. We do not request `ReadOnlyAccess` (the AWS managed policy) because that grants significantly broader permissions than needed.

---

## Troubleshooting

**`AccessDenied` on AssumeRole**

- Confirm the `LiveInfraAccountId` in the trust policy matches what the dashboard shows exactly (12 digits, no dashes).
- Confirm the `ExternalId` in the trust policy matches what the dashboard shows exactly (case-sensitive).
- If you renamed the role, verify the Role ARN you pasted into the dashboard matches the actual ARN in IAM.

**`InvalidClientTokenId` or credential errors**

- This is a LiveInfra-side issue. Contact support — your role configuration is not the cause.

**CloudFormation stack fails with `ROLLBACK_COMPLETE`**

- Check the Events tab for the specific resource failure. Common causes: `RoleName` already exists in the account, or the `LiveInfraAccountId` parameter failed the 12-digit validation.
- Delete the failed stack before retrying.

**`DescribeInstances` returns empty results**

- The role was created successfully but your account has no resources in the scanned region. LiveInfra scans the regions you configure in the dashboard. Add additional regions under Settings > Account > Regions.

**Permission errors on specific services (e.g., ECS)**

- If your organization uses SCPs (Service Control Policies), an SCP may be blocking specific API calls even though the role policy allows them. Check with your AWS Organizations administrator to confirm the APIs in `iam-policy.json` are not denied at the organization level.
