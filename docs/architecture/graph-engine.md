# Graph Engine & Neo4j Schema

See also: [diagrams/graph-schema.svg](../diagrams/graph-schema.svg)

## Node Types

All nodes carry the `:Resource` label plus a specific type label.

| Node Label | AWS Resource | Key Properties |
|---|---|---|
| `:EC2` | EC2 Instance | instance_id, instance_type, state, az, private_ip, public_ip, vpc_id |
| `:RDS` | RDS Instance / Cluster | db_instance_id, engine, engine_version, instance_class, multi_az, storage_gb |
| `:Lambda` | Lambda Function | function_name, runtime, memory_mb, timeout_sec, vpc_config |
| `:ALB` | Application Load Balancer | lb_arn, scheme, vpc_id, az_list |
| `:NLB` | Network Load Balancer | lb_arn, scheme, vpc_id, az_list |
| `:SQS` | SQS Queue | queue_url, queue_type, visibility_timeout, dlq_arn |
| `:S3Bucket` | S3 Bucket | bucket_name, region, versioning, public_access_block |
| `:VPC` | VPC | vpc_id, cidr_block, is_default |
| `:Subnet` | Subnet | subnet_id, vpc_id, az, cidr_block, public |
| `:SecurityGroup` | Security Group | sg_id, vpc_id, name, inbound_rules_count |
| `:ECS` | ECS Service / Task | service_arn, cluster_arn, task_definition_arn, desired_count |
| `:ElastiCache` | ElastiCache Cluster | cluster_id, engine, node_type, num_nodes |
| `:SNS` | SNS Topic | topic_arn, subscriptions_count |
| `:EventBridge` | EventBridge Rule | rule_arn, event_bus, state, target_count |
| `:StepFunctions` | Step Functions State Machine | sm_arn, type (EXPRESS/STANDARD) |
| `:APIGateway` | API Gateway REST/HTTP API | api_id, protocol_type, endpoint_type |
| `:CloudFront` | CloudFront Distribution | distribution_id, status, origin_count |

### Common Node Properties (all nodes)
```
id: String (ARN or unique resource identifier)
account_id: String
region: String
name: String (human-readable display name)
customer_id: String (multi-tenancy isolation key)
last_seen: DateTime
tags: Map<String, String>
```

---

## Edge Types

### `:DEPENDS_ON` (primary dependency edge)

Direction: `(A)-[:DEPENDS_ON]->(B)` means "A depends on B" — if B fails, A is affected.

| Source → Target | Meaning |
|---|---|
| `:Lambda` → `:RDS` | Lambda connects to RDS (VPC + credentials) |
| `:EC2` → `:RDS` | EC2 application connects to RDS |
| `:Lambda` → `:SQS` | Lambda is triggered by SQS (event source mapping) |
| `:Lambda` → `:SNS` | Lambda subscribes to SNS |
| `:ECS` → `:RDS` | ECS service container connects to RDS |
| `:ALB` → `:EC2` | ALB routes to EC2 target group |
| `:ALB` → `:ECS` | ALB routes to ECS service |
| `:CloudFront` → `:ALB` | CloudFront origin points to ALB |
| `:APIGateway` → `:Lambda` | API Gateway invokes Lambda |
| `:EventBridge` → `:Lambda` | EventBridge rule targets Lambda |
| `:StepFunctions` → `:Lambda` | Step Functions state invokes Lambda |
| `:Lambda` → `:S3Bucket` | Lambda reads/writes S3 |
| `:Lambda` → `:ElastiCache` | Lambda connects to ElastiCache |

Properties:
```
edge_type: String (describes the dependency mechanism: "event_source_mapping", "target_group", "vpc_connection", etc.)
traffic_volume: Float (estimated requests/sec from VPC Flow Logs, 0.0 if no flow data)
last_flow_log: DateTime (timestamp of most recent flow log observation)
created_at: DateTime
```

### `:MEMBER_OF` (Security Group membership)

Direction: `(resource)-[:MEMBER_OF]->(sg)` — resource is a member of Security Group.

