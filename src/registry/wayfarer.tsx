"use client";

import MapLibreGL from "maplibre-gl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { cn } from "@/lib/utils";
import { useMap } from "@/registry/map";

// ============================================================================
// Types
// ============================================================================

/** A stop point on the wayfarer route */
interface WayfarerStop {
  /** Unique identifier, must match the id of the corresponding WayfarerSection */
  id: string;
  /** [longitude, latitude] coordinates */
  coordinates: [number, number];
  /** Optional zoom level for this stop */
  zoom?: number;
  /** Optional display name */
  name?: string;
}

/** Data structure for the wayfarer route */
interface WayfarerData {
  /** Complete route coordinates as [lng, lat] pairs */
  line: [number, number][];
  /** Stop points along the route */
  stops: WayfarerStop[];
}

/** Parsed data with computed metadata */
interface ParsedWayfarerData extends WayfarerData {
  /** Cumulative distances at each path vertex */
  pathDistances: number[];
  /** Projected distances of each stop on the path */
  stopDistances: number[];
}

// ============================================================================
// Geo Utilities
// ============================================================================

/** Calculate approximate distance between two coordinates */
function getDistance(p1: [number, number], p2: [number, number]): number {
  const dx =
    (p2[0] - p1[0]) * Math.cos(((p1[1] + p2[1]) / 2) * (Math.PI / 180));
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/** Compute path metadata: cumulative distances and stop projections */
function computePathMetadata(data: WayfarerData): ParsedWayfarerData {
  if (data.line.length < 2) {
    return {
      ...data,
      pathDistances: [0],
      stopDistances: data.stops.map(() => 0),
    };
  }

  const line = data.line;
  const pathDistances: number[] = [0];
  let totalDist = 0;

  // Compute cumulative distances along the path
  for (let i = 0; i < line.length - 1; i++) {
    totalDist += getDistance(line[i], line[i + 1]);
    pathDistances.push(totalDist);
  }

  // Project each stop onto the path
  const stopDistances: number[] = [];
  let searchStart = 0;

  for (const stop of data.stops) {
    const coord = stop.coordinates;
    let minDist = Infinity;
    let bestDistOnPath = 0;
    let bestSegIndex = searchStart;

    // Search for the nearest point on the path
    for (let i = Math.max(0, searchStart - 20); i < line.length - 1; i++) {
      const p1 = line[i];
      const p2 = line[i + 1];
      const segLen = pathDistances[i + 1] - pathDistances[i];
      if (segLen === 0) continue;

      // Project point onto segment
      const dx =
        (p2[0] - p1[0]) * Math.cos(((p1[1] + p2[1]) / 2) * (Math.PI / 180));
      const dy = p2[1] - p1[1];
      const pdx =
        (coord[0] - p1[0]) *
        Math.cos(((p1[1] + coord[1]) / 2) * (Math.PI / 180));
      const pdy = coord[1] - p1[1];
      const dot = pdx * dx + pdy * dy;
      const t = Math.max(0, Math.min(1, dot / (dx * dx + dy * dy)));

      const projX = p1[0] + (p2[0] - p1[0]) * t;
      const projY = p1[1] + (p2[1] - p1[1]) * t;
      const distToLine = getDistance(coord, [projX, projY]);

      if (distToLine < minDist) {
        minDist = distToLine;
        bestDistOnPath =
          pathDistances[i] + t * (pathDistances[i + 1] - pathDistances[i]);
        bestSegIndex = i;
      }
    }

    stopDistances.push(bestDistOnPath);
    searchStart = bestSegIndex;
  }

  return { ...data, pathDistances, stopDistances };
}

/** Get coordinates for the progress line up to the current position */
function getProgressCoordinates(
  data: ParsedWayfarerData,
  segmentIndex: number,
  progress: number,
): [number, number][] {
  if (segmentIndex < 0) return [];

  const { line, pathDistances, stopDistances } = data;

  // Calculate target distance
  const startDist = stopDistances[segmentIndex] ?? 0;
  const endDist =
    stopDistances[segmentIndex + 1] ?? pathDistances[pathDistances.length - 1];
  const targetDist = startDist + (endDist - startDist) * progress;

  // Build coordinates up to target
  const coords: [number, number][] = [];

  // Find the segment containing target distance
  let splitIndex = 0;
  for (let i = 0; i < pathDistances.length - 1; i++) {
    if (pathDistances[i + 1] > targetDist) {
      splitIndex = i;
      break;
    }
    splitIndex = i;
  }

  // Add all vertices up to split point
  for (let i = 0; i <= splitIndex; i++) {
    coords.push(line[i]);
  }

  // Add interpolated point
  const segStartDist = pathDistances[splitIndex];
  const segEndDist = pathDistances[splitIndex + 1] ?? segStartDist;
  const segLen = segEndDist - segStartDist;

  if (segLen > 0) {
    const fraction = Math.max(
      0,
      Math.min(1, (targetDist - segStartDist) / segLen),
    );
    const p1 = line[splitIndex];
    const p2 = line[splitIndex + 1];
    if (p2) {
      coords.push([
        p1[0] + (p2[0] - p1[0]) * fraction,
        p1[1] + (p2[1] - p1[1]) * fraction,
      ]);
    }
  }

  return coords;
}

/** Calculate bounds for a set of coordinates */
function getBounds(
  coordinates: [number, number][],
): [[number, number], [number, number]] | null {
  if (coordinates.length === 0) return null;

  let minLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLng = coordinates[0][0];
  let maxLat = coordinates[0][1];

  for (const [lng, lat] of coordinates) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

/** Get coordinates for a segment between two stops */
function getSegmentCoordinates(
  data: ParsedWayfarerData,
  segmentIndex: number,
): [number, number][] {
  if (segmentIndex < 0 || segmentIndex >= data.stops.length) return [];

  const { line, pathDistances, stopDistances } = data;
  const startDist = stopDistances[segmentIndex];
  const endDist =
    stopDistances[segmentIndex + 1] ?? pathDistances[pathDistances.length - 1];

  const coords: [number, number][] = [];

  for (let i = 0; i < pathDistances.length; i++) {
    if (pathDistances[i] >= startDist && pathDistances[i] <= endDist) {
      coords.push(line[i]);
    }
  }

  return coords;
}

// ============================================================================
// useWayfarerScroll Hook
// ============================================================================

interface UseWayfarerScrollOptions {
  /** The wayfarer data containing route and stops */
  data: WayfarerData;
  /**
   * Reference to the scroll container element.
   * If not provided, defaults to window scroll.
   */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** CSS selector for section elements. Default: \".mapcn-wayfarer-section\" */
  sectionSelector?: string;
  /** Trigger line position as ratio from top (0-1). Default: 0.2 */
  triggerRatio?: number;
}

interface UseWayfarerScrollResult {
  /** Current segment index (-1 = before first section) */
  segmentIndex: number;
  /** Progress within current segment (0-1) */
  progress: number;
  /** Current stop data, or null if before first section */
  currentStop: WayfarerStop | null;
  /** Next stop data, or null if at last section */
  nextStop: WayfarerStop | null;
  /** Zoom override from current WayfarerSection, if set */
  sectionZoom: number | null;
  /** Center override from current WayfarerSection, if set */
  sectionCenter: [number, number] | null;
}

/**
 * Hook to track scroll progress through wayfarer sections.
 *
 * @example
 * ```tsx
 * const scrollRef = useRef<HTMLDivElement>(null);
 * const { segmentIndex, progress } = useWayfarerScroll({
 *   data: travelData,
 *   scrollContainerRef: scrollRef,
 * });
 * ```
 */
function useWayfarerScroll({
  data,
  scrollContainerRef,
  sectionSelector = ".mapcn-wayfarer-section",
  triggerRatio = 0.2,
}: UseWayfarerScrollOptions): UseWayfarerScrollResult {
  const [segmentIndex, setSegmentIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [sectionZoom, setSectionZoom] = useState<number | null>(null);
  const [sectionCenter, setSectionCenter] = useState<[number, number] | null>(
    null,
  );

  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef?.current;

      // Determine the search root for sections
      const searchRoot = container ?? document;
      const sections = Array.from(
        searchRoot.querySelectorAll<HTMLElement>(sectionSelector),
      );

      if (sections.length === 0) return;

      // Calculate viewport and trigger line
      const viewportHeight = container?.clientHeight ?? window.innerHeight;
      const containerTop = container?.getBoundingClientRect().top ?? 0;
      const triggerY = containerTop + viewportHeight * triggerRatio;

      // Check if scrolled to top
      const scrollTop = container?.scrollTop ?? window.scrollY;
      if (scrollTop <= 0) {
        setSegmentIndex(-1);
        setProgress(0);
        return;
      }

      let currentIndex = -1;
      let currentProgress = 0;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const rect = section.getBoundingClientRect();

        // If this section hasn't reached the trigger line yet
        if (rect.top > triggerY) {
          if (i === 0) {
            currentIndex = -1;
            currentProgress = 0;
          } else {
            currentIndex = i - 1;
            const prevRect = sections[i - 1].getBoundingClientRect();
            const distance = rect.top - prevRect.top;
            const scrolled = triggerY - prevRect.top;
            currentProgress = Math.max(0, Math.min(1, scrolled / distance));
          }
          break;
        }

        // At last section
        if (i === sections.length - 1) {
          currentIndex = i;
          currentProgress = 1;
        }
      }

      setSegmentIndex(currentIndex);
      setProgress(currentProgress);

      // Read section-level zoom/center overrides from data attributes
      const activeSection = currentIndex >= 0 ? sections[currentIndex] : null;
      if (activeSection) {
        const zoomAttr = activeSection.getAttribute("data-wayfarer-zoom");
        setSectionZoom(zoomAttr ? Number(zoomAttr) : null);

        const centerAttr = activeSection.getAttribute("data-wayfarer-center");
        if (centerAttr) {
          try {
            setSectionCenter(JSON.parse(centerAttr) as [number, number]);
          } catch {
            setSectionCenter(null);
          }
        } else {
          setSectionCenter(null);
        }
      } else {
        setSectionZoom(null);
        setSectionCenter(null);
      }
    };

    // Determine scroll target
    const scrollTarget = scrollContainerRef?.current ?? window;

    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial call

    return () => {
      scrollTarget.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerRef, sectionSelector, triggerRatio]);

  const currentStop =
    segmentIndex >= 0 ? (data.stops[segmentIndex] ?? null) : null;
  const nextStop =
    segmentIndex >= 0 ? (data.stops[segmentIndex + 1] ?? null) : null;

  return {
    segmentIndex,
    progress,
    currentStop,
    nextStop,
    sectionZoom,
    sectionCenter,
  };
}

