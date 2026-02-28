import {
  DocsLayout,
  DocsSection,
  DocsCode,
  DocsPropTable,
  DocsNote,
  DocsLink,
} from "../_components/docs";
import { ComponentPreview } from "../_components/component-preview";
import { CodeBlock } from "../_components/code-block";
import { WayfarerExample } from "../_components/examples/wayfarer-example";
import { getExampleSource } from "@/lib/get-example-source";
import { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "site-url-here";

const installCode = `npx shadcn@latest add ${siteUrl}/r/wayfarer`;

const usageCode = `import { useEffect, useRef, useState } from "react";
import { Map, MapMarker, MarkerContent } from "@/components/ui/map";
import {
  MapWayfarer,
  WayfarerSection,
  useMapWayfarer,
  useWayfarer,
  type WayfarerData,
} from "@/components/ui/wayfarer";

function TravelStory() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<WayfarerData | null>(null);

  // Fetch route data from API (recommended for large datasets)
  useEffect(() => {
    fetch("/api/route")
      .then((res) => res.json())
      .then(setData);
  }, []);

  if (!data) return <LoadingSpinner />;

  return <TravelMap data={data} scrollRef={scrollRef} />;
}

function TravelMap({
  data,
  scrollRef,
}: {
  data: WayfarerData;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  // useMapWayfarer = useWayfarerScroll + auto prop binding
  const {
    wayfarerProps,   // spread onto <MapWayfarer>
    currentStop,     // current stop data
    nextStop,        // next stop data
    segmentIndex,    // current segment (-1 = before first)
    progress,        // 0-1 within segment
    sectionZoom,     // zoom override from <WayfarerSection>
    sectionCenter,   // center override from <WayfarerSection>
  } = useMapWayfarer({
    data,
    scrollContainerRef: scrollRef,
    triggerRatio: 0.3,  // trigger line at 30% from top
  });

  return (
    <div className="flex h-screen">
      <div className="w-1/2 h-full">
        <Map center={[-119.5, 35.5]} zoom={6}>
          <MapWayfarer
            {...wayfarerProps}
            // Route line styling
            routeColor="#94a3b8"
            routeWidth={3}
            routeOpacity={0.4}
            routeDashArray={[4, 4]}
            // Progress line styling
            progressColor="#3b82f6"
            progressWidth={4}
            // Camera behavior
            autoZoom
            damping={0.12}
            followCamera
            padding={80}
            // Built-in stop dots (or use custom markers below)
            showStops
            stopColor="#ef4444"
            stopRadius={6}
          >
            {/* Custom markers via children */}
            {data.stops.map((stop, i) => (
              <MapMarker key={stop.id} longitude={stop.coordinates[0]} latitude={stop.coordinates[1]}>
                <MarkerContent>
                  <div className="size-6 rounded-full bg-blue-500 text-white text-xs font-bold
                    flex items-center justify-center border-2 border-white shadow-lg">
                    {i + 1}
                  </div>
                </MarkerContent>
              </MapMarker>
            ))}

            {/* Child components can use useWayfarer() */}
            <ProgressIndicator />
          </MapWayfarer>
        </Map>
      </div>

      <div ref={scrollRef} className="w-1/2 h-full overflow-y-auto">
        {/* Normal section — camera follows the route */}
        <WayfarerSection id="sf" className="min-h-screen p-8">
          <h2>San Francisco</h2>
          <p>Starting point of our journey...</p>
        </WayfarerSection>

        <WayfarerSection id="slo" className="min-h-screen p-8">
          <h2>San Luis Obispo</h2>
        </WayfarerSection>

        {/* Override zoom/center — camera jumps to a specific view */}
        <WayfarerSection
          id="la"
          className="min-h-screen p-8"
          zoom={14}
          center={[-118.2668, 34.0407]}  // zoom into Downtown LA
        >
          <h2>Downtown Los Angeles Close-up</h2>
        </WayfarerSection>

        <WayfarerSection id="sd" className="min-h-screen p-8">
          <h2>San Diego</h2>
        </WayfarerSection>
      </div>
    </div>
  );
}

// Child component using useWayfarer() context hook
function ProgressIndicator() {
  const { segmentIndex, progress } = useWayfarer();
  return (
    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
      Segment {segmentIndex} — {(progress * 100).toFixed(0)}%
    </div>
  );
}`;

export const metadata: Metadata = {
  title: "Wayfarer",
  description:
    "Scroll-driven map storytelling component with smooth camera following.",
};

export default function WayfarerPage() {
  const wayfarerSource = getExampleSource("wayfarer-example.tsx");

  return (
    <DocsLayout
      title="Wayfarer"
      description="Create scroll-driven map experiences with automatic camera following and progress visualization."
      prev={{ title: "Clusters", href: "/docs/clusters" }}
      next={{ title: "Advanced Usage", href: "/docs/advanced-usage" }}
      toc={[
        { title: "Installation", slug: "installation" },
        { title: "Usage", slug: "usage" },
        { title: "useMapWayfarer", slug: "usemapwayfarer" },
        { title: "useWayfarerScroll", slug: "usewayfarerscroll" },
        { title: "MapWayfarer", slug: "mapwayfarer" },
        { title: "WayfarerSection", slug: "wayfarersection" },
        { title: "Data Structure", slug: "data-structure" },
      ]}
    >
      <DocsSection>
        <p>
          The <DocsCode>MapWayfarer</DocsCode> component enables scroll-driven
          map storytelling. As users scroll through content, the map
          automatically follows the route, draws a progress line, and smoothly
          animates camera transitions.
        </p>
        <p>
          This component is designed for{" "}
          <strong>long-form scrollable content</strong>, such as travel
          journals, guided tours, or route narratives. The scroll position
          determines which section is active and how far along the route the
          user has progressed.
        </p>
      </DocsSection>

      <DocsSection title="Installation">
        <p>Run the following command to add the wayfarer component:</p>
        <CodeBlock code={installCode} language="bash" />
        <p>
          This will install the wayfarer component and its dependency (the{" "}
          <DocsCode>map</DocsCode> component) if not already present.
        </p>
      </DocsSection>

      <DocsSection title="Usage">
        <p>The Wayfarer system consists of three main parts:</p>
        <ul>
          <li>
            <DocsCode>useMapWayfarer</DocsCode> — Convenience hook that tracks
            scroll progress and returns props for MapWayfarer
          </li>
          <li>
            <DocsCode>MapWayfarer</DocsCode> — Component that renders the route
            and controls the camera
          </li>
          <li>
            <DocsCode>WayfarerSection</DocsCode> — Marks content sections that
            trigger map updates
          </li>
        </ul>
        <CodeBlock code={usageCode} />
      </DocsSection>

      <ComponentPreview code={wayfarerSource}>
        <WayfarerExample />
      </ComponentPreview>

      <DocsNote>
        <strong>Note:</strong> When the user manually drags or zooms the map,
        camera following is automatically paused. Following resumes when the
        user continues scrolling.
      </DocsNote>

      <DocsSection title="useMapWayfarer">
        <p>
          Convenience hook that combines scroll tracking with prop binding.
          Returns a <DocsCode>wayfarerProps</DocsCode> object that can be spread
          directly onto <DocsCode>MapWayfarer</DocsCode>, eliminating manual
          prop passing.
        </p>

        <h4 className="font-medium mt-6 mb-2">Options</h4>
        <p className="text-sm text-muted-foreground mb-2">
          Same options as <DocsCode>useWayfarerScroll</DocsCode> below.
        </p>

        <h4 className="font-medium mt-6 mb-2">Returns</h4>
        <DocsPropTable
          props={[
            {
              name: "wayfarerProps",
              type: "{ data, segmentIndex, progress }",
              description: "Props object to spread onto MapWayfarer.",
            },
            {
              name: "segmentIndex",
              type: "number",
              description: "Current segment index (-1 = before first section).",
            },
            {
              name: "progress",
              type: "number",
              description: "Progress within current segment (0-1).",
            },
            {
              name: "currentStop",
              type: "WayfarerStop | null",
              description: "Current stop data.",
            },
            {
              name: "nextStop",
              type: "WayfarerStop | null",
              description: "Next stop data.",
            },
          ]}
        />
      </DocsSection>

      <DocsSection title="useWayfarerScroll">
        <p>
          Lower-level hook that monitors scroll position and calculates which
          section is currently active. Use this if you need more control;
          otherwise prefer <DocsCode>useMapWayfarer</DocsCode>.
        </p>

        <h4 className="font-medium mt-6 mb-2">Options</h4>
        <DocsPropTable
          props={[
            {
              name: "data",
              type: "WayfarerData",
              description: "Required. Route and stops data.",
            },
            {
              name: "scrollContainerRef",
              type: "RefObject<HTMLElement>",
              default: "window",
              description:
                "Reference to the scroll container. If not provided, uses window scroll.",
            },
            {
              name: "sectionSelector",
              type: "string",
              default: '".mapcn-wayfarer-section"',
              description: "CSS selector for section elements.",
            },
            {
              name: "triggerRatio",
              type: "number",
              default: "0.2",
              description: "Position of trigger line as ratio from top (0-1).",
            },
          ]}
        />

        <h4 className="font-medium mt-6 mb-2">Returns</h4>
        <DocsPropTable
          props={[
            {
              name: "segmentIndex",
              type: "number",
              description: "Current segment index (-1 = before first section).",
            },
            {
              name: "progress",
              type: "number",
              description: "Progress within current segment (0-1).",
            },
            {
              name: "currentStop",
              type: "WayfarerStop | null",
              description: "Current stop data.",
            },
            {
              name: "nextStop",
              type: "WayfarerStop | null",
              description: "Next stop data.",
            },
          ]}
        />
      </DocsSection>

      <DocsSection title="MapWayfarer">
        <p>
          Component that renders route visualization and controls camera
          following. Must be placed inside a <DocsCode>Map</DocsCode> component.
        </p>

        <DocsPropTable
          props={[
            {
              name: "data",
              type: "WayfarerData",
              description: "Required. Route and stops data.",
            },
            {
              name: "segmentIndex",
              type: "number",
              description: "Required. Current segment from useWayfarerScroll.",
            },
            {
              name: "progress",
              type: "number",
              description: "Required. Progress from useWayfarerScroll.",
            },
            {
              name: "autoZoom",
              type: "boolean",
              default: "true",
              description: "Auto-calculate zoom to fit route segments.",
            },
            {
              name: "damping",
              type: "number",
              default: "0.15",
              description: "Camera movement damping (0-1). Lower = smoother.",
            },
            {
              name: "followCamera",
              type: "boolean",
              default: "true",
              description: "Whether camera should follow progress.",
            },
            {
              name: "routeColor",
              type: "string",
              default: '"#94a3b8"',
              description: "Color of the full route line.",
            },
            {
              name: "routeWidth",
              type: "number",
              default: "3",
              description: "Width of the full route line.",
            },
            {
              name: "routeOpacity",
              type: "number",
              default: "0.5",
              description: "Opacity of the full route line (0-1).",
            },
            {
              name: "routeDashArray",
              type: "[number, number]",
              default: "undefined",
              description: "Dash pattern for route line. Undefined = solid.",
            },
            {
              name: "progressColor",
              type: "string",
              default: '"#3b82f6"',
              description: "Color of the progress line.",
            },
            {
              name: "progressWidth",
              type: "number",
              default: "3",
              description: "Width of the progress line.",
            },
            {
              name: "progressOpacity",
              type: "number",
              default: "1",
              description: "Opacity of the progress line (0-1).",
            },
            {
              name: "progressDashArray",
              type: "[number, number]",
              default: "undefined",
              description: "Dash pattern for progress line. Undefined = solid.",
            },
            {
              name: "showStops",
              type: "boolean",
              default: "false",
              description: "Whether to show built-in stop markers.",
            },
            {
              name: "children",
              type: "ReactNode",
              description: "Custom content (e.g., custom markers).",
            },
          ]}
        />
      </DocsSection>

      <DocsSection title="WayfarerSection">
        <p>
          Marks a content section for scroll tracking. Each section&apos;s id
          must match a stop id in your <DocsCode>WayfarerData</DocsCode>.
        </p>

        <DocsPropTable
          props={[
            {
              name: "id",
              type: "string",
              description: "Required. Must match a stop id in WayfarerData.",
            },
            {
              name: "children",
              type: "ReactNode",
              description: "Section content.",
            },
            {
              name: "className",
              type: "string",
              description: "Additional CSS classes.",
            },
            {
              name: "zoom",
              type: "number",
              description:
                "Override camera zoom level when this section is active.",
            },
            {
              name: "center",
              type: "[number, number]",
              description:
                "Override camera center [lng, lat] when this section is active.",
            },
          ]}
        />
      </DocsSection>

      <DocsSection title="Data Structure">
        <CodeBlock
          code={`interface WayfarerData {
  // Complete route as [lng, lat] coordinate pairs
  line: [number, number][];

  // Stop points along the route
  stops: {
    id: string;                    // Must match WayfarerSection id
    coordinates: [number, number]; // [lng, lat]
    zoom?: number;                 // Optional zoom level
    name?: string;                 // Optional display name
  }[];
}`}
        />
        <p>
          To get accurate route coordinates between stops, you can use the{" "}
          <DocsLink href="https://project-osrm.org/" external>
            OSRM API
          </DocsLink>
          . It provides real driving directions and returns GeoJSON geometry
          that you can use directly as the <DocsCode>line</DocsCode> property.
        </p>
      </DocsSection>
    </DocsLayout>
  );
}
