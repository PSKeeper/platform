var Util = require("../utils.js");

var BasicLayerView = require("mapseed-basic-layer-view");
var LayerView = require("mapseed-layer-view");
var toGeoJSON = require("togeojson");

module.exports = Backbone.View.extend({
  events: {
    "click .locate-me": "onClickGeolocate",
  },
  initialize: function() {
    var self = this,
      i,
      layerModel,
      logUserZoom = function() {
        Util.log(
          "USER",
          "map",
          "zoom",
          self.map.getBounds().toBBoxString(),
          self.map.getZoom(),
        );
      },
      logUserPan = function(evt) {
        Util.log(
          "USER",
          "map",
          "drag",
          self.map.getBounds().toBBoxString(),
          self.map.getZoom(),
        );
      };

    this.map = L.map(self.el, self.options.mapConfig.options);

    _.each(self.options.mapConfig.layers, function(config) {
      config.loaded = false;
    });
    this.layers = {};
    this.layerViews = {};

    // bootstrapped data from page
    this.places = this.options.places;
    this.landmarks = this.options.landmarks;

    // Remove default prefix
    self.map.attributionControl.setPrefix("");

    // Init geolocation
    if (self.options.mapConfig.geolocation_enabled) {
      self.initGeolocation();
    }

    self.map.on("dragend", logUserPan);
    $(self.map.zoomControl._zoomInButton).click(logUserZoom);
    $(self.map.zoomControl._zoomOutButton).click(logUserZoom);

    self.map.on("zoomend", function(evt) {
      Util.log("APP", "zoom", self.map.getZoom());
      $(Shareabouts).trigger("zoomend", [evt]);
    });

    self.map.on("moveend", function(evt) {
      Util.log("APP", "center-lat", self.map.getCenter().lat);
      Util.log("APP", "center-lng", self.map.getCenter().lng);

      $(Shareabouts).trigger("mapmoveend", [evt]);
    });

    self.map.on("dragend", function(evt) {
      $(Shareabouts).trigger("mapdragend", [evt]);
    });

    // Bind shareabouts collections event listeners
    _.each(self.places, function(collection, collectionId) {
      self.layers[collectionId] = self.getLayerGroups(collectionId);
      self.layerViews[collectionId] = {};
      collection.on("reset", self.render, self);
      collection.on("add", self.addLayerView(collectionId), self);
      collection.on("remove", self.removeLayerView(collectionId), self);
    });

    // Bind landmark collections event listeners
    _.each(self.landmarks, function(collection, collectionId) {
      self.layers[collectionId] = L.layerGroup();
      self.layerViews[collectionId] = {};
      collection.on("add", self.addLandmarkLayerView(collectionId), self);
      collection.on("remove", self.removeLandmarkLayerView(collectionId), self);
    });

    // Bind visiblity event for custom layers
    $(Shareabouts).on("visibility", function(evt, id, visible, isBasemap) {
      var layer = self.layers[id],
        config = _.find(self.options.mapConfig.layers, function(c) {
          return c.id === id;
        });

      if (config && !config.loaded && visible) {
        self.createLayerFromConfig(config);
        config.loaded = true;
        layer = self.layers[id];
      }

      if (isBasemap) {
        self.checkLayerZoom(config.maxZoom);
        self.map.options.maxZoom = config.maxZoom
          ? config.maxZoom
          : self.options.mapConfig.options.maxZoom;

        _.each(self.options.basemapConfigs, function(basemap) {
          if (basemap.id === id) {
            self.map.addLayer(layer);
            layer.bringToBack();
          } else if (self.layers[basemap.id]) {
            self.map.removeLayer(self.layers[basemap.id]);
          }
        });
      } else if (layer) {
        self.setLayerVisibility(layer, visible);
      } else {
        // Handles cases when we fire events for layers that are not yet
        // loaded (ie cartodb layers, which are loaded asynchronously)
        // We are setting the asynch layer config's default visibility here to
        // ensure they are added to the map when they are eventually loaded:
        config.asyncLayerVisibleDefault = visible;
      }
    });
  }, // end initialize

  isClusterable(layerId) {
    // If no cluster config exists, we don't cluster any layers.
    if (!this.options.cluster) return false;
    // If a cluster config exists but no layer list is included, we cluster all
    // layers.
    if (!this.options.cluster.layers) return true;
    // Otherwise, we only cluster a layer if it's listed in the cluster config.
    return this.options.cluster.layers.includes(layerId);
  },

  checkLayerZoom(maxZoom) {
    if (maxZoom && this.map.getZoom() > maxZoom) {
      _.defer(() => {
        this.map.setZoom(parseInt(maxZoom, 10));
      });
    }
  },

  // Adds or removes the layer  on Master Layer based on visibility
  setLayerVisibility: function(layer, visible) {
    this.map.closePopup();
    if (visible && !this.map.hasLayer(layer)) {
      this.map.addLayer(layer);
    }
    if (!visible && this.map.hasLayer(layer)) {
      this.map.removeLayer(layer);
    }
  },
  reverseGeocodeMapCenter: _.debounce(function() {
    var center = this.map.getCenter();
    Util.MapQuest.reverseGeocode(center, {
      success: function(data) {
        var locationsData = data.results[0].locations;
        // Util.console.log('Reverse geocoded center: ', data);
        $(Shareabouts).trigger("reversegeocode", [locationsData[0]]);
      },
    });
  }, 1000),
  initGeolocation: function() {
    var self = this;

    var onLocationError = function(evt) {
      var message;
      switch (evt.code) {
        // Unknown
        case 0:
          message =
            "An unknown error occured while locating your position. Please try again.";
          break;
        // Permission Denied
        case 1:
          message =
            "Geolocation is disabled for this page. Please adjust your browser settings.";
          break;
        // Position Unavailable
        case 2:
          message = "Your location could not be determined. Please try again.";
          break;
        // Timeout
        case 3:
          message =
            "It took too long to determine your location. Please try again.";
          break;
      }
      alert(message);
    };
    var onLocationFound = function(evt) {
      var msg;
      if (
        !self.map.options.maxBounds ||
        self.map.options.maxBounds.contains(evt.latlng)
      ) {
        self.map.fitBounds(evt.bounds);
      } else {
        msg =
          "It looks like you're not in a place where we're collecting " +
          "data. I'm going to leave the map where it is, okay?";
        alert(msg);
      }
    };
    // Add the geolocation control link
    this.$(".leaflet-top.leaflet-right").append(
      '<div class="leaflet-control leaflet-bar">' +
        '<a href="#" class="locate-me"></a>' +
        "</div>",
    );

    // Bind event handling
    this.map.on("locationerror", onLocationError);
    this.map.on("locationfound", onLocationFound);

    // Go to the current location if specified
    if (this.options.mapConfig.geolocation_onload) {
      this.geolocate();
    }
  },
  onClickGeolocate: function(evt) {
    evt.preventDefault();
    Util.log(
      "USER",
      "map",
      "geolocate",
      this.map.getBounds().toBBoxString(),
      this.map.getZoom(),
    );
    this.geolocate();
  },
  geolocate: function() {
    this.map.locate();
  },
  addLandmarkLayerView: function(collectionId) {
    return function(model) {
      this.layerViews[collectionId][model.id] = new BasicLayerView({
        model: model,
        router: this.options.router,
        map: this.map,
        placeTypes: this.options.placeTypes,
        collectionId: collectionId,
        layer: this.layers[collectionId],
        // to access the filter
        mapView: this,
      });
    };
  },
  removeLandmarkLayerView: function(collectionId) {
    return function(model) {
      this.layerViews[collectionId][model.id].remove();
      delete this.layerViews[collectionId][model.id];
    };
  },
  addLayerView: function(collectionId) {
    return function(model) {
      this.layerViews[collectionId][model.cid] = new LayerView({
        model: model,
        router: this.options.router,
        map: this.map,
        layerGroup: this.layers[collectionId],
        placeTypes: this.options.placeTypes,
        // to access the filter
        mapView: this,
      });
    };
  },
  removeLayerView: function(collectionId) {
    return function(model) {
      // remove map-bound events for this layer view
      this.map.off(
        "zoomend",
        this.layerViews[collectionId][model.cid].updateLayer,
        this.layerViews[collectionId][model.cid],
      );
      this.map.off(
        "move",
        this.layerViews[collectionId][model.cid].throttledRender,
        this.layerViews[collectionId][model.cid],
      );
      this.map.off(
        "zoomend",
        this.layerViews[collectionId][model.cid].render,
        this.layerViews[collectionId][model.cid],
      );

      this.layerViews[collectionId][model.cid].remove();
      delete this.layerViews[collectionId][model.cid];

      Util.log("APP", "panel-state", "closed");
      $("#spotlight-place-mask").remove();
      if (this.locationTypeFilter) {
        this.options.router.navigate("filter/" + this.locationTypeFilter, {
          trigger: true,
        });
      } else {
        this.options.router.navigate("/", { trigger: true });
      }
    };
  },
  zoomInOn: function(latLng) {
    this.map.setView(latLng, this.options.mapConfig.options.maxZoom || 17);
  },

  filter: function(locationTypeModel, mapWasUnfiltered, mapWillBeUnfiltered) {
    let locationType = locationTypeModel.get("locationType"),
      isActive = locationTypeModel.get("active");

    if (mapWasUnfiltered || mapWillBeUnfiltered) {
      for (let collectionId in this.places) {
        this.places[collectionId]
          .filter(model => {
            return model.get("location_type") !== locationType;
          })
          .forEach(model => {
            if (mapWasUnfiltered) {
              this.layerViews[collectionId][model.cid].filter();
            } else if (mapWillBeUnfiltered) {
              this.layerViews[collectionId][model.cid].unfilter();
            }
          });
      }
    } else {
      for (let collectionId in this.places) {
        this.places[collectionId]
          .where({ location_type: locationType })
          .forEach(model => {
            isActive
              ? this.layerViews[collectionId][model.cid].unfilter()
              : this.layerViews[collectionId][model.cid].filter();
          });
      }
    }

    // TODO: filtering for landmarks also?
  },

  clearFilter: function(collectionId) {
    var self = this;
    this.locationTypeFilter = null;
    _.each(this.places, function(collection) {
      collection.each(function(model) {
        if (self.layerViews[model.cid]) {
          self.layerViews[model.cid].render();
        }
      });
    });

    _.each(this.landmarks, function(collection) {
      collection.each(function(model) {
        if (self.layerViews[model.cid]) {
          self.layerViews[model.cid].render();
        }
      });
    });
  },

  getLayerGroups: function(collectionId) {
    if (this.isClusterable(collectionId)) {
      return L.markerClusterGroup(this.options.cluster);
    } else {
      return L.layerGroup();
    }
  },

  createLayerFromConfig: function(config) {
    var self = this,
      layer,
      collectionId,
      collection;

    if (config.type && config.type === "json") {
      var url = config.url;
      if (config.sources) {
        url += "?";
        config.sources.forEach(function(source) {
          url += encodeURIComponent(source) + "&";
        });
      }
      config.map = self.map;
      layer = L.argo(url, config);
      if (self.isClusterable(config.id)) {
        layer.on("loaded", layer => {
          let clusters = L.markerClusterGroup(self.options.cluster).addLayer(
            layer.target,
          );
          self.layers[config.id] = clusters;
          self.map.addLayer(clusters);
        });
      } else {
        self.layers[config.id] = layer;
      }
    } else if (config.type && config.type === "kml") {
      $.ajax(config.url).done(function(xml) {
        layer = L.argo(toGeoJSON.kml(xml), config);
        self.layers[config.id] = layer;
        if (config.asyncLayerVisibleDefault) {
          layer.addTo(self.map);
        }
      });
    } else if (config.type && config.type === "esri-feature") {
      if (config.loadStrategy === "all at once") {
        // IDs can be returned all at once, while actual geometries are
        // capped at 1000 per request. Gets an array of all IDs then
        // requests their geometry 1000 at a time.
        self.map.fire("layer:loading", { id: config.id });
        L.esri.Tasks.query({
          url: config.url,
        }).ids(function(error, ids) {
          var esriLayers = [];

          for (var i = 0; i < ids.length; i += 1000) {
            L.esri.Tasks.query({ url: config.url })
              .featureIds(ids.slice(i, i + 1000))
              .run(function(error, geoJson) {
                var currentLayer = L.argo(geoJson, config);

                if (config.popupContent) {
                  curentLayer.bindPopup(function(feature) {
                    return L.Argo.t(config.popupContent, feature.properties);
                  });
                }

                esriLayers.push(currentLayer);

                if (esriLayers.length === Math.floor(ids.length / 1000) + 1) {
                  // All requests have completed
                  self.layers[config.id] = L.layerGroup(esriLayers);
                  self.map.fire("layer:loaded", { id: config.id });
                }
              });
          }
        });
      } else {
        var configStyled = config.rules != null;
        var esriOptions = { url: config.url, ignoreRenderer: configStyled };
        if (configStyled) {
          esriOptions.style = function(feature) {
            return L.Argo.getStyleRule(feature, config.rules)["style"];
          };
        }
        layer = L.esri
          .featureLayer(esriOptions)
          .on("loading", function() {
            self.map.fire("layer:loading", { id: config.id });
          })
          .on("load", function() {
            self.map.fire("layer:loaded", { id: config.id });
          });

        if (config.popupContent) {
          layer.bindPopup(function(feature) {
            return L.Argo.t(config.popupContent, feature.properties);
          });
        }

        self.layers[config.id] = layer;
      }
    } else if (config.type && config.type === "place") {
      // NOTE: Since places and landmarks have their own url's, loading them
      // into our map is handled in our Backbone router.
      // nothing to do
    } else if (config.type && config.type === "landmark") {
      // NOTE: Since places and landmarks have their own url's, loading them
      // into our map is handled in our Backbone router.
      // nothing to do
    } else if (config.type && config.type === "cartodb") {
      this.map.fire("layer:loading", { id: config.id });
      cartodb
        .createLayer(self.map, config.url, { legends: false })
        .on("done", function(cartoLayer) {
          self.layers[config.id] = cartoLayer;
          self.map.fire("layer:loaded", { id: config.id });
          // This is only set when the 'visibility' event is fired before
          // our carto layer is loaded:
          if (config.asyncLayerVisibleDefault) {
            cartoLayer.addTo(self.map);
          }
        })
        .on("error", function(err) {
          self.map.fire("layer:error", { id: config.id });
          Util.log("Cartodb layer creation error:", err);
        });
    } else if (config.type && config.type === "wmts") {
      layer = L.tileLayer
        .wmts(config.url, {
          service: "WMTS",
          tilematrixSet: config.tilematrixSet,
          layers: config.layers,
          format: config.format,
          transparent: config.transparent,
          version: config.version,
          crs: L.CRS.EPSG3857,
          // default TileLayer options
          attribution: config.attribution,
          opacity: config.opacity,
          fillColor: config.color,
          weight: config.weight,
          fillOpacity: config.fillOpacity,
          style: config.style,
        })
        .on("loading", function() {
          self.map.fire("layer:loading", { id: config.id });
        })
        .on("load", function() {
          self.map.fire("layer:loaded", { id: config.id });
        })
        .on("tileerror", function() {
          self.map.fire("layer:error", { id: config.id });
        });
      self.layers[config.id] = layer;
    } else if (config.layers) {
      // If "layers" is present, then we assume that the config
      // references a Leaflet WMS layer.
      // http://leafletjs.com/reference.html#tilelayer-wms
      layer = L.tileLayer
        .wms(config.url, {
          layers: config.layers,
          format: config.format,
          transparent: config.transparent,
          version: config.version,
          crs: L.CRS.EPSG3857,
          // default TileLayer options
          attribution: config.attribution,
          opacity: config.opacity,
          fillColor: config.color,
          weight: config.weight,
          fillOpacity: config.fillOpacity,
        })
        .on("loading", function() {
          self.map.fire("layer:loading", { id: config.id });
        })
        .on("load", function() {
          self.map.fire("layer:loaded", { id: config.id });
        })
        .on("tileerror", function() {
          self.map.fire("layer:error", { id: config.id });
        });
      self.layers[config.id] = layer;
    } else {
      // Assume a tile layer
      // TODO: Isn't type=tile for back compatibility
      layer = L.tileLayer(config.url, config)
        .on("loading", function() {
          self.map.fire("layer:loading", { id: config.id });
        })
        .on("load", function() {
          self.map.fire("layer:loaded", { id: config.id });
        })
        .on("tileerror", function() {
          self.map.fire("layer:error", { id: config.id });
        });
      self.layers[config.id] = layer;
    }
  },
});
