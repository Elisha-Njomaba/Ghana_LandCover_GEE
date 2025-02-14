# Ghana_LandCover_GEE
Google Earth Engine script for land cover classification in Ghana using Sentinel-1/2 and Random Forest Algorithm
# Ghana Land Cover Classification with Google Earth Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This repository contains the Google Earth Engine (GEE) script used for land cover classification in Ghana as described in [Adopting Land Cover Standards for Sustainable Development: Challenges and Opportunities]. The workflow integrates **Sentinel-1 SAR**, **Sentinel-2 optical imagery**, and **SRTM elevation data** with a **Random Forest classifier** to produce a high-resolution land cover map.

## Repository Contents
- `ghana_landcover_classification.js`: Main GEE script for classification.
- `training_points.csv`: Sample training data.
- `LICENSE`: MIT License terms.
## Workflow Overview
1. **Data Acquisition**:  
   - Sentinel-1 (VV/VH bands) for dry/wet season SAR metrics.  
   - Sentinel-2 (B1-B12, NDVI, SAVI, NDWI, SAVI) for optical indices.  
   - SRTM for elevation, slope, and aspect.  
2. **Feature Extraction**:  
   - GLCM texture metrics for SAR and optical data NDVI data.  
3. **Random Forest Classification**:  
   - Training/validation split (70/30).  
   - Variable importance analysis.  
4. **Accuracy Assessment**:  
   - Confusion matrix, OA, Kappa.  

## Usage
### Running the Script
1. Open the [Google Earth Engine Code Editor](https://code.earthengine.google.com/).  
2. Copy-paste the code from `ghana_landcover_classification.js` into a new script.  
3. Replace asset paths (e.g., `projects/ee-elishajonah1234/assets/Ghana_bounds`) with your own GEE assets.  
4. Adjust parameters:  
   - `year`: Change the target year for analysis.  
   - `scale`: Adjust the output resolution (default: 10m).  

### Dependencies
- Google Earth Engine account (access required for Sentinel/SRTM data).  
- Earth Engine API enabled.  

## Citation
If you use this code, please cite:  
> [Your Paper Citation]. Script available at: [GitHub URL].  

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.  

## Contact
For questions or support, contact [Elisha Njomaba] at [elishajonah123@gmail.com].  
