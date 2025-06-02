export default `
### Computation Description for \`neuroflame_comp_single_round_ridge_regression_freesurfer\`

#### Overview
The \`single_round_ridge_regression\` computation performs a ridge regression on the merged datasets with freesurfer modality from multiple sites using specified covariates and dependent variables. This computation is designed to run within a federated learning environment, where each site performs a local regression analysis, and then global results are aggregated.

The key steps of the algorithm include:

1. **Local Ridge Regression (per site)**:
   - Each site runs ridge regression on its local data, standardizing the covariates and regressing against one or more dependent variables.
   - Statistical metrics (e.g., t-values, p-values, R-squared) are calculated using an ordinary least squares (OLS) ridge regression model to provide interpretability.

2. **Global Aggregation (controller)**:
   - After each site computes its local regression results, the controller aggregates the results by performing averaging of the coefficients and other statistics based on the number of subjects (degrees of freedom) per site.

#### Detailed Steps

1. **Data Preparation**:
   - The computation reads covariate and dependent variable data from CSV files (\`covariates.csv\` and \`data.csv\` respectively).
  
2. **Ridge Regression**:
   - The computation fits a ridge regression model (with alpha = 1.0) to the standardized covariates and dependent variables.
   - The resulting coefficients are stored for each dependent variable.

3. **OLS Model for Statistical Metrics**:
   - To compute additional statistics (t-values, p-values, R-squared), an OLS model is fitted using the same covariates and dependent variables.
   - The computation extracts these metrics to provide more detailed insights beyond the ridge regression coefficients.

4. **Results**:
   - The aggregated global results are saved as \`global_regression_result.json\` and \`global_regression_result.html\` and include global and local results:
     - Global & local(per site) model coefficients
     - Globale & local(per site)t-Statistics
     - Global & local(per site)p-values
     - Global & local(per site) R-squared
     - Total & local(per site)degrees of freedom
---

#### Data Format Specification

The computation requires two CSV files as input:

1. **Covariates File (\`covariates.csv\`)**
2. **Dependent Variables File (\`data.csv\`)**

Both files must follow a consistent format, though the specific covariates and dependents may vary from study to study based on the \`parameters.json\` file. The computation expects these files to match the covariate and dependent variable names specified in the \`parameters.json\` file.

##### Covariates File (\`covariates.csv\`)

- **Format**: CSV (Comma-Separated Values)
- **Headers**: The file must include a header row where each column name corresponds to a covariate specified in the \`parameters.json\`.
- **Rows**: Each row represents a subject, where each column contains the value for a specific covariate.
- **Variable Names**: The names of the covariates in the header must match the entries in the \`"Covariates"\` section of the \`parameters.json\`.

**General Structure**:
\`\`\`csv
<Covariate_1>,<Covariate_2>,...,<Covariate_N>
<value_1>,<value_2>,...,<value_N>
<value_1>,<value_2>,...,<value_N>
...
\`\`\`


##### Dependent Variables File (\`data.csv\`)

- **Format**: CSV (Comma-Separated Values)
- **Headers**: The file must include a header row where each column name corresponds to a dependent variable specified in the \`parameters.json\`.
- **Rows**: Each row represents the same subject as in the \`covariates.csv\`, with values for the dependent variables.
- **Variable Names**: The names of the dependent variables in the header must match the entries in the \`"Dependents"\` section of the \`parameters.json\`.

**General Structure**:
\`\`\`csv
<Dependent_1>,<Dependent_2>,...,<Dependent_N>
<value_1>,<value_2>,...,<value_N>
<value_1>,<value_2>,...,<value_N>
...
\`\`\`
---

#### Assumptions
- The data provided by each site follows the specified format (standardized covariate and dependent variable headers).
- The computation is run in a federated environment, and each site contributes valid data.

#### Example

- **Input (parameters.json)**:
   \`\`\`json   
    {
    "Dependents": {
        "5th-Ventricle":"int"
    },
    "Covariates": {
        "sex":"str",
        "isControl":"bool",
        "age":"float"
    },
    "Lambda": 1
   }
   \`\`\`

- **Global Output files: global_regression_result.json, global_regression_result.html**
- These files have both global and local output results.
 

#### Output Description
The computation outputs both **site-level** and **global-level** results, which include:
- **Coefficients**: Ridge regression coefficients for each covariate.
- **t-Statistics**: Statistical significance for each coefficient.
- **P-Values**: Probability values indicating significance.
- **R-Squared**: The proportion of variance explained by the model.
- **Degrees of Freedom**: The degrees of freedom used in the regression.
- **Sum of Squared Errors (SSE)**: A measure of the model’s error.
`