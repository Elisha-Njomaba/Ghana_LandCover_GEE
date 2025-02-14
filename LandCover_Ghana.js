// Define Area of Interest (AOI) and Region of Interest (ROI)
var AOI = "projects/ee-elishajonah1234/assets/Ghana_bounds";
var roi = ee.FeatureCollection(AOI);
var zoom = 8.9;
var regionBuffer = 200; // meters
var scale = 10;
var crs = 'EPSG:4326';
var folder = '0_ghana/rf_preprocessing';
var yearModel = 2023;
var yearMap = 2023;

// Date parameters
var year = 2023;
var nameFile = 'RF_Preprocessing_' + year;
// Define the DRY and WET season in the Country
var start = ee.Date((year - 1) + '-10-01');
var end_dry = ee.Date(year + '-04-15');
var start_wet = ee.Date(year + '-05-01');
var end = ee.Date(year + '-10-01');

// Visualization parameters
var vizParams2 = {bands: ['nir', 'red', 'green'], min: 0.0, max: 0.4, gamma: 1.3};

// Sentinel-1 data pull (ascending orbit)
var SAR19 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(roi)
  .filterDate(start, end)
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('instrumentMode', 'IW'));

var asc_SAR19 = SAR19.filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));

// Sentinel-1 Components
var asc_VH = asc_SAR19.select('VH').median().rename('VH_a');
var asc_VV = asc_SAR19.select('VV').median().rename('VV_a');
var asc_ratio_VH_VV = asc_VH.divide(asc_VV).rename('ratio_VH_VV_a');

// Sentinel-1 Standard Deviation
var asc_VH_sd = asc_SAR19.select('VH').reduce(ee.Reducer.stdDev()).rename('VH_a_sd');
var asc_VV_sd = asc_SAR19.select('VV').reduce(ee.Reducer.stdDev()).rename('VV_a_sd');

// Percentiles for Sentinel-1
var asc_VH_perc = asc_SAR19.select('VH').reduce(ee.Reducer.percentile([25, 75])).rename(['VH_a_25', 'VH_a_75']);
var asc_VV_perc = asc_SAR19.select('VV').reduce(ee.Reducer.percentile([25, 75])).rename(['VV_a_25', 'VV_a_75']);

// Combine Sentinel-1 components into one image
var S1img = ee.Image.cat([asc_VH, asc_VV, asc_ratio_VH_VV, asc_VH_sd, asc_VV_sd, asc_VH_perc, asc_VV_perc]);

// Print and visualize Sentinel-1 results
print(S1img, 'All S1 bands with GLCM');
print('Band Names:', S1img.bandNames());

// GLCM Texture calculation (using VH band for texture)
var square1 = ee.Kernel.square({radius: 1});
var texture_vh = asc_VH.int().glcmTexture({
  size: 5,
  kernel: square1
});

// Add texture to Sentinel-1 image
var S1_all = S1img.addBands(texture_vh.select([
  'VH_a_idm', 'VH_a_contrast', 'VH_a_corr', 'VH_a_var', 
  'VH_a_ent', 'VH_a_svar', 'VH_a_sent', 'VH_a_asm'
]));
print(S1_all, 'All S1 bands with GLCM');

// Visualization Parameters for SAR Composite
var sarVizParams = {min: -20, max: 0, bands: ['VV_a', 'VH_a'], gamma: 1.5};
Map.addLayer(S1_all.clip(roi), sarVizParams, 'SAR Composite with GLCM');
Map.centerObject(roi, zoom);

// Sentinel-2 Data Pull (TOA)
var s2s_median = ee.ImageCollection('COPERNICUS/S2')
  .filterBounds(roi) // Filter by ROI
  .filterDate(start, end) // Filter by date range
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)) // Filter by cloud percentage
  .map(function(img) {
    var rescaled = img.select([
      'B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B10','B11','B12'
    ]).divide(10000);  // Rescale bands
    var withQA = rescaled.addBands(img.select(['QA60']));  // Add QA60 band
    return withQA.copyProperties(img, ['system:time_start']);
  })
  .median() // Median composite; // Clip to the ROI

