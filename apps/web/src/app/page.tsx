import Link from 'next/link'

// No request-time data — statically render at build time for best CDN performance
export const dynamic = 'force-static'

// ─── Sub-components (all server-safe, no interactivity) ──────────────────────

function NavBar() {
  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        background: 'rgba(5,7,10,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #162030',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="4" fill="#00c4b4" />
          <circle cx="4" cy="4" r="2.5" fill="#00c4b4" opacity="0.7" />
          <circle cx="24" cy="4" r="2.5" fill="#00c4b4" opacity="0.7" />
          <circle cx="4" cy="24" r="2.5" fill="#00c4b4" opacity="0.7" />
          <circle cx="24" cy="24" r="2.5" fill="#00c4b4" opacity="0.7" />
          <line x1="6" y1="5" x2="10.5" y2="10.5" stroke="#00c4b4" strokeWidth="1.5" opacity="0.5" />
          <line x1="22" y1="5" x2="17.5" y2="10.5" stroke="#00c4b4" strokeWidth="1.5" opacity="0.5" />
          <line x1="6" y1="23" x2="10.5" y2="17.5" stroke="#00c4b4" strokeWidth="1.5" opacity="0.5" />
          <line x1="22" y1="23" x2="17.5" y2="17.5" stroke="#00c4b4" strokeWidth="1.5" opacity="0.5" />
        </svg>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: '18px',
            color: '#e2e8f4',
            letterSpacing: '-0.02em',
          }}
        >
          LiveInfra
        </span>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link
          href="/sign-in"
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            color: '#8496b0',
            textDecoration: 'none',
            padding: '6px 12px',
          }}
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            color: '#000',
            background: '#00c4b4',
            padding: '10px 20px',
            borderRadius: '10px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Get started free →
        </Link>
      </div>
    </nav>
  )
}

