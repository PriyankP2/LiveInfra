# AWS Scanner Design

## Primary Data Source: AWS Config

AWS Config `SelectAggregateResourceConfig` is the primary inventory mechanism. It returns all resources across all regions in a single API call, bypassing per-resource, per-region API calls.

```typescript
const resources = await config.selectAggregateResourceConfig({
  ConfigurationAggregatorName: 'liveinfra-aggregator',
  Expression: `
    SELECT
      resourceId, resourceType, resourceName, awsRegion, 
      accountId, arn, tags, configuration, supplementaryConfiguration,
      availabilityZone, resourceCreationTime
    WHERE resourceType IN (
      'AWS::EC2::Instance',
      'AWS::RDS::DBInstance',
      'AWS::Lambda::Function',
      'AWS::ElasticLoadBalancingV2::LoadBalancer',
      'AWS::SQS::Queue',
      'AWS::S3::Bucket',
      'AWS::EC2::VPC',
      'AWS::EC2::Subnet',
      'AWS::EC2::SecurityGroup',
      'AWS::ECS::Service',
      'AWS::ElastiCache::CacheCluster',
      'AWS::SNS::Topic',
      'AWS::Events::Rule',
      'AWS::StepFunctions::StateMachine',
      'AWS::ApiGateway::RestApi',
      'AWS::CloudFront::Distribution'
    )
  `
})
```

**Why Config over direct API calls**:
- Single call vs. 16 separate Describe* API calls × N regions
- AWS Config handles eventual consistency — no need to poll until resources appear
- Avoids per-service rate limits (EC2 DescribeInstances is 5 req/sec, Config aggregator has higher limits)
- Config includes `configuration` blob with relationship hints (security group IDs, subnet IDs, VPC IDs)

---

## Supplemental SDK Calls

AWS Config doesn't model all relationships. These require targeted SDK calls after the Config scan:

### Lambda Event Source Mappings
```typescript
// Config doesn't expose event source mapping targets
const mappings = await lambda.listEventSourceMappings({
  FunctionName: functionArn
})
// Creates DEPENDS_ON edges: Lambda → SQS/SNS/DynamoDB/Kinesis
```

### EventBridge Rule Targets
```typescript
// Config has EventBridge rules but not their targets
const targets = await events.listTargetsByRule({
  Rule: ruleName,
  EventBusName: eventBusArn
})
// Creates DEPENDS_ON edges: EventBridge → Lambda/SQS/ECS
```

### Step Functions Task ARNs
```typescript
// Config has state machine ARN but not task resource ARNs inside the definition
const sm = await stepfunctions.describeStateMachine({ stateMachineArn })
const definition = JSON.parse(sm.definition)
// Parse states, extract Resource ARNs, create DEPENDS_ON edges
```

### API Gateway VPC Links
```typescript
// Config doesn't expose VPC Link targets
const vpcLinks = await apigateway.getVpcLinks({})
// Creates DEPLOYED_IN edges: APIGateway VPC Link → NLB
```

### RDS Proxy Target Groups
```typescript
// Config doesn't expose RDS Proxy → RDS relationships
const proxies = await rds.describeDBProxies({})
const targets = await rds.describeDBProxyTargets({ DBProxyName: proxy.DBProxyName })
// Creates DEPENDS_ON edges: Lambda/EC2 → RDS Proxy → RDS
```

---

## VPC Flow Log Parser

Flow logs provide actual traffic data to weight blast radius scores.

**ENI → Resource ID Cache** (Upstash Redis, 5-min TTL):
```typescript
// ENI IDs in flow logs must be mapped to resource IDs
// Container IPs churn every few minutes in ECS/EKS
const eniCache = new Map<string, { resourceId: string, resourceType: string }>()

// Refresh every 5 minutes via BullMQ job
const enis = await ec2.describeNetworkInterfaces({
  Filters: [{ Name: 'status', Values: ['in-use'] }]
})
enis.NetworkInterfaces.forEach(eni => {
  const resourceId = extractResourceId(eni)  // EC2, ECS task, Lambda, RDS
  eniCache.set(eni.NetworkInterfaceId, { resourceId, resourceType: eni.InterfaceType })
})
```

**Flow Log Processing** (S3 + Athena or direct S3 read):
```typescript
// VPC Flow Log record fields relevant to LiveInfra
interface FlowLogRecord {
  srcaddr: string     // Source IP
  dstaddr: string     // Destination IP
  srcport: number
  dstport: number
  action: 'ACCEPT' | 'REJECT'
  bytes: number
  packets: number
  start: number       // Unix timestamp
  end: number
  'interface-id': string  // ENI ID → lookup in cache
  'flow-direction': 'ingress' | 'egress'
}
```

**Anomaly Detection** (stored in Upstash Redis):
- REJECT spike: >2× baseline reject rate in a 5-minute window
- Connection collapse: ACCEPT count drops to 0 for >2 minutes (was non-zero previously)
- Traffic surge: >3× baseline bytes transferred in a 5-minute window
- New source IP: IP not seen in previous 24 hours (potential security event)

