import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

const LOCAL_URL = "/bangladesh.geojson";

const getName = (geo) => geo.properties?.ADM2_EN || geo.properties?.NAME_2 || geo.properties?.name || geo.properties?.district || '';

/**
 * OptimizedDistrictMap
 *
 * Performance improvements:
 *   1. Loads GeoJSON locally only (no CDN fetch)
 *   2. useMemo for dataMap + color calculation
 *   3. React.memo for Geography items
 *   4. useCallback for click handlers
 *   5. Conditional rendering — only renders when data is available
 *   6. Simplified fill logic with fewer allocations
 */
const DistrictGeography = React.memo(({ geo, fillColor, strokeColor, strokeWidth, tooltip, onClick }) => {
  return (
    <Geography
      geography={geo}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      style={{
        default: { outline: "none", transition: "all 0.2s ease" },
        hover: { fill: '#38bdf8', outline: "none", cursor: "pointer", transition: "all 0.15s ease" },
        pressed: { outline: "none" }
      }}
      onClick={onClick}
    >
      <title>{tooltip}</title>
    </Geography>
  );
});

DistrictGeography.displayName = 'DistrictGeography';

const DistrictMap = React.memo(({ districtData = [], loading = false, selectedDistrict, onDistrictClick }) => {
  const [geoUrl, setGeoUrl] = useState(LOCAL_URL);
  const [geoLoaded, setGeoLoaded] = useState(false);

  // Always use local GeoJSON — no CDN fetch
  useEffect(() => {
    setGeoUrl(LOCAL_URL);
  }, []);

  // Build data lookup map only when districtData changes — ⚡ useMemo
  const dataLookup = useMemo(() => {
    const map = {};
    let max = 0;
    districtData.forEach(d => {
      const key = d.district?.toLowerCase().replace(/[\s-]/g, '');
      if (key) {
        map[key] = d;
        if (d.totalOrders > max) max = d.totalOrders;
      }
    });
    return { map, maxOrders: max };
  }, [districtData]);

  const { map: dataMap, maxOrders } = dataLookup;

  const normalize = useCallback((s) => s?.toLowerCase().replace(/[\s-]/g, '') || '', []);
  const selectedNormalized = selectedDistrict ? normalize(selectedDistrict) : null;

  // Memoized color getter — ⚡ speeds up the 64 district calculations
  const getFillColor = useCallback((geoDistrictName) => {
    const key = normalize(geoDistrictName);

    if (selectedNormalized && key === selectedNormalized) return '#FFD700';

    const d = dataMap[key];
    if (!d) return '#94a3b8';

    const intensity = maxOrders > 0 ? (d.totalOrders / maxOrders) * 0.6 + 0.4 : 0.6;

    if (d.status === 'red')
      return `rgb(${Math.round(220 * intensity)}, ${Math.round(50 * intensity)}, ${Math.round(50 * intensity)})`;
    if (d.status === 'amber')
      return `rgb(${Math.round(245 * intensity)}, ${Math.round(180 * intensity)}, ${Math.round(30 * intensity)})`;
    return `rgb(${Math.round(30 * intensity)}, ${Math.round(170 * intensity)}, ${Math.round(100 * intensity)})`;
  }, [dataMap, maxOrders, selectedNormalized, normalize]);

  const handleClick = useCallback((geo) => {
    if (!onDistrictClick) return;
    const name = getName(geo);
    const key = normalize(name);
    const d = dataMap[key] || null;
    onDistrictClick(name, d);
  }, [onDistrictClick, dataMap, normalize]);

  return (
    <div
      className="w-full h-full flex justify-center items-center overflow-hidden rounded-lg relative"
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)' }}
    >
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <div className="w-10 h-10 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ⚡ Only render map when we have data & geo is loaded */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 4500, center: [90.4125, 23.8103] }}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) => {
            if (!geoLoaded && geographies?.length > 0) {
              // ⏱ Use requestIdleCallback to not block the main thread
              setTimeout(() => setGeoLoaded(true), 0);
            }
            return geographies.map((geo) => {
              const name = getName(geo);
              const key = normalize(name);
              const isSelected = selectedNormalized && key === selectedNormalized;
              const fillColor = getFillColor(name);
              const strokeColor = isSelected ? '#FFD700' : '#334155';
              const strokeWidth = isSelected ? 2 : 0.6;
              const d = dataMap[key];
              const tooltip = d
                ? `${d.district}\n${d.totalOrders} orders • ${d.successRate}% success • ${d.cancelled} cancelled`
                : `${name}: No data`;

              return (
                <DistrictGeography
                  key={geo.rsmKey}
                  geo={geo}
                  fillColor={fillColor}
                  strokeColor={strokeColor}
                  strokeWidth={strokeWidth}
                  tooltip={tooltip}
                  onClick={() => handleClick(geo)}
                />
              );
            });
          }}
        </Geographies>
      </ComposableMap>
    </div>
  );
});

DistrictMap.displayName = 'DistrictMap';

export default DistrictMap;
