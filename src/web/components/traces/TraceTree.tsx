import React, { useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { formatDuration } from '../../lib/utils';
import { Globe, Database, Server, MessageSquare, Cog, Box, ChevronDown, ChevronRight, Zap, Cloud } from 'lucide-react';

interface Span {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  serviceName: string;
  serviceNamespace?: string | null;
  serviceVersion?: string | null;
  name: string;
  kind: string;
  statusCode: string;
  statusMessage?: string | null;
  startTime: string;
  endTime: string;
  durationMs?: number | null;
  attributes: unknown;
  resourceAttributes: unknown;
  events: unknown;
  links?: unknown;
}

interface TraceTreeProps {
  spans: Span[];
  selectedSpanId?: string;
  onSpanClick?: (span: Span) => void;
}

interface SpanNode {
  span: Span;
  children: SpanNode[];
}

// Custom SVG Icons for specific technologies
const NextJsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 1-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.86 8.292 8.209 9.695.779.251 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.572 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z"/>
  </svg>
);

const PrismaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.807 18.285L13.553.756a1.324 1.324 0 0 0-1.129-.754 1.31 1.31 0 0 0-1.206.626l-8.952 14.5a1.356 1.356 0 0 0 .016 1.455l4.376 6.778a1.408 1.408 0 0 0 1.58.581l12.703-3.757c.389-.115.707-.39.873-.755s.164-.783-.007-1.145zm-1.848.752L9.18 22.224a.452.452 0 0 1-.575-.52l3.85-18.438c.072-.345.549-.4.699-.08l7.129 15.138a.515.515 0 0 1-.323.713z"/>
  </svg>
);

const VercelIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 22.525H0l12-21.05 12 21.05z"/>
  </svg>
);

const AwsLambdaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.948 0h4.382l9.146 22.951h-4.381L9.535 13.5 6.258 22.951H1.877L7.27 9.28 4.948 0zm9.671 0h4.381l3.123 9.28-2.321 5.824L14.619 0z"/>
  </svg>
);

const PostgresIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3418-2.2466.1111-2.4429-.0035.7113-1.1296 1.2922-2.6867 1.5919-4.2879.4299-2.2971.2476-4.1497-.5136-5.2183-.5559-.7795-1.4561-1.2389-2.5984-1.3258-.8123-.0618-1.5549.0546-2.1494.2054.0484-.4727.0552-.9558-.009-1.4294-.1485-1.0976-.6302-1.8806-1.4326-2.3308-1.3828-.7742-3.2715-.4799-4.6396.3762-.7823.4902-1.3827 1.1305-1.6731 1.7854-.9061-.4399-2.1654-.8144-3.3626-.7117-1.5793.1355-2.8284.9456-3.5148 2.2763-.7867 1.5252-.7534 3.5434.0917 5.9287.6146 1.7354 1.6506 3.6535 2.9415 5.4455-.3776.6586-.6045 1.3455-.644 2.0485-.0694 1.2374.3836 2.2381 1.2724 2.8142.5268.3418 1.1384.4743 1.7736.4743.9061 0 1.8543-.2723 2.6088-.5595.8338-.3166 1.7022-.7379 2.5365-1.2305 1.6078.5765 3.3681.8757 5.1515.8757 1.3104 0 2.4915-.1757 3.5136-.5246 1.1481-.3916 2.4094-1.0811 2.8274-2.3319.283-.8456.1454-1.7988-.3833-2.6526z"/>
  </svg>
);

const RedisIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M10.5 2.661l.54.997-1.797.644 2.409.218.748 1.246.467-1.121 2.077-.208-1.61-.613.426-1.017-1.578.519zm6.905 2.077L13.76 6.182l3.292 1.298-.353 1.058-4.005-1.576-1.98.877 3.157 1.057-.39 1.12-3.882-1.39-1.872.738 3.231 1.129-.44 1.043-4.136-1.462-1.769.685 3.232 1.283-.411 1.028-4.136-1.616-1.82.697 3.308 1.356-.353 1.043-4.262-1.77-1.768.666 4.898 2.077c1.416.589 2.85 1.103 4.327 1.524a31.52 31.52 0 0 0 8.612.845c.396-.017.776-.044 1.155-.077l.212-.596z"/>
  </svg>
);

const MongoIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0 1 11.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 0 0 3.639-8.464c.01-.814-.103-1.662-.197-2.218z"/>
  </svg>
);

const KafkaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.03 4.8a2.093 2.093 0 1 1 0 4.186 2.093 2.093 0 0 1 0-4.186zm4.378 4.737a1.756 1.756 0 1 1 0 3.512 1.756 1.756 0 0 1 0-3.512zm-8.786 0a1.756 1.756 0 1 1 0 3.512 1.756 1.756 0 0 1 0-3.512zm4.408 5.063a2.093 2.093 0 1 1 0 4.186 2.093 2.093 0 0 1 0-4.186z"/>
  </svg>
);

const GraphQLIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M14.051 2.751l4.935 2.85c.816-.859 2.173-.893 3.032-.077.148.14.274.301.377.477.589 1.028.232 2.339-.796 2.928-.174.1-.361.175-.558.223v5.699c1.146.273 1.854 1.423 1.58 2.569-.048.204-.127.4-.232.581-.592 1.023-1.901 1.374-2.927.782-.196-.113-.375-.259-.526-.428l-4.905 2.832c.372 1.123-.238 2.335-1.361 2.707-.217.071-.442.108-.67.108-1.181.001-2.139-.955-2.14-2.136 0-.205.029-.41.088-.609l-4.936-2.847c-.816.854-2.171.887-3.026.07-.854-.816-.886-2.171-.07-3.026.283-.297.646-.506 1.044-.603l.001-5.699c-1.15-.276-1.858-1.433-1.581-2.584.047-.198.123-.389.224-.566.603-1.017 1.917-1.352 2.934-.749.178.106.337.236.472.387l4.934-2.849c-.372-1.124.236-2.335 1.359-2.708 1.123-.372 2.335.236 2.708 1.359.065.197.098.403.098.611 0 .596-.222 1.17-.619 1.61zm-.628 1.549l-4.93 2.849c.109.18.195.373.255.575l4.903-2.831c-.104-.191-.183-.396-.228-.593zm3.181 14.564l4.859-2.806c-.068-.2-.109-.408-.121-.62h-5.691c.049.206.076.42.079.636l.874.79zm-.994-.917h-6.221l3.108 1.793 3.113-1.793zm2.229-2.295l-.004-5.681c-.2-.064-.389-.156-.565-.27l-5.619 5.166h6.008c.046-.238.112-.465.18-.601v-.614zm-4.371-4.307l4.094-3.759c-.142-.115-.269-.247-.378-.393l-4.093 3.758c.14.118.264.253.377.394zm-3.476 4.307h6.012l-5.614-5.167c-.177.114-.367.205-.567.27l-.004 5.681c.068.136.134.363.173.601v.615zm2.394-8.452l-4.982 2.878c.068.136.116.28.145.428h5.669c.026-.146.071-.287.135-.42l-.967-.878v-2.008zm-3.166 3.306l-4.097 3.759c.105.106.198.222.278.346l4.096-3.759c-.104-.106-.196-.222-.277-.346zm3.983.578l4.095-3.762c-.143-.116-.271-.248-.381-.394l-4.094 3.762c.141.115.269.248.38.394zM7.57 4.751l-4.93 2.849c.104.192.182.397.226.611l4.928-2.847c-.109-.178-.194-.368-.254-.571l.03-.042zm6.46 0c-.06.203-.145.393-.254.571l4.93 2.849c.044-.214.122-.419.226-.611l-4.932-2.851.03.042z"/>
  </svg>
);

const SupabaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z"/>
  </svg>
);

const CloudflareIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.309 17.25h-8.18l-.058-.262c-.096-.426-.036-.817.18-1.164.215-.347.555-.588.97-.689l7.325-1.78c.128-.032.234-.06.256-.134.022-.073-.022-.15-.116-.237-.283-.262-.665-.397-1.115-.397H7.83c-.94 0-1.802.535-2.216 1.38l-1.18 2.41c-.066.134-.022.238.116.238h11.76c.128 0 .234-.06.256-.134.022-.073-.022-.15-.116-.237-.283-.262-.665-.397-1.115-.397h-4.892c-.128 0-.234.06-.256.134-.022.073.022.15.116.237.283.262.665.397 1.115.397h5.29c.94 0 1.802-.535 2.216-1.38l.702-1.437c.066-.134.022-.238-.116-.238h-2.801zm5.178-3.588l-.716.094c-.128.019-.234.116-.256.253-.022.137.044.262.172.318.283.125.43.4.348.696l-.116.41c-.052.178-.018.365.088.519.106.153.273.243.458.243h1.224c.21 0 .38-.17.38-.38v-.02c0-.02.02-.04.02-.06l.716-1.465c.066-.134.022-.238-.116-.238h-2.07c-.066 0-.116-.053-.132-.135z"/>
  </svg>
);

const ExpressIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 18.588a1.529 1.529 0 0 1-1.895-.72l-3.45-4.771-.5-.667-4.003 5.444a1.466 1.466 0 0 1-1.802.708l5.158-6.92-4.798-6.251a1.595 1.595 0 0 1 1.9.666l3.576 4.83 3.596-4.81a1.435 1.435 0 0 1 1.788-.668L21.708 7.9l-2.522 3.283a.666.666 0 0 0 0 .994l4.804 6.412zM.002 11.576l.42-2.075c1.154-4.103 5.858-5.81 9.094-3.27 1.895 1.489 2.368 3.597 2.275 5.973H1.116C.943 16.447 4.005 19.009 7.92 17.7a4.078 4.078 0 0 0 2.582-2.876c.207-.666.548-.78 1.174-.588a5.417 5.417 0 0 1-2.589 3.957 6.272 6.272 0 0 1-7.306-.933 6.575 6.575 0 0 1-1.64-3.858c0-.235-.08-.455-.134-.666A88.33 88.33 0 0 1 0 11.577zm1.127-.286h9.654c-.06-3.076-2.001-5.258-4.59-5.278-2.882-.04-4.944 2.094-5.071 5.264z"/>
  </svg>
);

const FastifyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.245 6.496l-4.478-4.478a1.178 1.178 0 0 0-1.665 0L.261 18.859a.89.89 0 0 0 0 1.258l3.622 3.622a.89.89 0 0 0 1.258 0L21.983 6.898l1.262 1.262 1.665-1.665z"/>
  </svg>
);

