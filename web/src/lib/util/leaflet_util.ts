import { haversineDistance } from "$lib/models/gpx/utils";
import type { Waypoint } from "$lib/models/waypoint";
import type { LeafletEvent, Map, Marker } from "leaflet";
import * as M from "maplibre-gl";

export const startIcon = () => L.divIcon({
    html: '<i class="p-2 text-white bg-gray-500 rounded-full fa fa-bullseye -translate-x-1/2 -translate-y-1/3"></i>',
    className: 'start-icon'
});
export const endIcon = () => L.divIcon({
    html: '<i class="p-2 text-white bg-gray-500 rounded-full fa fa-flag-checkered -translate-x-1/2 -translate-y-1/3"></i>',
    className: 'end-icon'
});

export function createMarkerFromWaypoint(L: any, waypoint: Waypoint, onDragEnd?: (event: LeafletEvent) => void): Marker {
    const icon = L.divIcon({
        html: `<i class="px-2 py-2 text-white bg-gray-500 rounded-full fa fa-${waypoint.icon}"></i>`,
        className: 'waypoint-icon'
    });

    const marker = L.marker([waypoint.lat, waypoint.lon], {
        title: waypoint.name,
        icon: icon,
        draggable: onDragEnd != null,
        meta: {
            waypointName: waypoint.name
        }
    })
        .bindPopup(
            "<b>" +
            waypoint.name +
            "</b>" +
            (waypoint.description && waypoint.description.length > 0
                ? "<br>" + waypoint.description
                : ""),
        );
    if (onDragEnd) {
        marker.on("dragend", onDragEnd);
    }

    return marker;
}

export function createAnchorMarker(L: any, lat: number, lon: number, index: number, onDeleteClick: () => void, onDragEnd: (event: LeafletEvent) => void): Marker {

    const anchorIconElement = document.createElement("span")
    anchorIconElement.textContent = "" + index
    const anchorIcon = L.divIcon({
        html: anchorIconElement,
        iconSize: [24, 24],
        className: "leaflet-anchor"
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "btn-icon fa fa-trash text-red-500";
    deleteButton.addEventListener("click", onDeleteClick)
    const marker = L.marker([lat, lon], {
        icon: anchorIcon,
        draggable: true,
    })
        .bindPopup(
            deleteButton
        );
    marker.on("dragend", onDragEnd);

    return marker
}

export function calculatePixelPerMeter(map: M.Map, meters: number) {
    const y = map.getCanvas().getBoundingClientRect().y;
    const x = map.getCanvas().getBoundingClientRect().x;
    const maxMeters = map.unproject([0, y]).distanceTo(map.unproject([x, y]));
    const pixelPerMeter = x / maxMeters;

    return pixelPerMeter * meters
}

export function calculateScaleFactor(map: M.Map) {
    function _pxTOmm() {
        let heightRef = document.createElement('div');
        heightRef.style.height = '1mm';
        heightRef.style.position = "absolute";
        heightRef.id = 'heightRef';
        document.body.appendChild(heightRef);

        const pxPermm = heightRef.getBoundingClientRect().height;

        document.body.removeChild(heightRef);

        return function pxTOmm(px: number) {
            return px / pxPermm;
        }
    }
    var centerOfMap = map.getCanvas().getBoundingClientRect().y / 2;

    const p1 = map.unproject([0, centerOfMap]);
    const p2 = map.unproject([100, centerOfMap]);
    var realWorldMetersPer100Pixels = haversineDistance(
        p1.lat, p1.lng, p2.lat, p2.lng
    );

    const screenMetersPer100Pixels = _pxTOmm()(100) / 1000;

    const scaleFactor = realWorldMetersPer100Pixels / screenMetersPer100Pixels

    return scaleFactor
}

export function convertDMSToDD(dms: Number[], direction: "N" | "O" | "S" | "W") {
    var dd = dms[0].valueOf() + dms[1].valueOf() / 60 + dms[2].valueOf() / (60 * 60);

    if (direction == "S" || direction == "W") {
        dd = dd * -1;
    }
    return dd;
}