Properties:
```
since: DateTime
rule_count: Integer
```

### `:PART_OF` (VPC/Subnet placement)

Direction: `(resource)-[:PART_OF]->(vpc|subnet)` — resource runs in this VPC or subnet.

Properties:
```
az: String
subnet_cidr: String (if PART_OF subnet)
```

### `:DEPLOYED_IN` (AZ placement)

Direction: `(resource)-[:DEPLOYED_IN]->(subnet)` — specific subnet placement.

Properties:
```
subnet_id: String
az: String
private_ip: String
```

---

## Blast Radius Query

Variable-length Cypher traversal from any failing node:

```cypher
MATCH (source:Resource {id: $resource_id, customer_id: $customer_id})
MATCH path = (source)<-[:DEPENDS_ON*1..10]-(downstream:Resource)
WHERE downstream.customer_id = $customer_id
RETURN 
  downstream,
  length(path) AS hops,
  relationships(path) AS edges
ORDER BY hops ASC
```

### Severity Scoring

```
score = clamp(
  (1.0 / hop_count) × resource_type_multiplier × traffic_volume_multiplier,
  0.0,
  1.0
)
```

**Resource Type Multipliers**:
| Type | Multiplier | Reason |
|---|---|---|
| RDS | 3.0 | Database failures cascade to all application tiers |
| ALB | 2.5 | Load balancer failure kills all downstream targets |
| EC2 | 2.0 | Application server failure affects all users |
| ElastiCache | 2.0 | Cache failure increases DB load 10×+ |
| Lambda | 1.5 | Serverless, usually isolated but can cascade |
| SQS | 1.2 | Queue backup causes eventual failure |
| SNS | 1.2 | Fan-out amplification of failures |
| S3 | 0.8 | Usually resilient, failure is rarely total |
| CloudFront | 0.8 | CDN has built-in failover |

**Traffic Volume Multiplier**:
```
if traffic_volume > 1000 req/sec: multiplier = 1.5
if traffic_volume > 100 req/sec:  multiplier = 1.2
if traffic_volume > 10 req/sec:   multiplier = 1.0
if traffic_volume == 0 (unknown): multiplier = 1.0
if traffic_volume < 10 req/sec:   multiplier = 0.8
```

**Severity Labels** (for UI):
- 0.8–1.0: Critical (red pulse)
- 0.5–0.79: Degraded (amber)
- 0.2–0.49: At Risk (yellow)
- 0.0–0.19: Monitoring (blue)

---

## Write Rules (Immutable)

1. **MERGE, never CREATE** — `MERGE (n:Resource {id: $id, customer_id: $cid}) SET n += $props`
2. **Current state only** — no timestamp properties on nodes, no `:VERSION_OF` relationships
3. **Temporal versioning is BANNED** — this is a hard architectural constraint, not a preference
4. **Pruning job** — any node with `last_seen` older than 48 hours is flagged as stale; deleted after 7 days
5. **Customer isolation** — every node has `customer_id`; every query filters by `customer_id` in WHERE clause
6. **Edge freshness** — DEPENDS_ON edges carry `created_at`; edges not observed in 2 consecutive scans are deleted

---

## Performance Characteristics

| Query | Typical Latency | Notes |
|---|---|---|
| Full blast radius (10 hops) | <100ms | Indexed on `id` + `customer_id` |
| Node lookup by ARN | <10ms | Unique constraint on `id` + `customer_id` |
| 3-hop RCA context | <50ms | Used in AI RCA pipeline |
| Full topology export | <5 sec | Used for frontend initial load |
| Pruning job | <30 sec | Runs nightly |

---

## Neo4j Indexes

```cypher
CREATE CONSTRAINT resource_unique ON (r:Resource) ASSERT (r.id, r.customer_id) IS NODE KEY;
CREATE INDEX resource_by_customer ON :Resource(customer_id);
CREATE INDEX resource_by_region ON :Resource(region, customer_id);
CREATE INDEX resource_by_type ON :Resource(customer_id, last_seen);
```
