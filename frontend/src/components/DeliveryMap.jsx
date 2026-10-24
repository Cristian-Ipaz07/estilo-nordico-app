import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in bundlers (Vite)
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Neon active icon for selected delivery
const activeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [28, 45],
  iconAnchor: [14, 45],
  popupAnchor: [1, -34],
});

export default function DeliveryMap({ deliveries = [], selectedDelivery = null, onSelectDelivery }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const pastoCenter = [1.2136, -77.2811];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: pastoCenter,
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Approximate geocoding offsets around Pasto for addresses
    const pastoNeighborhoodCoords = {
      'galan': [1.2050, -77.2750],
      'luis carlos galan': [1.2050, -77.2750],
      'agualongo': [1.2220, -77.2920],
      'centro': [1.2136, -77.2811],
      'maridiaz': [1.2250, -77.2880],
      'pandiaco': [1.2310, -77.2860],
      'tamagao': [1.2020, -77.2720],
      'palermo': [1.2290, -77.2910],
      'morasurco': [1.2380, -77.2840],
      'fatima': [1.2080, -77.2830],
      'chapadal': [1.2000, -77.2650],
    };

    const bounds = L.latLngBounds();

    deliveries.forEach((d, idx) => {
      let lat = d.lat;
      let lng = d.lng;

      if (!lat || !lng) {
        const addrLower = (d.delivery_address || d.address || '').toLowerCase();
        let matched = false;
        for (const [key, coords] of Object.entries(pastoNeighborhoodCoords)) {
          if (addrLower.includes(key)) {
            lat = coords[0] + (idx * 0.0012);
            lng = coords[1] + (idx * 0.0009);
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Default spiral around Pasto center
          lat = 1.2136 + ((idx % 4 - 2) * 0.004);
          lng = -77.2811 + ((Math.floor(idx / 4) - 1) * 0.005);
        }
      }

      const isSelected = selectedDelivery?.id === d.id;
      const marker = L.marker([lat, lng], {
        icon: isSelected ? activeIcon : defaultIcon
      }).addTo(map);

      const balance = d.balance_due ?? (d.total_price ? d.total_price - (d.amount_paid || 0) : d.total_amount ?? 0);
      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 150px; padding: 4px;">
          <strong style="color: #111; font-size: 13px;">${d.customer_name || d.client_name}</strong><br/>
          <span style="color: #666; font-size: 11px;">${d.delivery_address || d.address || 'Pasto'}</span><br/>
          <strong style="color: #16a34a; font-size: 13px;">$${(balance || 0).toLocaleString('es-CO')}</strong>
        </div>
      `;
      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        if (onSelectDelivery) onSelectDelivery(d);
      });

      markersRef.current.push(marker);
      bounds.extend([lat, lng]);
    });

    if (deliveries.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);

  }, [deliveries, selectedDelivery, onSelectDelivery]);

  return (
    <div className="w-full h-[240px] md:h-[280px] rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