// Get icon component and styling based on span type/attributes
function getSpanStyle(span: Span) {
  const attrs = (span.attributes || {}) as Record<string, unknown>;
  const name = span.name.toLowerCase();
  const serviceName = span.serviceName.toLowerCase();
  const dbSystem = String(attrs['db.system'] || '').toLowerCase();
  const httpUrl = String(attrs['http.url'] || '').toLowerCase();

  // Next.js
  if (serviceName.includes('next') || name.includes('next') || httpUrl.includes('_next')) {
    return { icon: NextJsIcon, bgColor: 'bg-black', borderColor: 'border-gray-700', label: 'Next.js' };
  }

  // Vercel
  if (serviceName.includes('vercel') || httpUrl.includes('vercel')) {
    return { icon: VercelIcon, bgColor: 'bg-black', borderColor: 'border-gray-700', label: 'Vercel' };
  }

  // Prisma
  if (name.includes('prisma') || attrs['db.system'] === 'prisma') {
    return { icon: PrismaIcon, bgColor: 'bg-[#2D3748]', borderColor: 'border-[#2D3748]/30', label: 'Prisma' };
  }

  // Supabase
  if (serviceName.includes('supabase') || httpUrl.includes('supabase')) {
    return { icon: SupabaseIcon, bgColor: 'bg-[#3ECF8E]', borderColor: 'border-[#3ECF8E]/30', label: 'Supabase' };
  }

  // PostgreSQL
  if (dbSystem.includes('postgres') || dbSystem.includes('pg')) {
    return { icon: PostgresIcon, bgColor: 'bg-[#336791]', borderColor: 'border-[#336791]/30', label: 'PostgreSQL' };
  }

  // MongoDB
  if (dbSystem.includes('mongo')) {
    return { icon: MongoIcon, bgColor: 'bg-[#47A248]', borderColor: 'border-[#47A248]/30', label: 'MongoDB' };
  }

  // Redis
  if (dbSystem.includes('redis') || name.includes('redis') || name.includes('cache')) {
    return { icon: RedisIcon, bgColor: 'bg-[#DC382D]', borderColor: 'border-[#DC382D]/30', label: 'Redis' };
  }

  // Kafka
  if (attrs['messaging.system'] === 'kafka' || name.includes('kafka')) {
    return { icon: KafkaIcon, bgColor: 'bg-black', borderColor: 'border-gray-700', label: 'Kafka' };
  }

  // GraphQL
  if (name.includes('graphql') || attrs['graphql.operation.name']) {
    return { icon: GraphQLIcon, bgColor: 'bg-[#E10098]', borderColor: 'border-[#E10098]/30', label: 'GraphQL' };
  }

  // AWS Lambda
  if (serviceName.includes('lambda') || attrs['faas.name'] || attrs['cloud.provider'] === 'aws') {
    return { icon: AwsLambdaIcon, bgColor: 'bg-[#FF9900]', borderColor: 'border-[#FF9900]/30', label: 'Lambda' };
  }

  // Cloudflare
  if (serviceName.includes('cloudflare') || httpUrl.includes('cloudflare')) {
    return { icon: CloudflareIcon, bgColor: 'bg-[#F38020]', borderColor: 'border-[#F38020]/30', label: 'Cloudflare' };
  }

  // Express
  if (serviceName.includes('express') || name.includes('express')) {
    return { icon: ExpressIcon, bgColor: 'bg-black', borderColor: 'border-gray-700', label: 'Express' };
  }

  // Fastify
  if (serviceName.includes('fastify') || name.includes('fastify')) {
    return { icon: FastifyIcon, bgColor: 'bg-black', borderColor: 'border-gray-700', label: 'Fastify' };
  }

  // Generic HTTP
  if (attrs['http.method'] || attrs['http.url'] || name.includes('http') || name.includes('fetch')) {
    return { icon: Globe, bgColor: 'bg-orange-500', borderColor: 'border-orange-500/30', label: 'HTTP' };
  }

  // Generic Database
  if (attrs['db.system'] || attrs['db.statement'] || name.includes('query') || name.includes('db.')) {
    return { icon: Database, bgColor: 'bg-slate-500', borderColor: 'border-slate-500/30', label: 'DB' };
  }

  // Queue/Messaging
  if (attrs['messaging.system'] || name.includes('queue') || name.includes('message') || name.includes('publish')) {
    return { icon: MessageSquare, bgColor: 'bg-blue-500', borderColor: 'border-blue-500/30', label: 'Queue' };
  }

  // KV/Cache
  if (name.includes('kv') || name.includes('cache')) {
    return { icon: Box, bgColor: 'bg-amber-600', borderColor: 'border-amber-600/30', label: 'KV' };
  }

  // Internal
  if (span.kind === 'INTERNAL' || name.includes('internal')) {
    return { icon: Cog, bgColor: 'bg-purple-500', borderColor: 'border-purple-500/30', label: 'Internal' };
  }

  // Default - Server/Service
  return { icon: Server, bgColor: 'bg-green-500', borderColor: 'border-green-500/30', label: span.serviceName };
}

function formatSpanName(span: Span): string {
  const attrs = (span.attributes || {}) as Record<string, unknown>;

  if (attrs['http.method'] && attrs['http.target']) {
    return `${attrs['http.method']} ${attrs['http.target']}`;
  }
  if (attrs['http.method'] && attrs['http.url']) {
    try {
      const url = new URL(String(attrs['http.url']));
      return `${attrs['http.method']} ${url.pathname}`;
    } catch {
      return `${attrs['http.method']} ${attrs['http.url']}`;
    }
  }

  if (attrs['rpc.method']) {
    return String(attrs['rpc.method']);
  }

  if (attrs['db.operation'] && attrs['db.sql.table']) {
    return `${attrs['db.operation']} ${attrs['db.sql.table']}`;
  }

  return span.name;
}

