import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  STATUS_CONFIG,
  DEFAULT_GORONTALO_CENTER,
  DEFAULT_GORONTALO_ZOOM,
} from "./mapConstants";

export default function GorontaloOutreachMap({
  schools = [],
  selectedSchool = null,
  onSelectSchool,
  onOpenVisitModal,
  tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_GORONTALO_CENTER,
      zoom: DEFAULT_GORONTALO_ZOOM,
      zoomControl: true,
    });

    L.tileLayer(tileUrl, {
      attribution: tileAttribution,
      maxZoom: 19,
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, [tileUrl, tileAttribution]);

  // Update Markers when schools change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    schools.forEach((school) => {
      if (!Number.isFinite(school.lat) || !Number.isFinite(school.lng)) return;

      const statusInfo = STATUS_CONFIG[school.status] || STATUS_CONFIG.pending;

      // Create lightweight HTML DivIcon avoiding Vite asset resolution issues
      const customIcon = L.divIcon({
        className: "custom-school-marker",
        html: `
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-md text-white font-bold text-xs ${statusInfo.bgClass} border-2 border-white ring-2 ${statusInfo.borderClass}/30 transition-transform transform hover:scale-115">
            <span>${school.tier === "SMK" ? "K" : school.tier === "SMP" ? "P" : "A"}</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([school.lat, school.lng], { icon: customIcon });

      // Build popup content
      const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${school.lat},${school.lng}`;
      const popupHtml = `
        <div class="p-1 text-slate-800 font-sans max-w-[240px]">
          <div class="flex items-start justify-between gap-1 mb-1">
            <span class="font-extrabold text-xs text-slate-900">${school.name}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${statusInfo.badgeBg}">${school.tier || "SMA"}</span>
          </div>
          <p class="text-[11px] text-slate-500 mb-1.5 leading-tight">${school.address || school.district || "Kota Gorontalo"}</p>
          
          <div class="mb-2 py-1 px-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] space-y-0.5">
            <div class="font-semibold text-slate-700">Status: <span class="${statusInfo.textClass} font-bold">${statusInfo.label}</span></div>
            ${
              school.lastVisitDate
                ? `<div class="text-[10px] text-slate-500">Last visit: <b>${school.lastVisitDate}</b></div>`
                : `<div class="text-[10px] text-slate-400 italic">No visit recorded yet</div>`
            }
            ${
              school.lastContactName
                ? `<div class="text-[10px] text-slate-500">Contact: ${school.lastContactName} (${school.lastContactRole || "BK"})</div>`
                : ""
            }
          </div>

          <div class="flex items-center gap-1.5 pt-1 border-t border-slate-100">
            <button 
              id="popup-btn-visit-${school.id}" 
              class="flex-1 py-1.5 px-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white text-[11px] font-bold rounded-lg transition text-center flex items-center justify-center gap-1 shadow-2xs"
            >
              Log Visit
            </button>
            <a 
              href="${navUrl}" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
              title="Open Google Maps Navigation"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      // Attach DOM event listener when popup opens
      marker.on("popupopen", () => {
        const btn = document.getElementById(`popup-btn-visit-${school.id}`);
        if (btn) {
          btn.onclick = () => {
            if (onOpenVisitModal) onOpenVisitModal(school);
          };
        }
        if (onSelectSchool) onSelectSchool(school);
      });

      markersGroup.addLayer(marker);
    });
  }, [schools, onOpenVisitModal, onSelectSchool]);

  // Center map on selectedSchool when triggered externally (e.g. clicking school card)
  useEffect(() => {
    if (!selectedSchool || !mapInstanceRef.current) return;
    if (!Number.isFinite(selectedSchool.lat) || !Number.isFinite(selectedSchool.lng)) return;

    mapInstanceRef.current.flyTo([selectedSchool.lat, selectedSchool.lng], 16, {
      duration: 1.2,
    });
  }, [selectedSchool]);

  return (
    <div className="relative w-full h-[400px] sm:h-[480px] rounded-3xl overflow-hidden border border-slate-200/90 shadow-2xs bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Quick Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-xs py-2 px-3 rounded-2xl border border-slate-200/80 shadow-xs text-[11px] font-semibold text-slate-700 flex flex-wrap gap-2.5 items-center pointer-events-auto">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Visited</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
          <span>Follow-up</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}
