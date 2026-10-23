import { useCallback, useState } from 'react';

// The public map's optional layers. Off by default so the map opens plain and light; each one is
// downloaded only the first time it is switched on. The visitor's choice is remembered on this device.

export interface MapLayers {
  /** Weather, sky, light on the water, wildlife, flags and carts. */
  environment: boolean;
  /** The course sponsors' signs and their pins. */
  sponsors: boolean;
  /** Hole-by-hole badges, the hole you are on, and the hole cards. */
  holes: boolean;
}

const KEY = 'zion-map-layers';
const DEFAULTS: MapLayers = { environment: false, sponsors: false, holes: false };

function read(): MapLayers {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<MapLayers>) }; } catch { return DEFAULTS; }
}

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayers>(read);
  const set = useCallback((name: keyof MapLayers, on: boolean) => {
    setLayers((cur) => {
      const next = { ...cur, [name]: on };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  return { layers, set };
}
