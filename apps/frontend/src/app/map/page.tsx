'use client';
import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLiveProjects } from '@/hooks/useLiveSystem';
import { useCurrency } from '@/hooks/useCurrency';
import CurrencySelector from '@/components/CurrencySelector';
import { MapPin, TrendingUp, Activity, Loader2 } from 'lucide-react';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any, fallback = '0'): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


// Project coordinates (seeded data)
const PROJECT_COORDS: Record<string, [number, number]> = {
  'Lagos': [6.5244, 3.3792],
  'Abuja': [9.0579, 7.4951],
  'Kano': [12.0022, 8.5920],
  'Port Harcourt': [4.8156, 7.0498],
  'Accra': [5.6037, -0.1870],
  'Nairobi': [-1.2921, 36.8219],
  'Johannesburg': [-26.2041, 28.0473],
  'Cairo': [30.0444, 31.2357],
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#14b8a6',
  PENDING: '#f59e0b',
  COMPLETED: '#10b981',
  PAUSED: '#6b7280',
};

// Leaflet must be loaded client-side only
function MapComponent({ projects, format }: { projects: any[]; format: (n: number) => string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically load Leaflet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      const L = (window as any).L;
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([6.5, 8.0], 5);
      mapInstanceRef.current = map;

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 18,
      }).addTo(map);

      // Add project markers
      projects.forEach(project => {
        const coords = PROJECT_COORDS[project.location];
        if (!coords) return;

        const color = STATUS_COLORS[project.status] || '#14b8a6';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${color}88;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker(coords, { icon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family:system-ui;background:#0a0a0a;color:white;padding:12px;min-width:200px;border-radius:8px;">
            <div style="font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:${color};margin-bottom:6px;">${project.status}</div>
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${project.title}</div>
            <div style="font-size:11px;color:#71717a;">${project.location}, ${project.country}</div>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid #27272a;">
              <div style="font-size:11px;color:#a1a1aa;">Budget</div>
              <div style="font-weight:700;font-size:14px;color:${color};">$${safeF(project.budget)}</div>
            </div>
            <div style="margin-top:6px;">
              <div style="background:#27272a;border-radius:4px;height:4px;overflow:hidden;">
                <div style="width:${project.progress_percentage || 0}%;height:100%;background:${color};"></div>
              </div>
              <div style="font-size:9px;color:#52525b;margin-top:3px;text-transform:uppercase;">${project.progress_percentage || 0}% Complete</div>
            </div>
          </div>
        `, { className: 'dark-popup' });
      });
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [projects]);

  return <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />;
}

export default function MapPage() {
  const { projects, isLoading } = useLiveProjects();
  const { format, currency, setCurrency } = useCurrency();
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const statusCounts = {
    ACTIVE: projects.filter((p: any) => p.status === 'ACTIVE').length,
    total: projects.length,
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        <header className="mb-8 border-l-2 border-teal-500 pl-6">
          <p className="text-[10px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">Live Infrastructure Atlas</p>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic">Global Map</h1>
              <p className="text-zinc-500 text-sm mt-1">{statusCounts.ACTIVE} active projects across {new Set(projects.map((p: any) => p.country)).size} countries</p>
            </div>
            <CurrencySelector currency={currency} onSelect={setCurrency} compact={false} />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="w-full h-[500px] rounded-2xl border border-zinc-800 overflow-hidden relative bg-zinc-900">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin text-teal-500" size={28} />
                </div>
              ) : (
                <MapComponent projects={projects} format={format} />
              )}
              {/* Legend */}
              <div className="absolute bottom-4 left-4 z-[1000] bg-black/80 backdrop-blur-sm rounded-xl p-3 border border-zinc-800 space-y-1.5">
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project list */}
          <div className="space-y-3 overflow-y-auto max-h-[520px]">
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest sticky top-0 bg-[#050505] pb-2">
              {projects.length} Projects
            </p>
            {isLoading && <div className="py-10 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={20} /></div>}
            {projects.map((project: any) => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(selectedProject?.id === project.id ? null : project)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedProject?.id === project.id ? 'border-teal-500/50 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm uppercase tracking-tight truncate">{project.title}</h3>
                    <p className="text-zinc-500 text-[10px] flex items-center gap-1 mt-0.5">
                      <MapPin size={9} /> {project.location}, {project.country}
                    </p>
                  </div>
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: STATUS_COLORS[project.status] || '#14b8a6' }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-teal-500 font-mono text-sm font-bold">{format(Number(project.budget))}</span>
                  <span className="text-[9px] text-zinc-600 font-mono">{project.category}</span>
                </div>
                <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 transition-all" style={{ width: `${project.progress_percentage || 0}%`, background: STATUS_COLORS[project.status] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
