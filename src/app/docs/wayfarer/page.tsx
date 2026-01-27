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

const usageCode = `import { Map } from "@/components/ui/map";
import {
  MapWayfarer,
  WayfarerSection,
  useWayfarerScroll
} from "@/components/ui/wayfarer";

const data = {
  line: [[-122.41, 37.77], [-118.24, 34.05], [-117.16, 32.71]],
  stops: [
    { id: "sf", coordinates: [-122.41, 37.77], zoom: 12 },
    { id: "la", coordinates: [-118.24, 34.05], zoom: 12 },
    { id: "sd", coordinates: [-117.16, 32.71], zoom: 12 },
  ],
};

function TravelStory() {
  const scrollRef = useRef(null);

  const { segmentIndex, progress } = useWayfarerScroll({
    data,
    scrollContainerRef: scrollRef,
  });

  return (
    <div className="flex h-screen">
      <div className="w-1/2 h-full">
        <Map>
          <MapWayfarer
            data={data}
            segmentIndex={segmentIndex}
            progress={progress}
          />
        </Map>
      </div>

      <div ref={scrollRef} className="w-1/2 h-full overflow-y-auto">
        <WayfarerSection id="sf">San Francisco</WayfarerSection>
        <WayfarerSection id="la">Los Angeles</WayfarerSection>
        <WayfarerSection id="sd">San Diego</WayfarerSection>
      </div>
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
          This component is designed for <strong>long-form scrollable content</strong>,
          such as travel journals, guided tours, or route narratives. The scroll
          position determines which section is active and how far along the route
          the user has progressed.
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
        <p>
          The Wayfarer system consists of three main parts:
        </p>
        <ul>
          <li>
            <DocsCode>useWayfarerScroll</DocsCode> — Hook that tracks scroll
            progress
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

      <ComponentPreview code={wayfarerSource} >
        <WayfarerExample />
      </ComponentPreview>

      <DocsNote>
        <strong>Note:</strong> When the user manually drags or zooms the map,
        camera following is automatically paused. Following resumes when the
        user continues scrolling.
      </DocsNote>

      <DocsSection title="useWayfarerScroll">
        <p>
          Hook that monitors scroll position and calculates which section is
          currently active.
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
              description:
                "Position of trigger line as ratio from top (0-1).",
            },
          ]}
        />

        <h4 className="font-medium mt-6 mb-2">Returns</h4>
        <DocsPropTable
          props={[
            {
              name: "segmentIndex",
              type: "number",
              description:
                "Current segment index (-1 = before first section).",
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
              description: "Override zoom level for this section.",
            },
            {
              name: "center",
              type: "[number, number]",
              description: "Override center point for this section.",
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