function SpanNodeComponent({
  node,
  selectedSpanId,
  onSpanClick,
  depth = 0,
  isLastChild = true,
  parentLines = [],
}: {
  node: SpanNode;
  selectedSpanId?: string;
  onSpanClick?: (span: Span) => void;
  depth?: number;
  isLastChild?: boolean;
  parentLines?: boolean[];
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { icon: Icon, bgColor, borderColor, label } = getSpanStyle(node.span);
  const isSelected = selectedSpanId === node.span.spanId;
  const hasError = node.span.statusCode === 'ERROR';
  const displayName = formatSpanName(node.span);
  const hasChildren = node.children.length > 0;

  return (
    <div className="relative">
      {/* Node row */}
      <div className="flex items-stretch">
        {/* Connector lines from parent */}
        {depth > 0 && (
          <div className="flex items-stretch">
            {parentLines.map((showLine, idx) => (
              <div key={idx} className="w-6 flex-shrink-0 relative">
                {showLine && (
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                )}
              </div>
            ))}
            <div className="w-6 flex-shrink-0 relative flex items-center">
              {/* Vertical line to this node */}
              <div className={cn(
                "absolute left-3 w-px bg-border",
                isLastChild ? "top-0 h-5" : "top-0 bottom-0"
              )} />
              {/* Horizontal line to node */}
              <div className="absolute left-3 top-5 w-3 h-px bg-border" />
            </div>
          </div>
        )}

        {/* The span node */}
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all my-0.5',
            'hover:border-primary/50 hover:bg-accent/30',
            isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : borderColor + ' bg-card',
            hasError && 'border-red-500/50 bg-red-500/5'
          )}
          onClick={() => onSpanClick?.(node.span)}
        >
          {/* Expand/collapse toggle */}
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-accent rounded -ml-1"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Icon */}
          <div className={cn('p-1.5 rounded', hasError ? 'bg-red-500' : bgColor)}>
            <Icon className="h-3.5 w-3.5 text-white" />
          </div>

          {/* Label & Name */}
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap',
              hasError ? 'bg-red-500/20 text-red-400' : 'bg-muted text-muted-foreground'
            )}>
              {label}
            </span>
            <span className="text-sm font-medium truncate max-w-[300px]">
              {displayName}
            </span>
          </div>

          {/* Duration */}
          <span className="text-[11px] text-muted-foreground font-mono ml-auto whitespace-nowrap pl-4">
            {formatDuration(node.span.durationMs || 0)}
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {node.children.map((child, idx) => (
            <SpanNodeComponent
              key={child.span.spanId}
              node={child}
              selectedSpanId={selectedSpanId}
              onSpanClick={onSpanClick}
              depth={depth + 1}
              isLastChild={idx === node.children.length - 1}
              parentLines={[...parentLines, !isLastChild]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TraceTree({ spans, selectedSpanId, onSpanClick }: TraceTreeProps) {
  const tree = useMemo(() => {
    const spanMap = new Map<string, Span>();
    const childrenMap = new Map<string, Span[]>();

    for (const span of spans) {
      spanMap.set(span.spanId, span);
      if (span.parentSpanId) {
        const children = childrenMap.get(span.parentSpanId) || [];
        children.push(span);
        childrenMap.set(span.parentSpanId, children);
      }
    }

    const rootSpans = spans.filter((s) => !s.parentSpanId || !spanMap.has(s.parentSpanId));

    const buildTree = (span: Span): SpanNode => {
      const children = childrenMap.get(span.spanId) || [];
      children.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      return {
        span,
        children: children.map((c) => buildTree(c)),
      };
    };

    return rootSpans
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .map((s) => buildTree(s));
  }, [spans]);

  return (
    <div className="p-4 font-sans">
      {tree.map((node, idx) => (
        <SpanNodeComponent
          key={node.span.spanId}
          node={node}
          selectedSpanId={selectedSpanId}
          onSpanClick={onSpanClick}
          isLastChild={idx === tree.length - 1}
        />
      ))}
    </div>
  );
}