**Known Limitations**:
- 1–15 minute delay from AWS (Flow Logs are not real-time)
- Cannot distinguish Security Group REJECT from NACL REJECT (both appear as REJECT in flow logs)
- Container IPs churn constantly — ENI cache must refresh every 5 minutes or attribution breaks
- IPv6 flow logs require separate configuration in customer's VPC

---

## IAM Role Architecture

### Per-Customer Role

Each customer creates one IAM role per AWS account with this trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::LIVEINFRA_ACCOUNT_ID:role/liveinfra-scanner"
    },
    "Action": "sts:AssumeRole",
    "Condition": {
      "StringEquals": {
        "sts:ExternalId": "CUSTOMER_SPECIFIC_EXTERNAL_ID"
      }
    }
  }]
}
```

**ExternalId**: Unique random UUID per customer, generated at onboarding. Prevents confused deputy attacks (a third party can't trick LiveInfra into scanning their account by knowing only the account ID).

**Permission policy** (attached to the customer role):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "config:SelectAggregateResourceConfig",
        "config:DescribeConfigurationAggregators",
        "ec2:Describe*",
        "rds:Describe*",
        "lambda:List*",
        "lambda:GetFunction",
        "elasticloadbalancing:Describe*",
        "ecs:Describe*",
        "ecs:List*",
        "elasticache:Describe*",
        "sqs:GetQueueAttributes",
        "sqs:ListQueues",
        "sns:ListTopics",
        "sns:GetTopicAttributes",
        "events:List*",
        "events:Describe*",
        "states:List*",
        "states:Describe*",
        "apigateway:GET",
        "cloudfront:List*",
        "cloudfront:GetDistribution",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "s3:GetBucketPolicy",
        "cloudtrail:LookupEvents",
        "cloudtrail:GetTrailStatus",
        "logs:FilterLogEvents",
        "logs:DescribeLogGroups"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Deny",
      "Action": [
        "*:Put*",
        "*:Create*",
        "*:Delete*",
        "*:Update*",
        "*:Modify*",
        "*:Terminate*",
        "*:Stop*",
        "*:Start*",
        "iam:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### Multi-Account Strategy

**Option 1: Organization master role** (preferred for customers with AWS Organizations)
- Customer creates role in master account with permission to assume roles in all member accounts
- LiveInfra does one role assumption to master, then chains to each member account
- AWS limit: max 1 additional hop in role chain from the assumed role — LiveInfra scanner role → master account role → member account role (2 hops = at limit)

**Option 2: Role per account** (for customers without Organizations)
- Customer creates the same role template in each account
- LiveInfra stores all role ARNs per customer, assumes each directly
- No role chain limit issues
- More management overhead for customer at >10 accounts

### STS Token Refresh

AWS STS tokens expire after 1–12 hours. BullMQ worker refreshes tokens:
```typescript
// Refresh token 5 minutes before expiry
const shouldRefresh = (credentials: STSCredentials): boolean => {
  const expiresAt = new Date(credentials.Expiration).getTime()
  const now = Date.now()
  return expiresAt - now < 5 * 60 * 1000  // 5 minutes
}
```

---

## Rate Limit Management

AWS API rate limits are a significant constraint at scale.

| API | Rate Limit | Strategy |
|---|---|---|
| CloudTrail LookupEvents | 2 req/sec | Token bucket in Upstash Redis; queue CloudTrail calls |
| EC2 DescribeInstances | 5 req/sec | Config aggregator eliminates most direct calls |
| Config SelectAggregateResourceConfig | 5 req/sec | One call per full scan |
| Lambda ListFunctions | 10 req/sec | Paginated, sequential |
| RDS DescribeDBInstances | 5 req/sec | Config aggregator eliminates most direct calls |

**Token bucket implementation** (Upstash Redis):
```typescript
const TOKEN_BUCKET_KEY = `rate_limit:${customerId}:cloudtrail`
const allowed = await redis.set(TOKEN_BUCKET_KEY, 
  { command: 'SET', args: [TOKEN_BUCKET_KEY, 2, 'EX', 1, 'NX'] }
)
if (!allowed) await sleep(500)  // Back off 500ms
```

**Exponential backoff** on ThrottlingException:
```typescript
const MAX_RETRIES = 5
for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
  try {
    return await apiCall()
  } catch (e) {
    if (e.name !== 'ThrottlingException') throw e
    await sleep(Math.min(1000 * Math.pow(2, attempt), 30000))
  }
}
```

---

## Scanner Job Types (BullMQ)

| Job | Trigger | Interval | Priority |
|---|---|---|---|
| `full-scan` | Cron | Every 15 min | Low |
| `event-scan` | EventBridge webhook | On-demand | High |
| `flow-log-parse` | Cron | Every 5 min | Medium |
| `eni-cache-refresh` | Cron | Every 5 min | Medium |
| `snapshot-write` | After full-scan | After each scan | Low |
| `pruning` | Cron | Nightly | Very Low |
| `rca-trigger` | Alert webhook | On-demand | Critical |

**Worker concurrency**: 5 workers in MVP, scaling to 50 in Phase 3 as customer count grows.

**Job timeout**: 10 minutes for full-scan, 30 seconds for event-scan, 2 minutes for flow-log-parse.
