import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import * as THREE from 'three';

interface CityPanoramaViewerProps {
  imageUrl: string;
  title: string;
  subtitle: string;
  onClose: () => void;
}

export default function CityPanoramaViewer({ imageUrl, title, subtitle, onClose }: CityPanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const portalRoot = typeof document === 'undefined' ? null : document.body;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setLoading(true);
    setError(null);

    let renderer: THREE.WebGLRenderer | null = null;
    let texture: THREE.Texture | null = null;
    let geometry: THREE.SphereGeometry | null = null;
    let material: THREE.MeshBasicMaterial | null = null;
    let mesh: THREE.Mesh | null = null;
    let disposed = false;
    let isPointerDown = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let lon = -90;
    let lat = 0;
    let startLon = lon;
    let startLat = lat;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 1, 1100);

    const resize = () => {
      if (!renderer) return;
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const renderFrame = () => {
      if (!renderer) return;
      lat = THREE.MathUtils.clamp(lat, -85, 85);
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      const target = new THREE.Vector3(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setAnimationLoop(renderFrame);
      renderer.domElement.className = 'h-full w-full';
      renderer.domElement.style.touchAction = 'none';
      container.appendChild(renderer.domElement);
      resize();
    } catch {
      setLoading(false);
      setError('WebGL is unavailable in this browser session.');
      return;
    }

    geometry = new THREE.SphereGeometry(500, 80, 48);
    geometry.scale(-1, 1, 1);

    const handlePointerDown = (event: PointerEvent) => {
      isPointerDown = true;
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      startLon = lon;
      startLat = lat;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown) return;
      lon = startLon + (pointerStartX - event.clientX) * 0.14;
      lat = startLat + (event.clientY - pointerStartY) * 0.14;
    };

    const handlePointerUp = () => {
      isPointerDown = false;
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + event.deltaY * 0.03, 40, 95);
      camera.updateProjectionMatrix();
    };

    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      loadedTexture => {
        if (disposed || !renderer || !geometry) return;
        texture = loadedTexture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        material = new THREE.MeshBasicMaterial({ map: texture });
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        setLoading(false);
      },
      undefined,
      () => {
        if (disposed) return;
        setLoading(false);
        setError('The 360 panorama failed to load.');
      },
    );

    window.addEventListener('resize', resize);
    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('wheel', handleWheel);
      if (renderer) {
        renderer.setAnimationLoop(null);
      }
      if (mesh) scene.remove(mesh);
      material?.dispose();
      geometry?.dispose();
      texture?.dispose();
      renderer?.dispose();
      container.replaceChildren();
    };
  }, [imageUrl, portalRoot]);

  if (!portalRoot) return null;

  return createPortal(
    <div className="fixed inset-0 z-120 isolate bg-midnight-950/90 backdrop-blur-md text-cream-50">
      <div className="absolute inset-0 bg-atlas-grid opacity-25 mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 bg-midnight-950/18 pointer-events-none" />
      <div className="relative flex h-full flex-col">
        <header className="relative z-10 flex items-start justify-between gap-4 px-5 py-4 pr-24 sm:px-8 sm:py-5 sm:pr-32 border-b border-cream-50/8 bg-midnight-950/78 backdrop-blur">
          <div>
            <div className="mono-tick text-aqua-300 tick-line">{subtitle}</div>
            <h2 className="mt-3 font-display text-2xl sm:text-3xl leading-tight">{title}</h2>
            <p className="mt-2 text-sm text-dust-300 max-w-2xl">
              Drag to inspect the scene. Use the wheel or trackpad to zoom. Press Escape or use Close scan to exit.
            </p>
          </div>
        </header>

        <button
          onClick={onClose}
          className="fixed right-4 top-4 z-130 inline-flex items-center gap-2 rounded-full border border-cream-50/15 bg-midnight-950/92 px-4 py-2.5 text-cream-50 shadow-[0_10px_30px_rgba(3,5,17,0.45)] transition hover:border-aqua-300/45 hover:text-aqua-100 sm:right-6 sm:top-5"
          aria-label="Close 360 viewer"
        >
          <X className="h-4 w-4" />
          <span className="mono-tick text-[11px] uppercase tracking-[0.22em]">Close scan</span>
        </button>

        <div className="relative min-h-0 flex-1">
          <div ref={containerRef} className="absolute inset-0" />
          <div className="pointer-events-none absolute bottom-5 right-5 z-10 sm:hidden">
            <button
              onClick={onClose}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-cream-50/10 bg-midnight-950/82 px-4 py-2 text-xs uppercase tracking-[0.22em] text-cream-50 shadow-lg shadow-midnight-950/30 transition hover:border-aqua-300/40 hover:text-aqua-100"
            >
              <X className="h-3.5 w-3.5" />
              Close scan
            </button>
          </div>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-midnight-950/55">
              <div className="rounded-xl border border-cream-50/8 bg-midnight-900/80 px-5 py-4 mono-tick text-dust-200">
                Loading panoramic evidence...
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md rounded-2xl border border-coral-400/30 bg-midnight-950/90 px-5 py-5 text-center shadow-2xl shadow-coral-500/10">
                <div className="mono-tick text-coral-300">Viewer unavailable</div>
                <p className="mt-3 text-sm leading-relaxed text-dust-200">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    portalRoot,
  );
}