// ============================================================================
// useMapWayfarer Convenience Hook
// ============================================================================

interface UseMapWayfarerResult extends UseWayfarerScrollResult {
  /** Props object to spread directly onto MapWayfarer */
  wayfarerProps: Pick<
    MapWayfarerProps,
    "data" | "segmentIndex" | "progress" | "sectionZoom" | "sectionCenter"
  >;
}

/**
 * Convenience hook that combines useWayfarerScroll with prop binding.
 *
 * Eliminates the need to manually pass segmentIndex and progress to MapWayfarer.
 *
 * @example
 * ```tsx
 * const { wayfarerProps, currentStop } = useMapWayfarer({ data, scrollContainerRef });
 *
 * <Map>
 *   <MapWayfarer {...wayfarerProps} />
 * </Map>
 * ```
 */
function useMapWayfarer(
  options: UseWayfarerScrollOptions,
): UseMapWayfarerResult {
  const scrollResult = useWayfarerScroll(options);

  const wayfarerProps = useMemo(
    () => ({
      data: options.data,
      segmentIndex: scrollResult.segmentIndex,
      progress: scrollResult.progress,
      sectionZoom: scrollResult.sectionZoom,
      sectionCenter: scrollResult.sectionCenter,
    }),
    [
      options.data,
      scrollResult.segmentIndex,
      scrollResult.progress,
      scrollResult.sectionZoom,
      scrollResult.sectionCenter,
    ],
  );

  return { ...scrollResult, wayfarerProps };
}

