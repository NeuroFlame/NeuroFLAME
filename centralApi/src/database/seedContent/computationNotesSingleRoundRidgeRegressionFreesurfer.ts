export default `
### Overview

This computation performs a ridge regression on the merged datasets with freesurfer modality from multiple sites using specified covariates and dependent variables. This computation is designed to run within a federated learning environment, where each site performs a local regression analysis, and then global results are aggregated.

### Example Settings

\`\`\`json
{
 "Dependents": {
     "4th-Ventricle":"float",
     "5th-Ventricle":"float"
 },
 "Covariates": {
     "sex":"str",
     "isControl":"bool",
     "age":"float"
 },
 "Lambda": 1,
 "IgnoreSubjectsWithInvalidData" : true
}
\`\`\`

### Settings Specification

| Variable Name | Type | Description | Allowed Options | Default | Required |
| --- | --- | --- | --- | --- | --- |
| \`Dependents\` | \`dict\` | Provide all the dependent that should be used for regressing along with their type as shown in the example above. | dict |   - | ✅ true |
| \`Covariates\` | \`dict\` | Provide all the covariates that need to be considered for regression along with their type as shown in the example above | dict | - | ✅ true |
| \`Lambda\` | \`float\` | This parameter is the penalty weight that is applied to all variables in the model during regression. If 0, perform simple linear regression, otherwise it does ridge regression. | any value between 0 and 1 | 0 | ❌ false |
| \`IgnoreSubjectsWithMissingData\` | \`boolean\` | This parameter lets the computation owner to decide how to handle if the data has missing or empty values. | true or false | false | ❌ false |

### Input Description

Two files are required as input for this computation:

1.  **Covariates File (**\`covariates.csv\`**)**
    
2.  **Dependent Variables File (**\`data.csv\`**)**
    

Both files must follow a consistent format, though the specific covariates and dependents may vary from study to study based on the \`parameters.json\` file. The computation expects these files to match the covariate and dependent variable names specified in the \`parameters.json\` file.

**Covariates File (**\`covariates.csv\`**)**

*   **Format**: CSV (Comma-Separated Values)
    
*   **Headers**: The file must include a header row where each column name corresponds to a covariate specified in the \`parameters.json\`.
    
*   **Rows**: Each row represents a subject, where each column contains the value for a specific covariate.
    
*   **Variable Names**: The names of the covariates in the header must match the entries in the \`"Covariates"\` section of the \`parameters.json\`.
    

**General Structure**:

    <Covariate_1>,<Covariate_2>,...,<Covariate_N>
    <value_1>,<value_2>,...,<value_N>
    <value_1>,<value_2>,...,<value_N>
    ...
    

**Dependent Variables File (**\`data.csv\`**)**

*   **Format**: CSV (Comma-Separated Values)
    
*   **Headers**: The file must include a header row where each column name corresponds to a dependent variable specified in the \`parameters.json\`.
    
*   **Rows**: Each row represents the same subject as in the \`covariates.csv\`, with values for the dependent variables.
    
*   **Variable Names**: The names of the dependent variables in the header must match the entries in the \`"Dependents"\` section of the \`parameters.json\`.
    

**General Structure**:

    <Dependent_1>,<Dependent_2>,...,<Dependent_N>
    <value_1>,<value_2>,...,<value_N>
    <value_1>,<value_2>,...,<value_N>
    ...

### Algorithm Description

The key steps of the algorithm include:

1.  **Local Ridge Regression (per site)**:
    
    *   Each site runs ridge regression on its local data, standardizing the covariates and regressing against one or more dependent variables.
        
    *   Statistical metrics (e.g., t-values, p-values, R-squared) are calculated using an ordinary least squares (OLS) ridge regression model to provide interpretability.
        
2.  **Global Aggregation (controller)**:
    
    *   After each site computes its local regression results, the controller aggregates the results by performing averaging of the coefficients and other statistics based on the number of subjects (degrees of freedom) per site.

### Assumptions

*   The data.csv and covariates.csv provided by each site follows the specified format (standardized covariate and dependent variable headers).
    
*   If the freesurfer data is not in the csv format, please use the code [data\_generator.py](https://github.com/NeuroFlame/nfc-single-round-ridge-regression-freesurfer/blob/main/other_references/data_generator.py) to generate csv file from .aseg freesurfer files.
    
*   The computation is run in a federated environment, and each site contributes valid data.

### Output Description

*   **Output files: global\_regression\_result.json, global\_regression\_result.html, global\_stats.csv, local\_stats\_{siteid}.csv**
    
*   The json and files have both global and local output results. The global\_stats.csv has only global results and local\_stats\_{siteid}.csv has local results corresponding to each participating site.
    

The computation outputs both **site-level** and **global-level** results, which include:

*   **Coefficients**: Ridge regression coefficients for each covariate.
    
*   **t-Statistics**: Statistical significance for each coefficient.
    
*   **P-Values**: Probability values indicating significance.
    
*   **R-Squared**: The proportion of variance explained by the model.
    
*   **Degrees of Freedom**: The degrees of freedom used in the regression.
    
*   **Sum of Squared Errors (SSE)**: A measure of the model’s error.
`
