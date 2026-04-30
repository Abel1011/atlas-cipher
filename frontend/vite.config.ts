import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function normalizeId(id: string) {
  return id.replaceAll('\\', '/')
}

function getPackageName(id: string) {
  const normalized = normalizeId(id)
  const afterNodeModules = normalized.split('/node_modules/')[1]
  if (!afterNodeModules) {
    return null
  }

  const segments = afterNodeModules.split('/')
  const scope = segments[0]
  const name = segments[1]

  if (!scope) {
    return null
  }

  return scope.startsWith('@') && name ? `${scope}/${name}` : scope
}

function getChunkName(id: string) {
  const normalized = normalizeId(id)
  const pkg = getPackageName(normalized)
  if (!pkg) {
    return undefined
  }

  if (pkg === 'three') {
    if (normalized.includes('/node_modules/three/examples/jsm/')) {
      return 'three-examples'
    }

    return 'three-core'
  }

  if (pkg === '@elevenlabs/react') {
    return 'voice-vendor'
  }

  if (pkg === 'elevenlabs-client' || pkg === 'elevenlabs-types') {
    return 'voice-vendor'
  }

  if (pkg === 'livekit-client') {
    return 'voice-transport'
  }

  if (pkg === 'h3-js') {
    return 'geo-index-vendor'
  }

  if (
    pkg === 'react-globe.gl' ||
    pkg === 'globe.gl' ||
    pkg === 'three-globe' ||
    pkg === 'three-render-objects' ||
    pkg === 'three-slippy-map-globe' ||
    pkg === 'three-geojson-geometry' ||
    pkg === 'three-conic-polygon-geometry' ||
    pkg === 'react-kapsule' ||
    pkg === 'kapsule' ||
    pkg === 'accessor-fn' ||
    pkg === 'frame-ticker' ||
    pkg === 'float-tooltip' ||
    pkg === 'index-array-by' ||
    pkg === 'data-bind-mapper' ||
    pkg === 'd3-array' ||
    pkg === 'd3-color' ||
    pkg === 'd3-delaunay' ||
    pkg === 'd3-format' ||
    pkg === 'd3-geo' ||
    pkg === 'd3-geo-voronoi' ||
    pkg === 'd3-interpolate' ||
    pkg === 'd3-octree' ||
    pkg === 'd3-scale' ||
    pkg === 'd3-scale-chromatic' ||
    pkg === 'delaunator' ||
    pkg === 'earcut' ||
    pkg === 'jerrypick' ||
    pkg === 'lodash-es' ||
    pkg === 'point-in-polygon-hao' ||
    pkg === 'polished' ||
    pkg === 'prop-types' ||
    pkg === 'robust-predicates' ||
    pkg === 'turf-boolean-point-in-polygon' ||
    pkg === 'turf-invariant'
  ) {
    return 'globe-vendor'
  }

  if (pkg === 'lucide-react') {
    return 'icons-vendor'
  }

  if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') {
    return 'react-vendor'
  }

  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return getChunkName(id)
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