// ============================================================================
// WayfarerContext (for children access)
// ============================================================================

interface WayfarerContextValue {
  data: ParsedWayfarerData;
  segmentIndex: number;
  progress: number;
}

const WayfarerContext = createContext<WayfarerContextValue | null>(null);

/** Hook to access wayfarer state from child components */
function useWayfarer() {
  const context = useContext(WayfarerContext);
  if (!context) {
    throw new Error("useWayfarer must be used within a MapWayfarer component");
  }
  return context;
}

// ============================================================================
// MapWayfarer Component
// ============================================================================

interface MapWayfarerProps {
  /** Wayfarer route and stops data */
  data: WayfarerData;
  /** Current segment index from useWayfarerScroll */
  segmentIndex: number;
  /** Progress within current segment (0-1) from useWayfarerScroll */
  progress: number;
  /** Zoom override from current WayfarerSection */
  sectionZoom?: number | null;
  /** Center override from current WayfarerSection */
  sectionCenter?: [number, number] | null;
  /** Auto-calculate zoom to fit route segments. Default: true */
  autoZoom?: boolean;
  /** Camera movement damping (0-1). Lower = smoother. Default: 0.15 */
  damping?: number;
  /** Whether camera should follow progress. Default: true */
  followCamera?: boolean;
  /** Padding for auto-zoom bounds calculation. Default: 50 */
  padding?:
    | number
    | { top: number; bottom: number; left: number; right: number };
  /** Color of the full route line. Default: "#a3a3a3" (dark: "#737373") */
  routeColor?: string;
  /** Width of the full route line. Default: 3 */
  routeWidth?: number;
  /** Opacity of the full route line (0-1). Default: 0.5 */
  routeOpacity?: number;
  /** Dash pattern for route line. Undefined = solid line. Default: undefined */
  routeDashArray?: [number, number];
  /** Color of the progress line. Default: "#3b82f6" (dark: "#60a5fa") */
  progressColor?: string;
  /** Width of the progress line. Default: 3 */
  progressWidth?: number;
  /** Opacity of the progress line (0-1). Default: 1 */
  progressOpacity?: number;
  /** Dash pattern for progress line. Undefined = solid line. Default: undefined */
  progressDashArray?: [number, number];
  /** Whether to show built-in stop markers. Default: false */
  showStops?: boolean;
  /** Color of stop markers (if showStops=true). Default: "#ef4444" */
  stopColor?: string;
  /** Size of stop markers (if showStops=true). Default: 5 */
  stopRadius?: number;
  /** Custom content to render (e.g., custom markers) */
  children?: ReactNode;
}