// Select desired bands from the median composite
var s2s = s2s_median.select(['B2','B3','B4','B5','B6','B7','B8','B8A','B9','B10','B11','B12']);

// Print and visualize the median composite of Sentinel-2
print(s2s, 'Median Composite of S2');

// Compute Vegetation Indices for Sentinel-2
var ndvi = s2s.expression(
  '(nir - red) / (nir + red)', 
  { 'nir': s2s.select('B8'), 'red': s2s.select('B4') }
).rename('NDVI');

var savi = s2s.expression(
  '((nir - red) / (nir + red + L)) * (1 + L)', 
  { 'nir': s2s.select('B8'), 'red': s2s.select('B4'), 'L': 0.5 }
).rename('SAVI');

var ndwi = s2s.expression(
  '(green - nir) / (green + nir)', 
  { 'green': s2s.select('B3'), 'nir': s2s.select('B8') }
).rename('NDWI');

var ndbi = s2s.expression(
  '(swir - nir) / (swir + nir)', 
  { 'swir': s2s.select('B11'), 'nir': s2s.select('B8') }
).rename('NDBI');

// Add vegetation indices as bands to the composite
var s2s_indices = s2s.addBands([ndvi, savi, ndwi, ndbi]);

print(s2s_indices, 'S2 Composite with Vegetation Indices');

// Compute Texture Metrics for NDVI
var textureBand = s2s_indices.select('NDVI');
var textureBandInt = textureBand.multiply(10000).toInt16();  // Scale and cast to integer
var squareKernel = ee.Kernel.square({radius: 1});

/// Compute GLCM texture metrics
var texture = textureBandInt.glcmTexture({
  size: 3,
  kernel: squareKernel
}).select([
  'NDVI_contrast', 'NDVI_corr', 'NDVI_var', 'NDVI_ent', 'NDVI_shade'
]);

// Add texture metrics to the composite
var s2s_with_texture = s2s_indices.addBands(texture);
print(s2s_with_texture, 'S2 Composite with Texture Metrics');

// SRTM Elevation Data and Terrain Analysis
var dem = ee.Image('USGS/SRTMGL1_003').clip(roi);
var elevation = dem.select('elevation');
var slope = ee.Terrain.slope(elevation);
var aspect = ee.Terrain.aspect(elevation);

// Combine all variables into one final image
var finalImage = ee.Image.cat([
  S1_all, // Sentinel-1 bands and texture
  s2s_with_texture, // Sentinel-2 bands, indices, and texture
  elevation.rename('elevation'), // Elevation from SRTM
  slope.rename('slope'), // Slope from SRTM
  aspect.rename('aspect') // Aspect from SRTM
]);

print(finalImage, 'Final Combined Image');



var points = "projects/ee-elishajonah1234/assets/finalTraining";
var imageModel = finalImage;
var imageMap = finalImage;

var field = 'LC_code';
// Legend Name and Downloads
var legend_name = 'Land Cover Map';
var scale = 10;
var nameFile = 'lc_ghana_'+yearMap+'_'+scale+'m';
var nameFilePoints = 'lc_ghana_'+yearMap+'_field_data';

var crs= 'EPSG:4326';
var folder = 'lc_ghana';

var splitTraining = 0.3;

// ROI: REGION OF INTEREST

// -----------------------------------
// Class description and palette
// -----------------------------------
var palette = ['#114611', '#33a02c', '#694838', '#cd853f', '#bc13de', '#bc92de', '#ebbff2',
              '#ffc0cb', '0bf6fa', '34f709', '36f79d',
              '3942c4']

var class_value = ['1','2','3','4','5','6','7','8','9','10','11','12'];
// name of the legend
var names = [
    '1.Bare_soil/Rocks', '2.Builtup', '3.Cultivated_irrigation', '4.Close/Open forest',
    '5.Cultivated rainfed', '6.Mango', '7.Mangrove/Wetland', '8.Mining', '9.Oil palm/Rubber',   '10.Salt pan', '11.Savanna', '12.Waterbodies' ];

var signatures = ee.FeatureCollection(points)
var withRandom = signatures.randomColumn('random'); // Add a random column for train/test splitting
var signatures_len = withRandom.size();
print(signatures_len);

