export default `
### Overview

This computation performs a closed (or normal) form regression using on the datasets with VBM modality from multiple sites using specified covariates and dependent variables. This computation is designed to run within a federated learning environment, where each site performs a local regression analysis, and then global results are aggregated.

### Example Settings

\`\`\`json
{
       "Covariates": {
           "sex":"str",
           "isControl":"bool",
           "age":"float"
       },
       "Lambda": 1,
       "Threshold": 0.2,
       "VoxelSize":  4,
       "ReferenceColumns": { "site": "IA" },
       "IgnoreSubjectsWithMissingData" : false
   }
\`\`\`

### Settings Specification

| Variable Name | Type | Description | Allowed Options | Default | Required |
| --- | --- | --- | --- | --- | --- |
| \`Covariates\` | \`dict\` | Provide all the covariates that need to be considered for regression along with their type as shown in the example above. | dict | - | ✅ true |
| \`Lambda\` | \`float\` | Penalty weight that is applied to all variables in the model during regression. If 0, perform simple linear regression, otherwise it does ridge regression. | any value between 0 and 1 | 0 | ❌ false |
| \`Threshold\` | \`float\` | This parameter is used in computing average mask. Voxel with values > threshold will only be included in the analysis. | any value > 0 | 0.2 | ❌ false |
| \`VoxelSize\` | \`int\` | Number of voxels used for subsampling/downsampling | any value >= 1 | 1 | ❌ false |
| \`ReferenceColumns\` | \`dict\` | Provide covariates with default value to be used as referencing in dummy encoding for categorical covariates. By default uses the first sorted value as per pandas dummy encoding. | dict | {} | ❌ false |
| \`IgnoreSubjectsWithMissingData\` | \`boolean\` | This parameter lets the computation owner to decide how to handle if the data has missing or empty values. | true or false | false | ❌ false |

### Input Description

The computation requires **a data path** to be provided **having all the nifti files** along with the **covariates.csv** file.

1.  **Covariates File (**\`covariates.csv\`**)** 
    

This file must follow a consistent format consisting "**niftifilename**" column having the nifti file name alogn with the other covariate columns. The computation expects these files to match the covariate names specified in the \`parameters.json\` file.

**Covariates File (**\`covariates.csv\`**)**

*   **Format**: CSV (Comma-Separated Values)
    
*   **Headers**: The file must include a header row where each column name corresponds to a covariate specified in the \`parameters.json\` and also have a column with "**niftifilename**".
    
*   **Rows**: Each row represents a subject, where each column contains the value for a specific covariate.
    
*   **Variable Names**: The names of the covariates in the header must match the entries in the \`"Covariates"\` section of the \`parameters.json\`.
    

**General Structure**:

    niftifilename, <Covariate_1>,<Covariate_2>,...,<Covariate_N>
    <file_1>,<value_1>,<value_2>,...,<value_N>
    <file_1>,<value_1>,<value_2>,...,<value_N>
    ...

### Algorithm Description

The key steps of the algorithm include:

1.  **Local Regression (per site)**:
    
    *   Each site runs regression on its local data, standardizing the covariates (X) and regressing against the voxels (Y). It computes XtX (X transpose \* X)and XtY matrices (X transpose \* Y) and send it to remote to compute aggregated model.
        
    *   Statistical metrics (e.g., t-values, p-values, R-squared) are calculated using an ordinary least squares (OLS) ridge regression model to provide interpretability.
        
2.  **Global Aggregation (controller)**:
    
    *   After each site computes its local regression results, the controller computes the aggregated model by using normal form on the combined XtX (X transpose \* X)and XtY matrices (X transpose \* Y) matrices and computes statistical metrics based on the number of subjects (degrees of freedom) per site.

### Assumptions

*   The data path provided has all the nifti files along with the covariates.csv file.
    
*   The covariates.csv provided by each site follows the specified format (standardized covariate).
    
*   The computation is run in a federated environment, and each site contributes valid data.

### Output Description

*   **Output files: global\_stats and local stats with .png and .nii files**
    
*   The global\_stats has only global results for all the metrics and local\_stats has local results corresponding to that site.
    

The computation outputs both **site-level** and **global-level** results, which include:

*   **Coefficients**: beta values for each covariate.
    
*   **P-Values**: Probability values indicating significance for each covariate.
    
*   **R-Squared**: The proportion of variance explained by the model for each covariate.
`
