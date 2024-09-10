/*
 * https://github.com/adoroszlai/joebed/tree/gh-pages
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2014- Doroszlai Attila, 2019- Raruto
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

L.Mixin.Selectable = {
  includes: L.Mixin.Events,

  setSelected: function (s) {
    var selected = !!s;
    if (this._selected !== selected) {
      this._selected = selected;
      this.fire('selected');
    }
  },

  isSelected: function () {
    return !!this._selected;
  },
};

L.Mixin.Selection = {
  includes: L.Mixin.Events,

  getSelection: function () {
    return this._selected;
  },

  setSelection: function (item) {
    if (this._selected === item) {
      if (item !== null) {
        item.setSelected(!item.isSelected());
        if (!item.isSelected()) {
          this._selected = null;
        }
      }
    } else {
      if (this._selected) {
        this._selected.setSelected(false);
      }
      this._selected = item;
      if (this._selected) {
        this._selected.setSelected(true);
      }
    }
    this.fire('selection_changed', { polyline: item });
  },
};

L.GeoJSON.include(L.Mixin.Selectable);

export const GpxGroup = L.GpxGroup = L.Class.extend({
  options: {
    highlight: {
      opacity: 1,
      weight: 6,
    },
    points: [],
    points_options: {
      icon: {
        iconUrl: '../images/elevation-poi.png',
        iconSize: [12, 12],
      }
    },
    flyToBounds: true,
    elevation: true,
    elevation_options: {
      theme: 'lightblue-theme',
      detached: true,
      elevationDiv: '#elevation',
    },
    distanceMarkers: true,
    distanceMarkers_options: {
      lazy: true,
      distance: false,
      direction: true,
      offset: 1000,
    },
  },

  initialize: function (tracks, options) {

    L.Util.setOptions(this, options);

    this._count = 0;
    this._loadedCount = 0;
    this._tracks = tracks;
    this._layers = L.featureGroup();
    this._markers = L.featureGroup();
    this._hotline = L.featureGroup();
    this._elevation = L.control.elevation(this.options.elevation_options);

    this._routes = [];

    this.options.points.forEach((poi) =>
      L
        .marker(poi.latlng, { icon: L.icon(this.options.points_options.icon) })
        .bindTooltip(poi.name, { direction: 'auto' }).addTo(this._markers)
    );

  },

  getBounds: function () {
    return this._layers.getBounds();
  },

  addTo: function (map) {
    this._hotline.addTo(map);
    this._layers.addTo(map);
    this._markers.addTo(map);

    this._map = map;

    this.on('selection_changed', this._onSelectionChanged, this);
    this.addTracks();
  },

  addTracks() {
    this._tracks.forEach(this._addTrack, this);

  },

  select(index) {
    if (index > this._routes.length - 1) {
      return
    }

    this.setSelection(this._routes[index])
  },

  openPopup(index) {
    if (index > this._routes.length - 1) {
      return
    }

    this._routes[index].openPopup();
  },

  closePopup(index) {
    if (index > this._routes.length - 1) {
      return
    }

    this._routes[index].closePopup();
  },

  _addTrack: function (track) {
    if (track instanceof Object) {
      this._loadGeoJSON(track);
    } else {
      this._elevation._parseFromString(track)
        .then(geojson => this._loadGeoJSON(geojson, this._hashCode(track), track.split('/').pop().split('#')[0].split('?')[0]))
    }
  },

  _hashCode: (s) => s.split('').reduce((a, b) => (((a << 5) - a) + b.charCodeAt(0)) | 0, 0),

  clear: function () {
    this._elevation.clear()
    this._elevation.remove();
    this._clearLayers();
    this._clearLayers(this._markers);
    this._clearLayers(this._hotline)
    this._count = 0;
    this._loadedCount = 0;
    this._tracks = []
    this._routes = []

    this.fire('clear')
  },

  _clearLayers(l) {
    l = l || this._layers;
    if (l && l.eachLayer) {
      l.eachLayer(f => f.remove())
      l.clearLayers();
    }
  },

  _loadGeoJSON: function (geojson, hash, fallbackName) {
    if (geojson) {
      geojson.hash = hash
      geojson.name = geojson.name || (geojson[0] && geojson[0].properties.name) || fallbackName;
      this._loadRoute(geojson);
    }
  },

  _loadRoute: function (data) {
    if (!data) return;
    var line_style = {
      color: this._hashToColor(data.hash),
      opacity: 0.75,
      weight: 5,
      distanceMarkers: this.options.distanceMarkers_options,
    };

    var route = L.geoJson(data, {
      name: data.name || '',
      style: (feature) => line_style,
      distanceMarkers: line_style.distanceMarkers,
      originalStyle: line_style,
      isGroupLayer: true,
      hash: data.hash,
      filter: feature => feature.geometry.type != "Point",
    });


    this._elevation.import([this._elevation.__LGEOMUTIL, this._elevation.__LDISTANCEM]).then(() => {
      route.addTo(this._layers);      

      route.eachLayer((layer) => this._onEachRouteLayer(route, layer));


      this._onEachRouteLoaded(route);
    });

  },

  _onEachRouteLayer: function (route, layer) {
    var polyline = layer;

    this._routes.push(route)

    route.on('selected', L.bind(this._onRouteSelected, this, route, polyline));

    polyline.on('mouseover', L.bind(this._onRouteMouseOver, this, route, polyline));
    polyline.on('mouseout', L.bind(this._onRouteMouseOut, this, route, polyline));
    polyline.on('click', L.bind(this._onRouteClick, this, route, polyline));

    const startIcon = L.divIcon({
      html: '<i class="px-2 py-2 text-white bg-gray-500 rounded-lg fa fa-bullseye -translate-x-1/2"></i>',
      className: 'start-icon'
    });
    const endIcon = L.divIcon({
      html: '<i class="px-2 py-2 text-white bg-gray-500 rounded-lg fa fa-flag-checkered -translate-x-1/2"></i>',
      className: 'end-icon'
    });
    const latlngs = polyline.getLatLngs().flat(1);

    polyline.setLatLngs(latlngs);

    if (this._loadedCount == 0 || !this.options.itinerary) {
      L.marker(latlngs[0], { icon: startIcon }).addTo(this._markers)
    }

    L.marker(latlngs[latlngs.length - 1], { icon: endIcon }).addTo(this._markers)
  },

  _onEachRouteLoaded: function (route) {
    this.fire('route_loaded', { route: route });

    if (++this._loadedCount === this._tracks.length) {
      this.fire('loaded');
      if (this.options.flyToBounds) {
        this._map.flyToBounds(this.getBounds(), { duration: 0.25, easeLinearity: 0.25, noMoveStart: true });
      }
    }
  },

  highlight: function (route, polyline) {
    polyline.setStyle(this.options.highlight);
    polyline.options.highlighted = true
    if (this.options.distanceMarkers) {
      polyline.addDistanceMarkers();
    }
  },

  unhighlight: function (route, polyline) {
    polyline.setStyle(route.options.originalStyle);
    polyline.options.highlighted = false
    if (this.options.distanceMarkers) {
      polyline.removeDistanceMarkers();
    }
  },

  _onRouteMouseOver: function (route, polyline) {
    if (!route.isSelected()) {
      this.highlight(route, polyline);
    }
    this.fire('route_mouseover', { route: route, polyline: polyline });
  },

  _onRouteMouseOut: function (route, polyline) {
    if (!route.isSelected()) {
      this.unhighlight(route, polyline);
    }
    this.fire('route_mouseout', { route: route, polyline: polyline });
  },

  _onRouteClick: function (route, polyline) {
    this.highlight(route, polyline)
    this.setSelection(route);
  },

  _onRouteSelected: function (route, polyline) {
    if (!route.isSelected()) {
      this.unhighlight(route, polyline);
    }
  },

  _onSelectionChanged: async function (e) {
    var elevation = this._elevation;
    var eleDiv = elevation.getContainer();
    var route = this.getSelection();
    var hotline = this._hotline;

    hotline.clearLayers();

    if (route && route.isSelected()) {
      elevation.clear();

      if (!eleDiv) {
        elevation.addTo(this._map);
        this._map.invalidateSize()
      }
      for (const layer of route.getLayers()) {
        if (layer instanceof L.Polyline) {
          await elevation.addData(layer, false);
        }
      }
      await elevation._initHotLine(route, this._hotline)

      this._map.flyToBounds(route.getBounds(), { duration: 0.25, easeLinearity: 0.25, noMoveStart: true });


    } else {
      if (eleDiv) {
        elevation.remove();
        this._map.invalidateSize()
      }
    }
  },

  _hashToColor(hash) {
    // Ensure hash is a positive integer
    hash = Math.abs(hash);

    // Define the maximum brightness (e.g., 200 ensures the color is not too light)
    const maxBrightness = 200;

    // Convert the hash to a color in a reduced RGB range to prevent light colors
    const r = (hash >> 16) & 0xFF; // Extract the red component
    const g = (hash >> 8) & 0xFF;  // Extract the green component
    const b = hash & 0xFF;         // Extract the blue component

    // Adjust the RGB values to be within the allowed range (0 to maxBrightness)
    const red = Math.floor((r / 255) * maxBrightness);
    const green = Math.floor((g / 255) * maxBrightness);
    const blue = Math.floor((b / 255) * maxBrightness);

    // Format as HEX color
    return `#${(1 << 24 | red << 16 | green << 8 | blue).toString(16).slice(1).toUpperCase()}`;
  },

  removeFrom: function (map) {
    this._layers.removeFrom(map);
  },

});

L.GpxGroup.include(L.Mixin.Events);
L.GpxGroup.include(L.Mixin.Selection);

L.gpxGroup = (tracks, options) => new L.GpxGroup(tracks, options);