/**
 * MapWayfarer - Scroll-driven map storytelling component.
 *
 * Renders route visualization layers and controls camera following
 * based on scroll progress through WayfarerSection elements.
 * Must be placed inside a Map component.
 *
 * @example
 * ```tsx
 * const { segmentIndex, progress } = useWayfarerScroll({ data });
 *
 * <Map>
 *   <MapWayfarer
 *     data={data}
 *     segmentIndex={segmentIndex}
 *     progress={progress}
 *   />
 * </Map>
 * ```
 */
function MapWayfarer({
  data,
  segmentIndex,
  progress,
  sectionZoom,
  sectionCenter,
  autoZoom = true,
  damping = 0.15,
  followCamera = true,
  padding = 50,
  routeColor,
  routeWidth = 3,
  routeOpacity = 0.5,
  routeDashArray,
  progressColor,
  progressWidth = 3,
  progressOpacity = 1,
  progressDashArray,
  showStops = false,
  stopColor,
  stopRadius = 5,
  children,
}: MapWayfarerProps) {
  // Use the map context from map.tsx
  const { map, isLoaded } = useMap();

  const id = useId();
  const routeSourceId = `wayfarer-route-${id}`;
  const routeLayerId = `wayfarer-route-layer-${id}`;
  const progressSourceId = `wayfarer-progress-${id}`;
  const progressLayerId = `wayfarer-progress-layer-${id}`;
  const stopsSourceId = `wayfarer-stops-${id}`;
  const stopsLayerId = `wayfarer-stops-layer-${id}`;

  // Parse data with metadata
  const parsedData = useMemo(() => computePathMetadata(data), [data]);

  // Camera following state
  const targetCenterRef = useRef<[number, number] | null>(null);
  const targetZoomRef = useRef<number | null>(null);
  const currentCenterRef = useRef<[number, number] | null>(null);
  const currentZoomRef = useRef<number | null>(null);
  const isUserInteractingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Track previous segment for transition detection
  const prevSegmentRef = useRef(segmentIndex);

  // Detect theme (consistent with map.tsx)
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    if (document.documentElement.classList.contains("dark")) return "dark";
    if (document.documentElement.classList.contains("light")) return "light";
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return "light";
  });

  useEffect(() => {
    // Watch for document class changes (e.g., next-themes toggling dark class)
    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains("dark")) {
        setResolvedTheme("dark");
      } else if (document.documentElement.classList.contains("light")) {
        setResolvedTheme("light");
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also watch for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      const docHasClass =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.classList.contains("light");
      if (!docHasClass) {
        setResolvedTheme(e.matches ? "dark" : "light");
      }
    };
    mediaQuery.addEventListener("change", handleSystemChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleSystemChange);
    };
  }, []);

  const isDark = resolvedTheme === "dark";

  // Resolve colors - route uses #94a3b8 (slate-400) like Route Planning example
  const resolvedRouteColor = routeColor ?? "#94a3b8";
  const resolvedProgressColor =
    progressColor ?? (isDark ? "#60a5fa" : "#3b82f6");
  const resolvedStopColor = stopColor ?? (isDark ? "#f87171" : "#ef4444");

  // Calculate best zoom for a segment
  const calculateBestZoom = useCallback(
    (mapInstance: MapLibreGL.Map, segIdx: number): number => {
      const coords = getSegmentCoordinates(parsedData, segIdx);
      if (coords.length === 0) return 14;

      const bounds = getBounds(coords);
      if (!bounds) return 14;

      const paddingValue =
        typeof padding === "number"
          ? { top: padding, bottom: padding, left: padding, right: padding }
          : padding;

      const camera = mapInstance.cameraForBounds(bounds, {
        padding: paddingValue,
      });
      return Math.max(10, Math.min(camera?.zoom ?? 12, 16));
    },
    [parsedData, padding],
  );

  // Add layers on mount
  useEffect(() => {
    if (!isLoaded || !map) return;

    // Route source and layer (dashed line)
    map.addSource(routeSourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      },
    });

    map.addLayer({
      id: routeLayerId,
      type: "line",
      source: routeSourceId,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": resolvedRouteColor,
        "line-width": routeWidth,
        "line-opacity": routeOpacity,
        ...(routeDashArray && { "line-dasharray": routeDashArray }),
      },
    });

    // Progress source and layer (solid line)
    map.addSource(progressSourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      },
    });

    map.addLayer({
      id: progressLayerId,
      type: "line",
      source: progressSourceId,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": resolvedProgressColor,
        "line-width": progressWidth,
        "line-opacity": progressOpacity,
        ...(progressDashArray && { "line-dasharray": progressDashArray }),
      },
    });

    // Stops source and layer (circles)
    if (showStops) {
      map.addSource(stopsSourceId, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: parsedData.stops.map((stop) => ({
            type: "Feature" as const,
            properties: { id: stop.id, name: stop.name },
            geometry: { type: "Point" as const, coordinates: stop.coordinates },
          })),
        },
      });

      map.addLayer({
        id: stopsLayerId,
        type: "circle",
        source: stopsSourceId,
        paint: {
          "circle-radius": stopRadius,
          "circle-color": resolvedStopColor,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    return () => {
      try {
        if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
        if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);
        if (map.getLayer(progressLayerId)) map.removeLayer(progressLayerId);
        if (map.getSource(progressSourceId)) map.removeSource(progressSourceId);
        if (map.getLayer(stopsLayerId)) map.removeLayer(stopsLayerId);
        if (map.getSource(stopsSourceId)) map.removeSource(stopsSourceId);
      } catch {
        // Ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map]);

  // Update route data when parsedData changes
  useEffect(() => {
    if (!isLoaded || !map) return;

    const routeSource = map.getSource(
      routeSourceId,
    ) as MapLibreGL.GeoJSONSource;
    if (routeSource) {
      routeSource.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: parsedData.line },
      });
    }
  }, [isLoaded, map, parsedData.line, routeSourceId]);

  // Track user interaction
  useEffect(() => {
    if (!map) return;

    const handleMoveStart = (e: { originalEvent?: Event }) => {
      if (e.originalEvent) {
        isUserInteractingRef.current = true;
      }
    };

    const handleMoveEnd = () => {
      if (map) {
        const center = map.getCenter();
        currentCenterRef.current = [center.lng, center.lat];
        currentZoomRef.current = map.getZoom();
      }
    };

    map.on("movestart", handleMoveStart);
    map.on("moveend", handleMoveEnd);

    return () => {
      map.off("movestart", handleMoveStart);
      map.off("moveend", handleMoveEnd);
    };
  }, [map]);

  // Animation loop for smooth camera following
  useEffect(() => {
    if (!map || !followCamera) return;

    const EPSILON = 0.000001;

    const animate = () => {
      if (!map || isUserInteractingRef.current) {
        rafIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const tCenter = targetCenterRef.current;
      const tZoom = targetZoomRef.current;

      if (tCenter && tZoom !== null) {
        // Initialize current state
        if (!currentCenterRef.current) {
          const center = map.getCenter();
          currentCenterRef.current = [center.lng, center.lat];
        }
        if (currentZoomRef.current === null) {
          currentZoomRef.current = map.getZoom();
        }

        const dLng = tCenter[0] - currentCenterRef.current[0];
        const dLat = tCenter[1] - currentCenterRef.current[1];
        const dZoom = tZoom - currentZoomRef.current;

        if (
          Math.abs(dLng) > EPSILON ||
          Math.abs(dLat) > EPSILON ||
          Math.abs(dZoom) > EPSILON
        ) {
          const newLng = currentCenterRef.current[0] + dLng * damping;
          const newLat = currentCenterRef.current[1] + dLat * damping;
          const newZoom = currentZoomRef.current + dZoom * damping;

          currentCenterRef.current = [newLng, newLat];
          currentZoomRef.current = newZoom;

          map.jumpTo({
            center: currentCenterRef.current,
            zoom: currentZoomRef.current,
          });
        }
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [map, followCamera, damping]);

  // Update progress line and camera target
  useEffect(() => {
    if (!isLoaded || !map) return;

    // Update progress line
    const progressCoords = getProgressCoordinates(
      parsedData,
      segmentIndex,
      progress,
    );
    const progressSource = map.getSource(
      progressSourceId,
    ) as MapLibreGL.GeoJSONSource;
    if (progressSource) {
      progressSource.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: progressCoords.length >= 2 ? progressCoords : [],
        },
      });
    }

    // Calculate camera target
    if (followCamera) {
      // Determine effective center: section override > progress head > initial
      let effectiveCenter: [number, number] | undefined;

      if (sectionCenter) {
        // Section-level center override takes priority
        effectiveCenter = sectionCenter;
      } else if (progressCoords.length > 0) {
        effectiveCenter = progressCoords[progressCoords.length - 1];
      } else if (segmentIndex < 0) {
        effectiveCenter =
          parsedData.stops[0]?.coordinates ?? parsedData.line[0];
      }

      // Resume following if target changed
      if (targetCenterRef.current && effectiveCenter) {
        const dLng = Math.abs(targetCenterRef.current[0] - effectiveCenter[0]);
        const dLat = Math.abs(targetCenterRef.current[1] - effectiveCenter[1]);
        if (dLng > 0.000001 || dLat > 0.000001) {
          isUserInteractingRef.current = false;
        }
      }

      // Set target center
      if (effectiveCenter) {
        targetCenterRef.current = effectiveCenter;
      }

      // Set target zoom: section override > stop zoom > auto-calculated
      if (sectionZoom !== null && sectionZoom !== undefined) {
        targetZoomRef.current = sectionZoom;
      } else if (autoZoom && segmentIndex >= 0) {
        const currentStop = parsedData.stops[segmentIndex];
        const nextStop = parsedData.stops[segmentIndex + 1];

        const zoomA = currentStop?.zoom ?? calculateBestZoom(map, segmentIndex);
        const zoomB =
          nextStop?.zoom ??
          (segmentIndex + 1 < parsedData.stops.length
            ? calculateBestZoom(map, segmentIndex + 1)
            : zoomA);

        targetZoomRef.current = zoomA + (zoomB - zoomA) * progress;
      } else if (segmentIndex < 0) {
        targetZoomRef.current = autoZoom
          ? calculateBestZoom(map, 0)
          : (parsedData.stops[0]?.zoom ?? 12);
      }
    }

    prevSegmentRef.current = segmentIndex;
  }, [
    isLoaded,
    map,
    parsedData,
    segmentIndex,
    progress,
    progressSourceId,
    followCamera,
    autoZoom,
    calculateBestZoom,
    sectionZoom,
    sectionCenter,
  ]);

  // Context value for children
  const contextValue = useMemo(
    () => ({ data: parsedData, segmentIndex, progress }),
    [parsedData, segmentIndex, progress],
  );

  return (
    <WayfarerContext.Provider value={contextValue}>
      {children}
    </WayfarerContext.Provider>
  );
}

// ============================================================================
// WayfarerSection Component
// ============================================================================

interface WayfarerSectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Unique identifier, must match a stop id in WayfarerData */
  id: string;
  /** Section content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Override zoom level when this section is active */
  zoom?: number;
  /** Override camera center [lng, lat] when this section is active */
  center?: [number, number];
}