// 75/25 train/test split
var val_signatures = withRandom.filter(ee.Filter.and(ee.Filter.gte('random', 0), ee.Filter.lt('random', splitTraining)))
var train_signatures = withRandom.filter(ee.Filter.or(ee.Filter.lt('random', 0), ee.Filter.gte('random', splitTraining)));
var train_signatures_len = train_signatures.size();
print(train_signatures_len);
var val_signatures_len = val_signatures.size();
print(val_signatures_len);

// Create a dictionary mapping land cover class to number of reference signatures per sample
var reference_signatures_agg = signatures.aggregate_histogram(field);
  
// Add a summary chart.
var training_data_chart = ui.Chart.array.values({
    array: ee.Dictionary(reference_signatures_agg)
    .values(class_value), 
    axis: 0, 
    xLabels: names})
    .setChartType('ColumnChart')        
    .setOptions({
      title: 'Training data distribution',
      width: 200,
      height: 400,
      textPosition: "in",
      hAxis: {title: 'Classes', textStyle: {fontSize: 13}},
      vAxis: {title: 'Number of Points'},
      colors: palette,
      sliceVisibilityThreshold: 0, // Don't group small slices.
    });
print(training_data_chart);

// RF - with S1 & S2 bands and computations

//------------------train ------------------//

// sample with training data for classifier
var training = finalImage.sampleRegions({
  collection: train_signatures,
  properties: [field],
  scale: 10,
  tileScale: 16,
  geometries: true
});

// get feaature names for classifier
var bandNames = finalImage.bandNames();

// Calculate the square root of the number of features
var numFeatures = ee.List(bandNames).length();
print ('number of variables for the RF model', numFeatures);
var sqrtNumFeatures = ee.Number(numFeatures).sqrt().round();  // Calculate square root and round to the nearest integer
print ('variablesPerSplit', sqrtNumFeatures);

// settings for classifier
var classifier = ee.Classifier.smileRandomForest({
    numberOfTrees:500, //
    variablesPerSplit: sqrtNumFeatures, //defaults to sqrt number of features (4.something in this case)
    bagFraction: 0.95
    }) 
    .train({
      features: training,
      classProperty: field, 
    });

// Get variable importance as a dictionary
var variableImportance = ee.Dictionary(classifier.explain().get('importance'));

// Convert the variable importance to a JavaScript array for charting
var keys = variableImportance.keys();
var values = variableImportance.values();

// Create a chart
var importanceChart = ui.Chart.array.values({
    array: ee.Array(values),  // Convert values to an ee.Array
    axis: 0,
    xLabels: keys
  })
  .setChartType('ColumnChart')  // Use the correct chart type
  .setOptions({
    title: 'Random Forest Variable Importance',
    hAxis: {title: 'Bands'},
    vAxis: {title: 'Importance'},
    height: 400
  });

// Print the chart
print(importanceChart);


// run classifier
//var image = ee.Image("projects/ee-baldassarre/assets/0_gambia/RF_Preprocessing_"+yearMap);
var classified_img = imageMap.classify(classifier);
print('Classified image with Ghana Training Points', classified_img);


//------------------test ------------------//

// print(test_points,'test points');

// sample with test data for classifier
var test_sampled_classif = finalImage.sampleRegions({
  collection: val_signatures,
  properties: [field],
  scale: 10,
  tileScale: 16,
  geometries: true
});

var classified_test = test_sampled_classif.classify(classifier);

var testAccuracy = classified_test.errorMatrix(field, 
'classification', [1,2,3,4,5,6,7,8,9,10,11,12]); // 

//ee.ConfusionMatrix type has commands accuracy(), array(), consumersAccuracy(), producersAccuracy(), kappa()
print('overall accuracy', testAccuracy.accuracy());
print('producer accuracy', testAccuracy.producersAccuracy());
print('consumer accuracy', testAccuracy.consumersAccuracy());
print('kappa', testAccuracy.kappa());
print('confusion matrix', testAccuracy.array());

// Map classification
Map.addLayer(classified_img, {min: 1, max: 12,  palette: palette} , 'classified image - Ghana',1);

// Export classification
Export.image.toDrive({
  image: classified_img,
  description: nameFile,
  folder: folder,
  region:shp, 
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