function HeroGraphMock() {
  const nodes: Array<{ id: string; cx: number; cy: number; color: string; label: string; pulse: boolean; delay: number }> = [
    { id: 'alb',    cx: 420, cy: 60,  color: '#ff7d54', label: 'ALB',    pulse: true,  delay: 0    },
    { id: 'ec2a',   cx: 220, cy: 155, color: '#f9a825', label: 'EC2',    pulse: false, delay: 0.4  },
    { id: 'ec2b',   cx: 620, cy: 155, color: '#f9a825', label: 'EC2',    pulse: true,  delay: 0.8  },
    { id: 'lambda', cx: 420, cy: 175, color: '#c47aff', label: 'Lambda', pulse: false, delay: 1.2  },
    { id: 'rds',    cx: 140, cy: 270, color: '#4d9fff', label: 'RDS',    pulse: false, delay: 1.6  },
    { id: 'cache',  cx: 340, cy: 275, color: '#ff6eb4', label: 'Cache',  pulse: false, delay: 2.0  },
    { id: 'sqs',    cx: 530, cy: 275, color: '#3ecf8e', label: 'SQS',    pulse: true,  delay: 2.4  },
    { id: 's3',     cx: 700, cy: 250, color: '#40c8e0', label: 'S3',     pulse: false, delay: 2.8  },
    { id: 'rds2',   cx: 220, cy: 310, color: '#4d9fff', label: 'RDS',    pulse: false, delay: 3.2  },
    { id: 'step',   cx: 620, cy: 310, color: '#b07aff', label: 'Step',   pulse: false, delay: 3.6  },
  ]

  const edges: Array<[string, string]> = [
    ['alb',    'ec2a'],
    ['alb',    'ec2b'],
    ['alb',    'lambda'],
    ['ec2a',   'rds'],
    ['ec2a',   'cache'],
    ['lambda', 'cache'],
    ['lambda', 'sqs'],
    ['ec2b',   'sqs'],
    ['ec2b',   's3'],
    ['sqs',    'step'],
    ['rds',    'rds2'],
    ['step',   's3'],
  ]

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]))

  // Blast radius highlight set — simulates a selected node + downstream
  const blastIds = new Set(['alb', 'ec2b', 'sqs', 'step', 's3'])

  return (
    <>
      <style>{`
        @keyframes hero-pulse {
          0%, 100% { opacity: 0.15; r: 18; }
          50%        { opacity: 0.4;  r: 26; }
        }
        @keyframes hero-node-appear {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes hero-edge-draw {
          from { stroke-dashoffset: 300; opacity: 0; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes hero-data-flow {
          0%   { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0;  }
        }
        @keyframes hero-glow {
          0%, 100% { filter: drop-shadow(0 0 4px currentColor); }
          50%       { filter: drop-shadow(0 0 10px currentColor); }
        }
        @keyframes live-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      <div
        style={{
          maxWidth: '840px',
          margin: '64px auto 0',
          borderRadius: '16px',
          background: '#0c1018',
          border: '1px solid #2a3d54',
          boxShadow: '0 0 80px rgba(0,196,180,0.12), 0 32px 64px rgba(0,0,0,0.6)',
          padding: '24px',
          height: '380px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Ambient center glow */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 40% at 50% 55%, rgba(0,196,180,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', position: 'relative' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#8496b0', background: '#111929', border: '1px solid #162030', borderRadius: '6px', padding: '3px 8px' }}>
            975050024946
          </span>
          <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#465c78', background: '#111929', border: '1px solid #162030', borderRadius: '6px', padding: '3px 8px' }}>
            47 resources · us-east-1
          </span>
          <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#f04438', background: 'rgba(240,68,56,0.1)', border: '1px solid rgba(240,68,56,0.25)', borderRadius: '6px', padding: '3px 8px' }}>
            Blast radius: 5 resources
          </span>
          <span style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: '#12b76a', boxShadow: '0 0 6px #12b76a', display: 'inline-block', animation: 'live-blink 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#12b76a' }}>Live</span>
        </div>

        {/* SVG Graph */}
        <svg
          width="100%"
          height="305"
          viewBox="0 0 840 310"
          style={{ overflow: 'visible', position: 'relative' }}
          aria-label="Animated AWS infrastructure dependency graph showing blast radius"
        >
          <defs>
            {/* Glowing edge filter */}
            <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges — drawn with animation */}
          {edges.map(([fromId, toId], i) => {
            const f = nodeMap[fromId]
            const t = nodeMap[toId]
            if (!f || !t) return null
            const inBlast = blastIds.has(fromId) && blastIds.has(toId)
            return (
              <g key={`${fromId}-${toId}`}>
                {/* Base edge */}
                <line
                  x1={f.cx} y1={f.cy} x2={t.cx} y2={t.cy}
                  stroke={inBlast ? '#f04438' : '#2a3d54'}
                  strokeWidth={inBlast ? '1.5' : '1.2'}
                  opacity={inBlast ? 0.6 : 0.8}
                  strokeDasharray="300"
                  strokeDashoffset="300"
                  style={{
                    animation: `hero-edge-draw 0.6s ease-out forwards`,
                    animationDelay: `${0.2 + i * 0.08}s`,
                    filter: inBlast ? 'url(#edge-glow)' : 'none',
                  }}
                />
                {/* Animated data flow dots on active edges */}
                {inBlast && (
                  <line
                    x1={f.cx} y1={f.cy} x2={t.cx} y2={t.cy}
                    stroke="#f04438"
                    strokeWidth="2"
                    opacity="0.5"
                    strokeDasharray="4 20"
                    style={{ animation: 'hero-data-flow 1.4s linear infinite' }}
                  />
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const inBlast = blastIds.has(node.id)
            return (
              <g
                key={node.id}
                transform={`translate(${node.cx},${node.cy})`}
                style={{
                  animation: `hero-node-appear 0.4s ease-out forwards`,
                  animationDelay: `${node.delay * 0.15}s`,
                  opacity: 0,
                  transformOrigin: `${node.cx}px ${node.cy}px`,
                }}
              >
                {/* Blast radius halo */}
                {inBlast && (
                  <circle
                    r="20"
                    fill="rgba(240,68,56,0.06)"
                    stroke="#f04438"
                    strokeWidth="1"
                    style={{ animation: 'hero-pulse 2s ease-in-out infinite', animationDelay: `${node.delay * 0.1}s` }}
                  />
                )}
                {/* Pulse ring for active nodes (non-blast) */}
                {node.pulse && !inBlast && (
                  <circle
                    r="20"
                    fill="none"
                    stroke={node.color}
                    strokeWidth="1"
                    style={{ animation: 'hero-pulse 2.5s ease-in-out infinite', animationDelay: `${node.delay * 0.2}s` }}
                  />
                )}
                {/* Outer glow ring for blast nodes */}
                {inBlast && (
                  <circle r="14" fill="none" stroke="#f04438" strokeWidth="2" opacity="0.3" />
                )}
                {/* Node circle */}
                <circle
                  r="12"
                  fill={inBlast ? '#f04438' : node.color}
                  opacity={inBlast ? 0.92 : 0.88}
                  style={inBlast ? { animation: 'hero-glow 2s ease-in-out infinite', color: '#f04438' } : {}}
                />
                {/* Label */}
                <text y="26" textAnchor="middle" fill={inBlast ? '#f04438' : '#8496b0'} fontSize="9" fontFamily="monospace">
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* RCA panel hint — simulates a selected node panel */}
        <div style={{
          position: 'absolute', right: '16px', top: '64px', bottom: '16px',
          width: '180px', background: '#0a0e15', border: '1px solid #1d2d42',
          borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
          opacity: 0.92,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff7d54', boxShadow: '0 0 5px #ff7d54' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#8496b0' }}>ALB / prod-alb</span>
          </div>
          <div style={{ height: '1px', background: '#162030' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontFamily: 'system-ui', fontSize: '9px', color: '#465c78', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI RCA</span>
            <span style={{ fontFamily: 'system-ui', fontSize: '10px', color: '#8496b0', lineHeight: 1.5 }}>
              High connection error rate detected on target group…
            </span>
          </div>
          <div style={{ height: '1px', background: '#162030' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontFamily: 'system-ui', fontSize: '9px', color: '#f04438', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Blast: 5 affected</span>
            {['EC2 / web-01', 'SQS / orders', 'RDS / prod-db'].map((r) => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f04438', opacity: 0.7, flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#465c78' }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function PainSection() {
  const cards = [
    {
      color: '#f04438',
      metric: '15+ minutes',
      desc: 'to identify which service caused the outage',
    },
    {
      color: '#f87c00',
      metric: 'Tribal knowledge',
      desc: 'Dependency maps live in Slack threads, not tools',
    },
    {
      color: '#00c4b4',
      metric: '$50K/incident',
      desc: 'Average cost of a 30-minute production outage',
    },
  ]

  return (
    <section
      style={{
        padding: '80px 24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      <h2
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '32px',
          fontWeight: 700,
          color: '#e2e8f4',
          letterSpacing: '-0.02em',
          marginBottom: '40px',
          textAlign: 'center',
        }}
      >
        Your infra is a black box during incidents
      </h2>
      <div
        style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {cards.map((card) => (
          <div
            key={card.metric}
            style={{
              flex: '1',
              minWidth: '260px',
              background: '#0c1018',
              border: '1px solid #162030',
              borderTop: `3px solid ${card.color}`,
              borderRadius: '12px',
              padding: '24px',
            }}
          >
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '28px',
                fontWeight: 700,
                color: card.color,
                marginBottom: '8px',
                letterSpacing: '-0.02em',
              }}
            >
              {card.metric}
            </div>
            <div
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '14px',
                color: '#8496b0',
                lineHeight: 1.6,
              }}
            >
              {card.desc}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorksSection() {
  const steps = [
    {
      num: '1',
      title: 'Create IAM role',
      desc: 'Paste the trust policy. Takes 2 minutes.',
    },
    {
      num: '2',
      title: 'Paste role ARN',
      desc: 'We validate via STS and start the scan.',
    },
    {
      num: '3',
      title: 'Explore your graph',
      desc: 'Click any node for AI root cause analysis.',
    },
  ]

  return (
    <section
      style={{
        padding: '80px 24px',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      <h2
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '32px',
          fontWeight: 700,
          color: '#e2e8f4',
          letterSpacing: '-0.02em',
          marginBottom: '56px',
          textAlign: 'center',
        }}
      >
        From zero to dependency graph in 5 minutes
      </h2>
      <div style={{ position: 'relative' }}>
        {/* Connector line */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: 'calc(16.66% + 20px)',
            right: 'calc(16.66% + 20px)',
            borderTop: '1px dashed #2a3d54',
            zIndex: 0,
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: '24px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {steps.map((step) => (
            <div
              key={step.num}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#00c4b4',
                  color: '#000',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {step.num}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#e2e8f4',
                    marginBottom: '6px',
                  }}
                >
                  {step.title}
                </div>
                <div
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '14px',
                    color: '#8496b0',
                    lineHeight: 1.6,
                  }}
                >
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  const features = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="3" fill="#00c4b4" />
          <circle cx="4"  cy="5"  r="2" fill="#00c4b4" opacity="0.6" />
          <circle cx="24" cy="5"  r="2" fill="#00c4b4" opacity="0.6" />
          <circle cx="4"  cy="23" r="2" fill="#00c4b4" opacity="0.6" />
          <circle cx="24" cy="23" r="2" fill="#00c4b4" opacity="0.6" />
          <circle cx="14" cy="3"  r="1.5" fill="#00c4b4" opacity="0.5" />
          <circle cx="14" cy="25" r="1.5" fill="#00c4b4" opacity="0.5" />
          <line x1="5.5" y1="6"   x2="11.5" y2="11.5" stroke="#00c4b4" strokeWidth="1.2" opacity="0.5" />
          <line x1="22.5" y1="6"  x2="16.5" y2="11.5" stroke="#00c4b4" strokeWidth="1.2" opacity="0.5" />
          <line x1="5.5" y1="22"  x2="11.5" y2="16.5" stroke="#00c4b4" strokeWidth="1.2" opacity="0.5" />
          <line x1="22.5" y1="22" x2="16.5" y2="16.5" stroke="#00c4b4" strokeWidth="1.2" opacity="0.5" />
          <line x1="14" y1="4.5"  x2="14" y2="11"     stroke="#00c4b4" strokeWidth="1.2" opacity="0.5" />
          <line x1="14" y1="17"   x2="14" y2="23.5"   stroke="#00c4b4" strokeWidth="1.2" opacity="0.5" />
        </svg>
      ),
      iconColor: '#00c4b4',
      title: 'Live Dependency Graph',
      desc: 'See every AWS resource and every connection. Filter by type, region, or service.',
      bullets: [
        'WebGL rendering — handles 10,000+ nodes',
        'Color by resource type for instant orientation',
        'Edge weights by traffic volume',
        'ForceAtlas2 physics layout',
      ],
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <path
            d="M14 3L17 11H25L19 16L21 24L14 19L7 24L9 16L3 11H11L14 3Z"
            fill="#f5c518"
            opacity="0.9"
          />
        </svg>
      ),
      iconColor: '#f5c518',
      title: 'AI Root Cause Analysis',
      desc: 'Click any node, get instant AI-powered RCA with evidence. Powered by Claude or Gemini.',
      bullets: [
        'Claude Sonnet + Gemini Flash support',
        'CloudTrail evidence enrichment',
        'Confidence levels on each finding',
        'Persistent RCA history per node',
      ],
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="11" stroke="#f87c00" strokeWidth="1.5" opacity="0.3" />
          <circle cx="14" cy="14" r="7"  stroke="#f87c00" strokeWidth="1.5" opacity="0.5" />
          <circle cx="14" cy="14" r="3"  fill="#f87c00" />
          <line x1="14" y1="3"  x2="14" y2="6"  stroke="#f87c00" strokeWidth="1.5" />
          <line x1="14" y1="22" x2="14" y2="25" stroke="#f87c00" strokeWidth="1.5" />
          <line x1="3"  y1="14" x2="6"  y2="14" stroke="#f87c00" strokeWidth="1.5" />
          <line x1="22" y1="14" x2="25" y2="14" stroke="#f87c00" strokeWidth="1.5" />
        </svg>
      ),
      iconColor: '#f87c00',
      title: 'Blast Radius Calculator',
      desc: 'Select any resource. See every downstream dependency that would fail — before making a change.',
      bullets: [
        'Up to 10-hop traversal depth',
        'Severity scoring per affected resource',
        'Canvas overlay on the live graph',
        'Pre-incident simulation mode',
      ],
    },
  ]

  return (
    <section
      style={{
        padding: '80px 24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
        {features.map((feat, i) => (
          <div
            key={feat.title}
            style={{
              display: 'flex',
              gap: '64px',
              alignItems: 'center',
              flexDirection: i % 2 === 0 ? 'row' : 'row-reverse',
              flexWrap: 'wrap',
            }}
          >
            {/* Text side */}
            <div style={{ flex: '1', minWidth: '280px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#111929',
                  border: '1px solid #162030',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}
              >
                {feat.icon}
              </div>
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '24px',
                  fontWeight: 700,
                  color: '#e2e8f4',
                  letterSpacing: '-0.02em',
                  marginBottom: '12px',
                }}
              >
                {feat.title}
              </h3>
              <p
                style={{
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '15px',
                  color: '#8496b0',
                  lineHeight: 1.7,
                  marginBottom: '20px',
                }}
              >
                {feat.desc}
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {feat.bullets.map((b) => (
                  <li
                    key={b}
                    style={{
                      fontFamily: 'system-ui, sans-serif',
                      fontSize: '13px',
                      color: '#8496b0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: feat.iconColor,
                        flexShrink: 0,
                        opacity: 0.8,
                      }}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Card side */}
            <div
              style={{
                flex: '1',
                minWidth: '280px',
                background: '#0c1018',
                border: `1px solid #162030`,
                borderTop: `2px solid ${feat.iconColor}`,
                borderRadius: '16px',
                padding: '28px',
                minHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ textAlign: 'center', opacity: 0.5 }}>
                {feat.icon}
                <div
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '12px',
                    color: '#465c78',
                    marginTop: '12px',
                    fontStyle: 'italic',
                  }}
                >
                  {feat.title} visualization
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function PricingSection() {
  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      period: '',
      badge: null,
      highlight: false,
      features: ['1 AWS account', '5 RCA per month', 'Community support', 'Open-source scanner'],
      cta: 'Get started free',
      ctaHref: '/sign-up',
      ctaStyle: 'outline',
    },
    {
      name: 'Pro',
      price: '$299',
      period: '/mo',
      badge: 'Most popular',
      highlight: true,
      features: ['5 AWS accounts', '100 RCA per month', 'Slack alerts', 'Priority support', 'Custom dashboards'],
      cta: 'Start 14-day trial',
      ctaHref: '/sign-up',
      ctaStyle: 'solid',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      badge: null,
      highlight: false,
      features: ['Unlimited accounts', 'Unlimited RCA', 'PagerDuty integration', 'SSO / SAML', 'SLA guarantee'],
      cta: 'Talk to us',
      ctaHref: '/sign-up',
      ctaStyle: 'outline',
    },
  ]

  return (
    <section
      style={{
        padding: '80px 24px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      <h2
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '32px',
          fontWeight: 700,
          color: '#e2e8f4',
          letterSpacing: '-0.02em',
          textAlign: 'center',
          marginBottom: '8px',
        }}
      >
        Simple pricing. No surprises.
      </h2>
      <p
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '15px',
          color: '#8496b0',
          textAlign: 'center',
          marginBottom: '48px',
        }}
      >
        Start free. Scale when your team does.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'stretch',
        }}
      >
        {plans.map((plan) => (
          <div
            key={plan.name}
            style={{
              flex: '1',
              minWidth: '260px',
              maxWidth: '300px',
              background: '#0c1018',
              border: plan.highlight ? '1px solid #00c4b4' : '1px solid #162030',
              borderRadius: '16px',
              padding: '32px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              position: 'relative',
              boxShadow: plan.highlight ? '0 0 32px rgba(0,196,180,0.12)' : 'none',
            }}
          >
            {plan.badge && (
              <div
                style={{
                  position: 'absolute',
                  top: '-13px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#00c4b4',
                  color: '#000',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 12px',
                  borderRadius: '20px',
                  whiteSpace: 'nowrap',
                }}
              >
                {plan.badge}
              </div>
            )}

            <div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '14px',
                  fontWeight: 600,
                  color: plan.highlight ? '#00c4b4' : '#8496b0',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {plan.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '36px',
                    fontWeight: 700,
                    color: '#e2e8f4',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {plan.price}
                </span>
                {plan.period && (
                  <span
                    style={{
                      fontFamily: 'system-ui, sans-serif',
                      fontSize: '14px',
                      color: '#465c78',
                    }}
                  >
                    {plan.period}
                  </span>
                )}
              </div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {plan.features.map((f) => (
                <li
                  key={f}
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: '13px',
                    color: '#8496b0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="#12b76a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={plan.ctaHref}
              style={{
                display: 'block',
                textAlign: 'center',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                padding: '12px',
                borderRadius: '10px',
                textDecoration: 'none',
                ...(plan.ctaStyle === 'solid'
                  ? { background: '#00c4b4', color: '#000' }
                  : { background: 'transparent', border: '1px solid #2a3d54', color: '#8496b0' }),
              }}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    {
      title: 'Product',
      links: [
        { label: 'Graph explorer', href: '#' },
        { label: 'RCA engine', href: '#' },
        { label: 'Blast radius', href: '#' },
        { label: 'Changelog', href: '#' },
      ],
    },
    {
      title: 'Docs',
      links: [
        { label: 'Getting started', href: '#' },
        { label: 'IAM setup', href: '#' },
        { label: 'API reference', href: '#' },
        { label: 'Open-source', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Blog', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Contact', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy policy', href: '#' },
        { label: 'Terms of service', href: '#' },
        { label: 'Security', href: '#' },
        { label: 'Cookie policy', href: '#' },
      ],
    },
  ]

  return (
    <footer
      style={{
        padding: '48px 24px',
        borderTop: '1px solid #162030',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '48px',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand column */}
        <div style={{ flex: '1', minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <circle cx="14" cy="14" r="4" fill="#00c4b4" />
              <circle cx="4"  cy="4"  r="2.5" fill="#00c4b4" opacity="0.6" />
              <circle cx="24" cy="4"  r="2.5" fill="#00c4b4" opacity="0.6" />
              <circle cx="4"  cy="24" r="2.5" fill="#00c4b4" opacity="0.6" />
              <circle cx="24" cy="24" r="2.5" fill="#00c4b4" opacity="0.6" />
              <line x1="6" y1="5" x2="10.5" y2="10.5" stroke="#00c4b4" strokeWidth="1.5" opacity="0.5" />
              <line x1="22" y1="5" x2="17.5" y2="10.5" stroke="#00c4b4" strokeWidth="1.5" opacity="0.5" />
              <line x1="6" y1="23" x2="10.5" y2="17.5" stroke="#00c4b4" strokeWidth="1.5" opacity="0.5" />
              <line x1="22" y1="23" x2="17.5" y2="17.5" stroke="#00c4b4" strokeWidth="1.5" opacity="0.5" />
            </svg>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: '16px',
                color: '#e2e8f4',
              }}
            >
              LiveInfra
            </span>
          </div>
          <p
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: '13px',
              color: '#465c78',
              lineHeight: 1.6,
            }}
          >
            © 2026 LiveInfra. Built for SRE teams.
          </p>
        </div>

        {/* Link columns */}
        {cols.map((col) => (
          <div key={col.title} style={{ minWidth: '120px' }}>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '12px',
                fontWeight: 600,
                color: '#8496b0',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '12px',
              }}
            >
              {col.title}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    style={{
                      fontFamily: 'system-ui, sans-serif',
                      fontSize: '13px',
                      color: '#465c78',
                      textDecoration: 'none',
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#05070a',
        color: '#e2e8f4',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <NavBar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 24px',
          textAlign: 'center',
        }}
      >
        {/* Eyebrow pill */}
        <div
          style={{
            display: 'inline-block',
            border: '1px solid rgba(0,196,180,0.3)',
            color: '#00c4b4',
            background: 'rgba(0,196,180,0.08)',
            fontSize: '12px',
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
            padding: '5px 14px',
            borderRadius: '20px',
            marginBottom: '32px',
          }}
        >
          Now in beta · Agentless AWS graphs
        </div>

        {/* H1 */}
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(40px, 6vw, 64px)',
            fontWeight: 700,
            lineHeight: 1.08,
            maxWidth: '700px',
            color: '#e2e8f4',
            letterSpacing: '-0.03em',
            marginBottom: '24px',
          }}
        >
          Know exactly what breaks
          <br />
          before it{' '}
          <span style={{ color: '#00c4b4' }}>breaks.</span>
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: '18px',
            color: '#8496b0',
            maxWidth: '520px',
            lineHeight: 1.7,
            marginBottom: '40px',
          }}
        >
          LiveInfra maps your AWS infrastructure as a live dependency graph. When something
          fails, you see the blast radius instantly — and AI tells you why.
        </p>

        {/* CTA buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
        >
          <Link
            href="/sign-up"
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: '15px',
              fontWeight: 600,
              color: '#000',
              background: '#00c4b4',
              height: '48px',
              padding: '0 28px',
              borderRadius: '12px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            Start scanning free →
          </Link>
          <Link
            href="#how-it-works"
            style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: '15px',
              fontWeight: 500,
              color: '#8496b0',
              background: 'transparent',
              border: '1px solid #2a3d54',
              height: '48px',
              padding: '0 28px',
              borderRadius: '12px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            View live demo
          </Link>
        </div>

        {/* Trust chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {['No credit card', 'Read-only IAM', 'SOC 2 in progress'].map((chip, i) => (
            <span
              key={chip}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'system-ui, sans-serif',
                fontSize: '11px',
                color: '#465c78',
              }}
            >
              {i > 0 && (
                <span style={{ color: '#2a3d54' }}>·</span>
              )}
              {chip}
            </span>
          ))}
        </div>

        {/* Hero graph mock */}
        <div style={{ width: '100%' }}>
          <HeroGraphMock />
        </div>
      </section>

      {/* ── Pain ──────────────────────────────────────────────────────────── */}
      <PainSection />

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <div id="how-it-works">
        <HowItWorksSection />
      </div>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <FeaturesSection />

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <PricingSection />

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  )
}