/**
 * WayfarerSection - Marks a content section for scroll tracking.
 *
 * Place these in your scrollable content area. Each section's id
 * should match a stop id in your WayfarerData.
 *
 * Optionally override `zoom` and `center` to temporarily redirect
 * the camera away from the route path for this section.
 *
 * @example
 * ```tsx
 * <WayfarerSection id="paris" className="min-h-screen">
 *   <h1>Paris</h1>
 *   <p>The city of lights...</p>
 * </WayfarerSection>
 *
 * // Override camera for a detour
 * <WayfarerSection id="detour" zoom={14} center={[2.2945, 48.8584]}>
 *   <h1>Eiffel Tower Close-up</h1>
 * </WayfarerSection>
 * ```
 */
function WayfarerSection({
  id,
  children,
  className,
  zoom,
  center,
  ...props
}: WayfarerSectionProps) {
  return (
    <section
      id={id}
      className={cn("mapcn-wayfarer-section", className)}
      data-wayfarer-zoom={zoom}
      data-wayfarer-center={center ? JSON.stringify(center) : undefined}
      {...props}
    >
      {children}
    </section>
  );
}

// ============================================================================
// Exports
// ============================================================================

export {
  MapWayfarer,
  WayfarerSection,
  useWayfarerScroll,
  useMapWayfarer,
  useWayfarer,
};

export type {
  WayfarerData,
  WayfarerStop,
  MapWayfarerProps,
  WayfarerSectionProps,
  UseWayfarerScrollOptions,
  UseWayfarerScrollResult,
  UseMapWayfarerResult,
};
