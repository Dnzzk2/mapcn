"use client";

import { useEffect, useRef, useState } from "react";
import { Map, MapMarker, MarkerContent, MarkerTooltip } from "@/registry/map";
import {
  MapWayfarer,
  WayfarerSection,
  useMapWayfarer,
  type WayfarerData,
  type WayfarerStop,
} from "@/registry/wayfarer";

const STOPS: WayfarerStop[] = [
  {
    id: "san-francisco",
    coordinates: [-122.4194, 37.7749],
    zoom: 5,
    name: "San Francisco",
  },
  {
    id: "san-luis-obispo",
    coordinates: [-120.6536, 35.2828],
    zoom: 6,
    name: "San Luis Obispo",
  },
  {
    id: "los-angeles",
    coordinates: [-118.2437, 34.0522],
    zoom: 6,
    name: "Los Angeles",
  },
  {
    id: "san-diego",
    coordinates: [-117.1611, 32.7157],
    zoom: 6,
    name: "San Diego",
  },
];

/** Fetch driving route from OSRM and adapt to WayfarerData */
async function fetchRoute(stops: WayfarerStop[]): Promise<WayfarerData> {
  const waypoints = stops
    .map((s) => `${s.coordinates[0]},${s.coordinates[1]}`)
    .join(";");
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`,
  );
  const data = await res.json();
  const line: [number, number][] = data.routes[0].geometry.coordinates;
  return { line, stops };
}

export function WayfarerExample() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<WayfarerData | null>(null);

  useEffect(() => {
    fetchRoute(STOPS).then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-125 w-full items-center justify-center rounded-b-lg border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading route data...
        </div>
      </div>
    );
  }

  return (
    <WayfarerExampleInner data={data} scrollContainerRef={scrollContainerRef} />
  );
}

function WayfarerExampleInner({
  data,
  scrollContainerRef,
}: {
  data: WayfarerData;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { wayfarerProps, currentStop, segmentIndex, progress } = useMapWayfarer(
    {
      data,
      scrollContainerRef,
    },
  );

  return (
    <div className="relative min-h-125 w-full overflow-hidden rounded-b-lg border">
      {/* Status display */}
      <div className="absolute top-3 left-3 z-20 rounded-md bg-background/90 backdrop-blur px-3 py-2 text-xs font-mono border">
        <div>Segment: {segmentIndex}</div>
        <div>Progress: {(progress * 100).toFixed(1)}%</div>
        <div>Current: {currentStop?.name ?? "—"}</div>
      </div>

      {/* Map (left half) */}
      <div className="absolute inset-y-0 left-0 w-1/2">
        <Map center={[-119.5, 35.5]} zoom={5}>
          <MapWayfarer {...wayfarerProps} autoZoom={false} damping={0.12}>
            {data.stops.map((stop, index) => (
              <MapMarker
                key={stop.id}
                longitude={stop.coordinates[0]}
                latitude={stop.coordinates[1]}
              >
                <MarkerContent>
                  <div className="size-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold">
                    {index + 1}
                  </div>
                </MarkerContent>
                <MarkerTooltip>{stop.name}</MarkerTooltip>
              </MapMarker>
            ))}
          </MapWayfarer>
        </Map>
      </div>

      {/* Scrollable content (right half) */}
      <div
        ref={scrollContainerRef}
        className="absolute inset-y-0 right-0 w-1/2 overflow-y-auto bg-linear-to-b from-muted/50 to-muted"
      >
        <div className="h-24" />

        <WayfarerSection
          id="san-francisco"
          className="min-h-75 flex items-start px-6 py-8"
        >
          <div className="bg-background rounded-lg p-6 shadow-lg border max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="size-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                1
              </span>
              <h2 className="text-xl font-semibold">San Francisco</h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Start your journey in the City by the Bay. Walk across the Golden
              Gate Bridge, explore Fisherman&apos;s Wharf, and ride the iconic
              cable cars.
            </p>
          </div>
        </WayfarerSection>

        <WayfarerSection
          id="san-luis-obispo"
          className="min-h-75 flex items-start px-6 py-8"
        >
          <div className="bg-background rounded-lg p-6 shadow-lg border max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="size-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                2
              </span>
              <h2 className="text-xl font-semibold">San Luis Obispo</h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A charming college town halfway down the coast. Stop by the famous
              Bubblegum Alley and enjoy local wineries.
            </p>
          </div>
        </WayfarerSection>

        <WayfarerSection
          id="los-angeles"
          className="min-h-75 flex items-start px-6 py-8"
        >
          <div className="bg-background rounded-lg p-6 shadow-lg border max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="size-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                3
              </span>
              <h2 className="text-xl font-semibold">Los Angeles</h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The City of Angels awaits. Visit Hollywood, stroll along Venice
              Beach, and catch a sunset at Santa Monica Pier.
            </p>
          </div>
        </WayfarerSection>

        <WayfarerSection
          id="san-diego"
          className="min-h-75 flex items-start px-6 py-8"
        >
          <div className="bg-background rounded-lg p-6 shadow-lg border max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <span className="size-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                4
              </span>
              <h2 className="text-xl font-semibold">San Diego</h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              End your road trip in sunny San Diego. Explore the world-famous
              Zoo, relax at La Jolla Cove, and enjoy the Gaslamp Quarter.
            </p>
          </div>
        </WayfarerSection>

        <div className="h-32" />
      </div>
    </div>
  );
}
