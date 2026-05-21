#Google Earth Engine Script, Abia State Land Cover Map
var aoi = ee.FeatureCollection("projects/gee-abia-project/assets/Abia-State_Shp");

Map.centerObject(aoi, 8);
Map.addLayer(aoi, {}, "AOI");

// Sentinel image
var image = ee.ImageCollection("COPERNICUS/S2_SR")
  .filterBounds(aoi)
  .filterDate("2024-01-01", "2024-12-31")
  .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
  .select(['B2','B3','B4','B8','B11'])
  .median()
  .clip(aoi);
  Map.addLayer(image, {bands:["B4","B3","B2"], min:0, max:3000}, "Sentinel");

// Indices
var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
var ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI');
var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');

// Stack
var stacked = image.addBands([ndvi, ndbi, ndwi]);
print(stacked);
//TRAINING POINT

function explodeMultipoint(feature) {
  var coords = ee.List(feature.geometry().coordinates());
  var cls = feature.get('class');

  return ee.FeatureCollection(
    coords.map(function(coord) {
      return ee.Feature(
        ee.Geometry.Point(coord),
        {'class': cls}
      );
    })
  );
}


var vegPts = explodeMultipoint(Vegetation);
var builtPts = explodeMultipoint(Builtup);
var waterPts = explodeMultipoint(Water);
var barePts = explodeMultipoint(Bareland);

var trainingPoints = vegPts
  .merge(builtPts)
  .merge(waterPts)
  .merge(barePts);

print(trainingPoints);

// SAMPLE DATA
var training = stacked.sampleRegions({
  collection: trainingPoints,
  properties: ['class'],
  scale: 10
});

print(training);

//TRAIN RANDOM FOREST
var classifier = ee.Classifier.smileRandomForest(50).train({
  features: training,
  classProperty: 'class',
  inputProperties: stacked.bandNames()
});

print(classifier);

//CLASIFY MAP
var classified = stacked.classify(classifier);

Map.addLayer(classified, {
  min: 0,
  max: 3,
  palette: ['green', 'red', 'blue', 'yellow']
}, 'Land Cover');

//EXPORT CODE TO DRIVE
Export.image.toDrive({
  image: classified,
  description: 'Abia_LandCover_2024',
  folder: 'GEE_Exports',
  fileNamePrefix: 'Abia_LandCover_2024',
  region: aoi.geometry(),
  scale: 10,
  maxPixels: 1e13
});








